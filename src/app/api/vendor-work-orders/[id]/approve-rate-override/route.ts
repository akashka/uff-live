import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { roundAmount } from '@/lib/utils';

/** POST - Master Admin approves rate override for vendor work order. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) {
      return NextResponse.json({ error: 'Only Master Admin can approve rate overrides' }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();

    const record = await VendorWorkOrder.findById(id);
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const workItems = record.workItems || [];
    const hasUnapproved = workItems.some((wi: { rateOverrideApproved?: boolean }) => wi.rateOverrideApproved === false);
    if (!hasUnapproved) {
      return NextResponse.json({ error: 'No rate overrides pending approval' }, { status: 400 });
    }

    const updatedWorkItems = (workItems as Record<string, unknown>[]).map((wi) => {
      const multiplier = (wi.multiplier as number) ?? 1;
      const effectiveRate = wi.rateOverrideApproved === false ? (wi.ratePerUnit as number) : ((wi.defaultRatePerUnit as number) ?? (wi.ratePerUnit as number));
      return { ...wi, rateOverrideApproved: true, amount: roundAmount((wi.quantity as number) * multiplier * effectiveRate) };
    });
    let totalAmount = 0;
    for (const wi of updatedWorkItems) totalAmount += wi.amount;
    record.workItems = updatedWorkItems;
    record.totalAmount = roundAmount(totalAmount + (record.extraAmount || 0));
    await record.save();

    const updated = await VendorWorkOrder.findById(id).populate('vendor', 'name').lean();
    const vendorName = (updated?.vendor as { name?: string })?.name || 'Vendor';

    logAudit({
      user,
      action: 'vendor_work_order_rate_override_approve',
      entityType: 'vendor_work_order',
      entityId: id,
      summary: `Master Admin approved rate override for vendor work order ${vendorName} (${record.month}) - ₹${record.totalAmount.toLocaleString()}`,
      metadata: { vendorName, month: record.month, amount: record.totalAmount },
      req,
    }).catch(() => {});

    return NextResponse.json({ success: true, totalAmount: record.totalAmount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
