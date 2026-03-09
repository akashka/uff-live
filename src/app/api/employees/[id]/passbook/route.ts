import { NextRequest, NextResponse } from 'next/server';
import { formatMonth, formatDate } from '@/lib/utils';
import mongoose from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import Payment from '@/lib/models/Payment';
import Employee from '@/lib/models/Employee';
import Branch from '@/lib/models/Branch';
import { getAuthUser, hasRole } from '@/lib/auth';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_FETCH = 5000;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: employeeId } = await params;
    if (!employeeId) return NextResponse.json({ error: 'Employee required' }, { status: 400 });

    const canAccessAny = hasRole(user, ['admin', 'finance', 'accountancy', 'hr']);
    const isOwnProfile = String(user.employeeId) === String(employeeId);
    if (!canAccessAny && !isOwnProfile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const employee = await Employee.findById(employeeId).select('name photo employeeType').lean();
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const format = req.nextUrl.searchParams.get('format');
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const limit = format === 'excel' ? MAX_FETCH : Math.min(MAX_LIMIT, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
    const skip = format === 'excel' ? 0 : (page - 1) * limit;

    const empObjId = new mongoose.Types.ObjectId(employeeId);

    const empType = (employee as { employeeType?: string }).employeeType || 'contractor';
    const paymentFilter: Record<string, unknown> = { employee: empObjId };
    if (empType === 'contractor' || empType === 'full_time') {
      paymentFilter.paymentType = empType;
    }

    const [workRecords, payments] = await Promise.all([
      WorkRecord.find({ employee: empObjId })
        .select('_id month totalAmount branch')
        .sort({ month: 1, createdAt: 1 })
        .limit(MAX_FETCH)
        .lean(),
      Payment.find(paymentFilter)
        .select('_id paidAt paymentAmount paymentMode month totalPayable isAdvance paymentType')
        .sort({ paidAt: 1 })
        .limit(MAX_FETCH)
        .lean(),
    ]);

    const branchIds = [...new Set((workRecords || []).map((r) => String((r as { branch?: unknown }).branch)).filter(Boolean))];
    const branchMap = new Map<string, string>();
    if (branchIds.length > 0) {
      const branches = await Branch.find({ _id: { $in: branchIds } }).select('name').lean();
      for (const b of branches || []) {
        branchMap.set(String(b._id), (b as { name?: string }).name || '');
      }
    }

    const workEntries = (workRecords || []).map((r) => {
      const branchName = branchMap.get(String((r as { branch?: unknown }).branch)) || 'Branch';
      const month = (r as { month?: string }).month;
      const [y, m] = (month || '').split('-').map(Number);
      const d = y && m ? new Date(y, m - 1, 1) : new Date();
      return {
        type: 'work',
        id: `w-${(r as { _id?: unknown })._id}`,
        date: d.toISOString(),
        particulars: `Work Record – ${branchName} (${formatMonth(month) || '–'})`,
        credit: (r as { totalAmount?: number }).totalAmount ?? 0,
        debit: 0,
      };
    });

    let paymentEntries: { type: string; id: string; date: string; particulars: string; credit: number; debit: number }[] = [];

    if (empType === 'full_time') {
      for (const p of payments || []) {
        const month = (p as { month?: string }).month || '';
        const monthStr = formatMonth(month) || '–';
        const isAdv = (p as { isAdvance?: boolean }).isAdvance ?? false;
        const paymentAmount = (p as { paymentAmount?: number }).paymentAmount ?? 0;
        const totalPayable = (p as { totalPayable?: number }).totalPayable ?? 0;
        const paidAt = (p as { paidAt?: Date }).paidAt;
        const paymentMode = (p as { paymentMode?: string }).paymentMode || '';

        if (isAdv) {
          paymentEntries.push({
            type: 'advance',
            id: `p-adv-${(p as { _id?: unknown })._id}`,
            date: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
            particulars: `Advance – ${monthStr}`,
            credit: 0,
            debit: paymentAmount,
          });
        } else {
          const [y, m] = (month || '').split('-').map(Number);
          const monthFirst = y && m ? new Date(y, m - 1, 1) : new Date();
          paymentEntries.push({
            type: 'salary_credit',
            id: `p-sal-${(p as { _id?: unknown })._id}`,
            date: monthFirst.toISOString(),
            particulars: `Salary – ${monthStr}`,
            credit: totalPayable,
            debit: 0,
          });
          paymentEntries.push({
            type: 'payment',
            id: `p-${(p as { _id?: unknown })._id}`,
            date: paidAt ? new Date(paidAt).toISOString() : new Date().toISOString(),
            particulars: `Salary Payment – ${monthStr} (${paymentMode})`,
            credit: 0,
            debit: paymentAmount,
          });
        }
      }
    } else {
      paymentEntries = (payments || []).map((p) => {
        const month = (p as { month?: string }).month || '';
        const [y, m] = (month || '').split('-').map(Number);
        const d = y && m ? new Date(y, m - 1, 1) : new Date();
        return {
          type: 'payment',
          id: `p-${(p as { _id?: unknown })._id}`,
          date: d.toISOString(),
          particulars: `Payment – ${(p as { paymentMode?: string }).paymentMode || ''} (${formatMonth(month) || '–'})`,
          credit: 0,
          debit: (p as { paymentAmount?: number }).paymentAmount ?? 0,
        };
      });
    }

    const merged = [...workEntries, ...paymentEntries].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return da - db;
    });

    const total = merged.length;
    const exportAll = format === 'excel';
    const entries = exportAll ? merged : merged.slice(skip, skip + limit);

    let runningBalance = 0;
    if (!exportAll) {
      for (let i = 0; i < skip; i++) {
        runningBalance += merged[i].credit - merged[i].debit;
      }
    }
    const rowsWithBalance = entries.map((e) => {
      runningBalance += e.credit - e.debit;
      return { ...e, balance: runningBalance };
    });

    const outstanding = merged.reduce((s, e) => s + e.credit - e.debit, 0);

    if (format === 'excel') {
      const excelRows = rowsWithBalance.map((r) => ({
        Date: r.date ? formatDate(r.date) : '–',
        Particulars: r.particulars,
        Credit: r.credit > 0 ? r.credit : '',
        Debit: r.debit > 0 ? r.debit : '',
        Balance: r.balance ?? 0,
      }));
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      const empName = (employee as { name?: string }).name || 'Passbook';
      const sheetName = `Passbook_${empName}`.slice(0, 31).replace(/[/\\?*\[\]]/g, '_');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `passbook_${empName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      employee,
      data: rowsWithBalance,
      total,
      page,
      limit,
      hasMore: page * limit < total,
      outstanding,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
