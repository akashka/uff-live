import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import WorkRecord from '@/lib/models/WorkRecord';
import Employee from '@/lib/models/Employee';
import Branch from '@/lib/models/Branch';
import { getAuthUser, hasRole } from '@/lib/auth';
import { createMonthlyReportPdf } from '@/lib/pdf';
import { formatMonth } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const month = req.nextUrl.searchParams.get('month') || '';
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Valid month (YYYY-MM) required' }, { status: 400 });
    }

    const monthStr = month.slice(0, 7);

    await connectDB();

    const [paymentAgg, workAgg, employeeCount, branchWork, branchPay] = await Promise.all([
      Payment.aggregate([
        { $match: { month: monthStr, isAdvance: false } },
        { $group: { _id: null, total: { $sum: '$paymentAmount' }, count: { $sum: 1 } } },
      ]),
      WorkRecord.aggregate([
        { $match: { month: monthStr } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } },
      ]),
      Employee.countDocuments({ isActive: true }),
      WorkRecord.aggregate([
        { $match: { month: monthStr } },
        { $group: { _id: '$branch', total: { $sum: '$totalAmount' } } },
      ]),
      Payment.aggregate([
        { $match: { month: monthStr, isAdvance: false } },
        { $group: { _id: '$employee', total: { $sum: '$paymentAmount' } } },
      ]),
    ]);

    const totalPayments = paymentAgg[0]?.total ?? 0;
    const totalWorkAmount = workAgg[0]?.total ?? 0;
    const paymentCount = paymentAgg[0]?.count ?? 0;

    const branchIds = [...new Set(branchWork.map((b) => String(b._id)).filter(Boolean))];
    const branches = await Branch.find({ _id: { $in: branchIds.map((id) => new mongoose.Types.ObjectId(id)) } })
      .select('name')
      .lean();

    const branchMap = new Map<string, string>();
    for (const b of branches || []) {
      branchMap.set(String(b._id), (b as { name?: string }).name || '');
    }

    const empToPayment = new Map<string, number>();
    for (const p of branchPay) {
      empToPayment.set(String(p._id), p.total);
    }

    const workByBranch = new Map<string, number>();
    for (const w of branchWork) {
      workByBranch.set(String(w._id), w.total);
    }

    const workRecordsWithBranch = await WorkRecord.find({ month: monthStr })
      .select('branch employee totalAmount')
      .lean();

    const empTotalWork = new Map<string, number>();
    for (const wr of workRecordsWithBranch || []) {
      const empId = String((wr as { employee?: unknown }).employee);
      const amt = (wr as { totalAmount?: number }).totalAmount ?? 0;
      empTotalWork.set(empId, (empTotalWork.get(empId) ?? 0) + amt);
    }

    const payByBranch = new Map<string, number>();
    for (const wr of workRecordsWithBranch || []) {
      const branchId = String((wr as { branch?: unknown }).branch);
      const empId = String((wr as { employee?: unknown }).employee);
      const wrAmount = (wr as { totalAmount?: number }).totalAmount ?? 0;
      const empWork = empTotalWork.get(empId) ?? 1;
      const empPay = empToPayment.get(empId) ?? 0;
      const ratio = empWork > 0 ? wrAmount / empWork : 0;
      const attributedPay = empPay * ratio;
      payByBranch.set(branchId, (payByBranch.get(branchId) ?? 0) + attributedPay);
    }

    const byBranch: { branchName: string; workAmount: number; paymentAmount: number }[] = [];
    for (const branchId of branchIds) {
      byBranch.push({
        branchName: branchMap.get(branchId) || branchId,
        workAmount: workByBranch.get(branchId) ?? 0,
        paymentAmount: payByBranch.get(branchId) ?? 0,
      });
    }
    byBranch.sort((a, b) => b.workAmount - a.workAmount);

    const pdfBuffer = createMonthlyReportPdf({
      month: monthStr,
      monthLabel: formatMonth(monthStr) || monthStr,
      totalPayments,
      totalWorkAmount,
      employeeCount,
      paymentCount,
      byBranch,
    });

    const filename = `monthly_report_${monthStr}.pdf`;
    const buf = Buffer.from(pdfBuffer);
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate monthly report' }, { status: 500 });
  }
}
