import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import WorkRecord, { type IWorkItem } from '@/lib/models/WorkRecord';
import { getAuthUser, hasRole } from '@/lib/auth';
import { canAccessBranch, getUserBranchScope } from '@/lib/branchAccess';
import { createNotifications, getUserIdByEmployeeId } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';
import { roundAmount } from '@/lib/utils';

/** POST - Master Admin approves rate override. Uses entered price for amount going forward. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) {
      return NextResponse.json({ error: 'Only Master Admin can approve rate overrides' }, { status: 403 });
    }

    const { id } = await params;
    await connectDB();

    const record = await WorkRecord.findById(id);
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const scope = await getUserBranchScope(user);
    if (!canAccessBranch(scope, String(record.branch))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const workItems = record.workItems || [];
    const hasUnapproved = workItems.some((wi: { rateOverrideApproved?: boolean }) => wi.rateOverrideApproved === false);
    if (!hasUnapproved) {
      return NextResponse.json({ error: 'No rate overrides pending approval' }, { status: 400 });
    }

    const updatedWorkItems: IWorkItem[] = workItems.map((wi) => {
      const multiplier = wi.multiplier ?? 1;
      const effectiveRate = wi.rateOverrideApproved === false ? wi.ratePerUnit : (wi.defaultRatePerUnit ?? wi.ratePerUnit);
      return { ...wi, rateOverrideApproved: true, amount: roundAmount(wi.quantity * multiplier * effectiveRate) };
    });
    let totalAmount = 0;
    for (const wi of updatedWorkItems) totalAmount += wi.amount;
    record.workItems = updatedWorkItems;
    record.totalAmount = roundAmount(totalAmount + (record.otAmount || 0));
    await record.save();

    const updated = await WorkRecord.findById(id)
      .populate('employee', 'name')
      .lean();
    const empName = (updated?.employee as { name?: string })?.name || 'Employee';
    const empId = String(record.employee);
    const empUserId = await getUserIdByEmployeeId(empId);

    if (empUserId) {
      createNotifications({
        recipientIds: [empUserId],
      type: 'work_record_rate_override_approved',
      title: 'Rate override approved',
      message: `Master Admin approved the rate change(s) for your work record (${record.month}). Entered price is now applied.`,
      link: '/work-orders',
      metadata: { entityId: id, entityType: 'work_record', employeeId: empId, employeeName: empName, month: record.month, amount: record.totalAmount },
      }).catch(() => {});
    }

    logAudit({
      user,
      action: 'work_record_rate_override_approve',
      entityType: 'work_record',
      entityId: id,
      summary: `Master Admin approved rate override for ${empName} (${record.month}) - ₹${record.totalAmount.toLocaleString()}`,
      metadata: { employeeId: empId, employeeName: empName, month: record.month, amount: record.totalAmount },
      req,
    }).catch(() => {});

    return NextResponse.json({ success: true, totalAmount: record.totalAmount });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
