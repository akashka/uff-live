import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import WorkRecord from '@/lib/models/WorkRecord';
import Branch from '@/lib/models/Branch';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const monthFrom = searchParams.get('monthFrom') || `${year}-01`;
    const monthTo = searchParams.get('monthTo') || `${year}-12`;

    await connectDB();

    const branches = await Branch.find({ isActive: true }).select('name _id').lean();
    const branchIds = (branches || []).map((b) => {
      const id = (b as { _id: mongoose.Types.ObjectId })._id;
      return id instanceof mongoose.Types.ObjectId ? id : new mongoose.Types.ObjectId(String(id));
    });

    const [workByBranch, paymentByEmployee] = await Promise.all([
      WorkRecord.aggregate([
        {
          $match: {
            branch: { $in: branchIds },
            month: { $gte: monthFrom.slice(0, 7), $lte: monthTo.slice(0, 7) },
          },
        },
        { $group: { _id: '$branch', totalWork: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        {
          $match: {
            month: { $gte: monthFrom.slice(0, 7), $lte: monthTo.slice(0, 7) },
            isAdvance: false,
          },
        },
        { $group: { _id: '$employee', totalPaid: { $sum: '$paymentAmount' } } },
      ]),
    ]);

    const empToPayment = new Map<string, number>();
    for (const p of paymentByEmployee) {
      empToPayment.set(String(p._id), p.totalPaid);
    }

    const workRecords = await WorkRecord.find({
      branch: { $in: branchIds },
      month: { $gte: monthFrom.slice(0, 7), $lte: monthTo.slice(0, 7) },
    })
      .select('branch employee totalAmount')
      .lean();

    const empTotalWork = new Map<string, number>();
    for (const wr of workRecords || []) {
      const empId = String((wr as { employee?: unknown }).employee);
      const amt = (wr as { totalAmount?: number }).totalAmount ?? 0;
      empTotalWork.set(empId, (empTotalWork.get(empId) ?? 0) + amt);
    }

    const payByBranch = new Map<string, number>();
    for (const wr of workRecords || []) {
      const branchId = String((wr as { branch?: unknown }).branch);
      const empId = String((wr as { employee?: unknown }).employee);
      const wrAmount = (wr as { totalAmount?: number }).totalAmount ?? 0;
      const empWork = empTotalWork.get(empId) ?? 1;
      const empPay = empToPayment.get(empId) ?? 0;
      const ratio = empWork > 0 ? wrAmount / empWork : 0;
      payByBranch.set(branchId, (payByBranch.get(branchId) ?? 0) + empPay * ratio);
    }

    const workMap = new Map<string, { totalWork: number; count: number }>();
    for (const w of workByBranch) {
      workMap.set(String(w._id), { totalWork: w.totalWork, count: w.count });
    }

    const branchMap = new Map<string, string>();
    for (const b of branches || []) {
      branchMap.set(String((b as { _id: unknown })._id), (b as { name?: string }).name || '');
    }

    const data = branchIds.map((id) => {
      const idStr = id instanceof mongoose.Types.ObjectId ? id.toString() : String(id);
      const w = workMap.get(idStr);
      const p = payByBranch.get(idStr) ?? 0;
      return {
        branchId: idStr,
        branchName: branchMap.get(idStr) || idStr,
        workAmount: w?.totalWork ?? 0,
        workRecordCount: w?.count ?? 0,
        paymentAmount: Math.round(p * 100) / 100,
      };
    });

    const totalWork = data.reduce((s, d) => s + d.workAmount, 0);
    const totalPayments = data.reduce((s, d) => s + d.paymentAmount, 0);

    return NextResponse.json({
      year,
      monthFrom: monthFrom.slice(0, 7),
      monthTo: monthTo.slice(0, 7),
      data,
      totals: { workAmount: totalWork, paymentAmount: totalPayments },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch branch comparison' }, { status: 500 });
  }
}
