import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import VendorPayment from '@/lib/models/VendorPayment';
import { getAuthUser, hasRole } from '@/lib/auth';
import { roundAmount } from '@/lib/utils';

/** Get vendor work order IDs already paid in this month */
async function getPaidVendorWorkOrderIds(vendorId: string, monthStr: string) {
  const payments = await VendorPayment.find({
    vendor: vendorId,
    month: monthStr,
    paymentType: 'monthly',
    'vendorWorkOrderRefs.0': { $exists: true },
  })
    .select('vendorWorkOrderRefs.vendorWorkOrder')
    .lean();
  const ids = new Set<string>();
  for (const p of payments || []) {
    const refs = (p as { vendorWorkOrderRefs?: { vendorWorkOrder?: unknown }[] }).vendorWorkOrderRefs || [];
    for (const ref of refs) {
      const id = ref.vendorWorkOrder;
      if (id) ids.add(String(id));
    }
  }
  return Array.from(ids);
}

/** Calculate monthly payment for a vendor based on their work orders */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendorId');
    const month = searchParams.get('month');
    const selectedIdsParam = searchParams.get('selectedVendorWorkOrderIds');

    if (!vendorId || !month) {
      return NextResponse.json({ error: 'vendorId and month required' }, { status: 400 });
    }

    const monthStr = String(month).slice(0, 7);

    await connectDB();

    const allWorkOrders = await VendorWorkOrder.find({
      vendor: vendorId,
      month: monthStr,
    })
      .populate('branch', 'name')
      .populate('styleOrder', 'styleCode brand colour')
      .sort({ month: 1, createdAt: 1 })
      .lean();

    const paidIds = await getPaidVendorWorkOrderIds(vendorId, monthStr);
    const workOrdersWithPaid = (allWorkOrders || []).map((r) => {
      const rid = (r as { _id?: unknown })._id;
      const idStr = rid ? String(rid) : '';
      return {
        ...r,
        isPaid: paidIds.includes(idStr),
      };
    });

    const selectedIds = selectedIdsParam ? selectedIdsParam.split(',').filter(Boolean) : null;
    const ordersToSum = selectedIds
      ? workOrdersWithPaid.filter((r) => selectedIds.includes(String((r as { _id?: unknown })._id)))
      : workOrdersWithPaid.filter((r) => !(r as { isPaid?: boolean }).isPaid);

    const totalWorkAmount = roundAmount(ordersToSum.reduce((sum, r) => sum + (r.totalAmount || 0), 0));

    return NextResponse.json({
      paymentType: 'monthly',
      workOrders: workOrdersWithPaid,
      totalWorkAmount,
      baseAmount: totalWorkAmount,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
