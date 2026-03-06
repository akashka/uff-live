import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
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

    const canAccessAny = hasRole(user, ['admin', 'finance', 'hr']);
    const isOwnProfile = String(user.employeeId) === String(employeeId);
    if (!canAccessAny && !isOwnProfile) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();

    const employee = await Employee.findById(employeeId).select('name photo employeeType').lean();
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
    const skip = (page - 1) * limit;

    const empObjId = new mongoose.Types.ObjectId(employeeId);

    const [workRecords, payments] = await Promise.all([
      WorkRecord.find({ employee: empObjId })
        .select('_id periodStart periodEnd totalAmount branch')
        .sort({ periodEnd: 1 })
        .limit(MAX_FETCH)
        .lean(),
      Payment.find({ employee: empObjId })
        .select('_id paidAt paymentAmount paymentMode periodStart periodEnd')
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
      const ps = (r as { periodStart?: Date }).periodStart;
      const pe = (r as { periodEnd?: Date }).periodEnd;
      const dateStr = pe ? new Date(pe).toISOString().slice(0, 10) : ps ? new Date(ps).toISOString().slice(0, 10) : '';
      return {
        type: 'work',
        id: `w-${(r as { _id?: unknown })._id}`,
        date: (pe || ps)?.toString?.() || '',
        particulars: `Work Record – ${branchName} (${dateStr})`,
        credit: (r as { totalAmount?: number }).totalAmount ?? 0,
        debit: 0,
      };
    });

    const paymentEntries = (payments || []).map((p) => {
      const ps = (p as { periodStart?: Date }).periodStart;
      const pe = (p as { periodEnd?: Date }).periodEnd;
      const dateStr = ps ? new Date(ps).toISOString().slice(0, 10) : '';
      const dateStrEnd = pe ? new Date(pe).toISOString().slice(0, 10) : '';
      return {
        type: 'payment',
        id: `p-${(p as { _id?: unknown })._id}`,
        date: ((p as { paidAt?: Date }).paidAt as Date)?.toString?.() || '',
        particulars: `Payment – ${(p as { paymentMode?: string }).paymentMode || ''} (${dateStr} – ${dateStrEnd})`,
        credit: 0,
        debit: (p as { paymentAmount?: number }).paymentAmount ?? 0,
      };
    });

    const merged = [...workEntries, ...paymentEntries].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return da - db;
    });

    const total = merged.length;
    const entries = merged.slice(skip, skip + limit);

    let runningBalance = 0;
    for (let i = 0; i < skip; i++) {
      runningBalance += merged[i].credit - merged[i].debit;
    }
    const rowsWithBalance = entries.map((e) => {
      runningBalance += e.credit - e.debit;
      return { ...e, balance: runningBalance };
    });

    const outstanding = merged.reduce((s, e) => s + e.credit - e.debit, 0);

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
