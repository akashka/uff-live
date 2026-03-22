import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import { getAuthUser, hasRole } from '@/lib/auth';

/** Get total advance outstanding for a full-time employee (advance given - advance deducted). */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const paymentType = searchParams.get('paymentType') || 'full_time'; // 'full_time' | 'contractor'
    const month = searchParams.get('month'); // optional: YYYY-MM for advanceDeductedThisMonth
    if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 });

    await connectDB();

    const empObjId = new mongoose.Types.ObjectId(employeeId);
    const advancePayments = await Payment.find({
      employee: empObjId,
      paymentType: paymentType === 'contractor' ? 'contractor' : 'full_time',
      isAdvance: true,
    })
      .select('paymentAmount paidAt month')
      .sort({ paidAt: 1 })
      .lean();

    const totalAdvanceGiven = (advancePayments || []).reduce((s, p) => s + ((p as { paymentAmount?: number }).paymentAmount ?? 0), 0);

    const advanceDeductedAgg = await Payment.aggregate([
      {
        $match: {
          employee: empObjId,
          paymentType: paymentType === 'contractor' ? 'contractor' : 'full_time',
          isAdvance: false,
        },
      },
      { $group: { _id: null, total: { $sum: '$advanceDeducted' } } },
    ]);
    const totalAdvanceDeducted = advanceDeductedAgg[0]?.total ?? 0;

    // outstanding = total given - total deducted (lifetime). Pre-fill = remaining to recover.
    const outstanding = Math.max(0, totalAdvanceGiven - totalAdvanceDeducted);

    let advanceDeductedThisMonth = 0;
    if (month) {
      const monthAgg = await Payment.aggregate([
        {
          $match: {
            employee: empObjId,
            paymentType: paymentType === 'contractor' ? 'contractor' : 'full_time',
            isAdvance: false,
            month: String(month).slice(0, 7),
          },
        },
        { $group: { _id: null, total: { $sum: '$advanceDeducted' } } },
      ]);
      advanceDeductedThisMonth = monthAgg[0]?.total ?? 0;
    }

    const breakdown = (advancePayments || []).map((p) => ({
      amount: (p as { paymentAmount?: number }).paymentAmount ?? 0,
      month: (p as { month?: string }).month,
      paidAt: (p as { paidAt?: Date }).paidAt,
    }));

    const body: { outstanding: number; totalAdvanceGiven: number; totalAdvanceDeducted: number; breakdown: unknown[]; advanceDeductedThisMonth?: number } = {
      outstanding,
      totalAdvanceGiven,
      totalAdvanceDeducted,
      breakdown,
    };
    if (month) body.advanceDeductedThisMonth = advanceDeductedThisMonth;
    return NextResponse.json(body);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
