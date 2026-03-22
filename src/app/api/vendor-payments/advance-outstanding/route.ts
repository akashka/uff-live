import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import VendorPayment from '@/lib/models/VendorPayment';
import { getAuthUser, hasRole } from '@/lib/auth';
import { roundAmount } from '@/lib/utils';

/** Get total advance outstanding for a vendor (advance given - advance deducted). */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendorId');
    const month = searchParams.get('month'); // optional: YYYY-MM for advanceDeductedThisMonth
    if (!vendorId) return NextResponse.json({ error: 'vendorId required' }, { status: 400 });

    await connectDB();

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return NextResponse.json({ error: 'Invalid vendorId' }, { status: 400 });
    }
    const vendorObjId = new mongoose.Types.ObjectId(vendorId);

    const advancePayments = await VendorPayment.find({
      vendor: vendorObjId,
      paymentType: 'advance',
    })
      .select('paymentAmount paidAt month')
      .sort({ paidAt: 1 })
      .lean();

    const totalAdvanceGiven = roundAmount(
      (advancePayments || []).reduce((s, p) => s + (Number((p as { paymentAmount?: number }).paymentAmount) || 0), 0)
    );

    const advanceDeductedAgg = await VendorPayment.aggregate([
      { $match: { vendor: vendorObjId, paymentType: 'monthly' } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$advanceDeducted', 0] } } } },
    ]);
    const totalAdvanceDeducted = roundAmount(advanceDeductedAgg[0]?.total ?? 0);

    const outstanding = Math.max(0, totalAdvanceGiven - totalAdvanceDeducted);

    const breakdown = (advancePayments || []).map((p) => ({
      amount: (p as { paymentAmount?: number }).paymentAmount ?? 0,
      month: (p as { month?: string }).month,
      paidAt: (p as { paidAt?: Date }).paidAt,
    }));

    const body: {
      outstanding: number;
      totalAdvanceGiven: number;
      totalAdvanceDeducted: number;
      breakdown: unknown[];
      advanceDeductedThisMonth?: number;
    } = {
      outstanding,
      totalAdvanceGiven,
      totalAdvanceDeducted,
      breakdown,
    };
    if (month) {
      const monthPayments = await VendorPayment.find({
        vendor: vendorObjId,
        paymentType: 'monthly',
        month: String(month).slice(0, 7),
      })
        .select('advanceDeducted')
        .lean();
      body.advanceDeductedThisMonth = (monthPayments || []).reduce(
        (s, p) => s + ((p as { advanceDeducted?: number }).advanceDeducted ?? 0),
        0
      );
    }
    return NextResponse.json(body);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
