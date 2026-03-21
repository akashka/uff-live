import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import { getAuthUser, hasRole } from '@/lib/auth';
import { roundAmount } from '@/lib/utils';

/** Calculate monthly payment for a vendor based on their work orders */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendorId');
    const month = searchParams.get('month');

    if (!vendorId || !month) {
      return NextResponse.json({ error: 'vendorId and month required' }, { status: 400 });
    }

    const monthStr = String(month).slice(0, 7);

    await connectDB();

    const workOrders = await VendorWorkOrder.find({
      vendor: vendorId,
      month: monthStr,
    })
      .populate('branch', 'name')
      .populate('styleOrder', 'styleCode brand')
      .sort({ month: 1 })
      .lean();

    const totalWorkAmount = roundAmount(workOrders.reduce((sum, r) => sum + (r.totalAmount || 0), 0));

    return NextResponse.json({
      paymentType: 'monthly',
      workOrders,
      totalWorkAmount,
      baseAmount: totalWorkAmount,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
