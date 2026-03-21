import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VendorPayment from '@/lib/models/VendorPayment';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();

    const payment = await VendorPayment.findById(id)
      .populate('vendor', 'name vendorId')
      .populate({
        path: 'vendorWorkOrderRefs.vendorWorkOrder',
        populate: [
          { path: 'styleOrder', select: 'styleCode brand' },
          { path: 'branch', select: 'name' },
        ],
      })
      .lean();

    if (!payment) return NextResponse.json({ error: 'Vendor payment not found' }, { status: 404 });

    return NextResponse.json(payment);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
