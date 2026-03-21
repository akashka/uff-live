import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import Employee from '@/lib/models/Employee';
import RateMaster from '@/lib/models/RateMaster';
import StyleOrder from '@/lib/models/StyleOrder';
import { getAuthUser, hasRole } from '@/lib/auth';
import { notifyAdminsIfNeeded, notifyEmployee } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';
import { roundAmount } from '@/lib/utils';

async function getAvailableQuantity(
  styleOrderId: string,
  branchId: string,
  month: string,
  rateMasterId: string,
  excludeWorkRecordId?: string
): Promise<number> {
  const styleOrder = await StyleOrder.findById(styleOrderId).lean();
  if (!styleOrder) return 0;

  const monthStr = String(month).slice(0, 7);
  const so = styleOrder as { month?: string; totalOrderQuantity?: number };
  const totalOrderQty = so.month === monthStr ? (so.totalOrderQuantity ?? 0) : 0;

  const producedFilter: Record<string, unknown> = {
    styleOrder: styleOrderId,
    branch: branchId,
    month: monthStr,
  };
  if (excludeWorkRecordId) producedFilter._id = { $ne: excludeWorkRecordId };

  const produced = await WorkRecord.aggregate([
    { $match: producedFilter },
    { $unwind: '$workItems' },
    { $match: { 'workItems.rateMaster': { $eq: new mongoose.Types.ObjectId(rateMasterId) } } },
    { $group: { _id: null, total: { $sum: '$workItems.quantity' } } },
  ]);
  const producedQty = produced[0]?.total ?? 0;
  return Math.max(0, totalOrderQty - producedQty);
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await connectDB();
    const record = await WorkRecord.findById(id)
      .populate('employee', 'name _id')
      .populate('branch', 'name _id')
      .populate('styleOrder', 'styleCode brand colours _id')
      .lean();
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const emp = record.employee as { _id?: unknown } | undefined;
    const empId = emp && typeof emp === 'object' && '_id' in emp ? String(emp._id) : String(record.employee);
    const canAccess = hasRole(user, ['admin', 'finance', 'accountancy', 'hr']) || (user.employeeId && String(user.employeeId) === empId);
    if (!canAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(record);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); // accountancy is read-only

    const { id } = await params;
    const body = await req.json();

    await connectDB();
    const record = await WorkRecord.findById(id);
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { employeeId, branchId, month, styleOrderId, colour, workItems, notes, otHours, otAmount } = body;

    if (month !== undefined) record.month = String(month).slice(0, 7);
    if (notes !== undefined) record.notes = notes;
    if (otHours !== undefined) record.otHours = Number(otHours) || 0;
    if (otAmount !== undefined) record.otAmount = roundAmount(Number(otAmount) || 0);
    if (styleOrderId !== undefined) record.styleOrder = styleOrderId || undefined;

    if (employeeId !== undefined) {
      const employee = await Employee.findById(employeeId).lean();
      if (!employee || employee.employeeType !== 'contractor') {
        return NextResponse.json({ error: 'Invalid employee' }, { status: 400 });
      }
      record.employee = employeeId;
    }
    if (branchId !== undefined) record.branch = branchId;

    if (workItems && Array.isArray(workItems) && workItems.length > 0) {
      const empId = employeeId || record.employee?.toString();
      const branch = branchId || record.branch?.toString();
      const monthStr = month !== undefined ? String(month).slice(0, 7) : record.month;
      const styleId = styleOrderId || record.styleOrder?.toString();
      const employee = await Employee.findById(empId).lean();
      if (!employee || employee.employeeType !== 'contractor') {
        return NextResponse.json({ error: 'Invalid employee' }, { status: 400 });
      }

      const rateMasterIds = workItems.map((w: { rateMasterId: string }) => w.rateMasterId);
      const rateMasters = await RateMaster.find({ _id: { $in: rateMasterIds } }).lean();
      const departmentId = employee.department && typeof employee.department === 'object' && (employee.department as { _id?: unknown })._id
        ? String((employee.department as { _id: { toString: () => string } })._id)
        : (employee.department ? String(employee.department) : null);

      const workItemsWithAmounts = [];
      let totalAmount = 0;

      for (const item of workItems) {
        const rateMaster = rateMasters.find((r: { _id: { toString: () => string } }) => r._id.toString() === item.rateMasterId);
        if (!rateMaster) continue;

        let defaultRate = 0;
        const bdr = (rateMaster as { branchDepartmentRates?: { branch: unknown; department: unknown; amount: number }[] }).branchDepartmentRates;
        const br = (rateMaster as { branchRates?: { branch: unknown; amount: number }[] }).branchRates;
        if (bdr?.length && departmentId) {
          const match = bdr.find((e) => {
            const bid = e.branch && typeof e.branch === 'object' && '_id' in e.branch ? String((e.branch as { _id: unknown })._id) : String(e.branch);
            const did = e.department && typeof e.department === 'object' && '_id' in e.department ? String((e.department as { _id: unknown })._id) : String(e.department);
            return bid === branch && did === departmentId;
          });
          defaultRate = match?.amount ?? 0;
        }
        if (defaultRate === 0 && br?.length) {
          const branchRate = br.find((b) => (typeof b.branch === 'object' ? (b.branch as { toString?: () => string })?.toString?.() : String(b.branch)) === branch);
          defaultRate = branchRate?.amount ?? 0;
        }
        const ratePerUnit = (item as { ratePerUnit?: number }).ratePerUnit != null ? Number((item as { ratePerUnit?: number }).ratePerUnit) : defaultRate;
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const multiplier = Number(item.multiplier) || 1;

        const amount = roundAmount(quantity * multiplier * ratePerUnit);
        workItemsWithAmounts.push({
          rateMaster: item.rateMasterId,
          rateName: (rateMaster as { name: string }).name,
          unit: (rateMaster as { unit: string }).unit,
          quantity,
          multiplier,
          remarks: item.remarks || '',
          ratePerUnit,
          amount,
        });
        totalAmount += amount;
      }

      if (workItemsWithAmounts.length > 0) {
        record.workItems = workItemsWithAmounts;
      }
    }

    const workSum = (record.workItems || []).reduce((s: number, wi: { amount?: number }) => s + (wi.amount || 0), 0);
    record.totalAmount = roundAmount(workSum + (record.otAmount || 0));

    await record.save();
    const updated = await WorkRecord.findById(id)
      .populate('employee', 'name')
      .populate('branch', 'name')
      .populate('styleOrder', 'styleCode brand colours _id')
      .lean();

    const empId = String(record.employee);
    const empName = (updated?.employee as { name?: string })?.name || 'Employee';
    notifyEmployee(empId, {
      type: 'work_record_updated',
      title: 'Work record updated',
      message: `Your work record for ${record.month} has been updated. New total: ₹${record.totalAmount.toLocaleString()}`,
      link: '/work-records',
      metadata: { entityId: id, entityType: 'work_record', employeeId: empId, employeeName: empName, month: record.month, amount: record.totalAmount },
    }).catch(() => {});
    notifyAdminsIfNeeded(user, {
      type: 'work_record_updated',
      title: 'Work record updated',
      message: `${user.role} updated work record for ${empName} (${record.month}). Amount: ₹${record.totalAmount.toLocaleString()}`,
      link: '/work-records',
      metadata: { entityId: id, entityType: 'work_record', actorId: user.userId, actorRole: user.role, employeeId: empId, employeeName: empName, month: record.month, amount: record.totalAmount },
    }).catch(() => {});

    logAudit({
      user,
      action: 'work_record_update',
      entityType: 'work_record',
      entityId: id,
      summary: `Work record updated for ${empName} (${record.month}) - ₹${record.totalAmount.toLocaleString()}`,
      metadata: { employeeId: empId, employeeName: empName, month: record.month, amount: record.totalAmount },
      req,
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); // accountancy is read-only

    const { id } = await params;
    await connectDB();
    const record = await WorkRecord.findById(id).populate('employee', 'name').lean();
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const empObj = record.employee as { _id?: unknown; name?: string } | undefined;
    const empId = empObj && typeof empObj === 'object' && '_id' in empObj ? String(empObj._id) : String(record.employee);
    const empName = empObj?.name || 'Employee';
    await WorkRecord.findByIdAndDelete(id);

    notifyEmployee(empId, {
      type: 'work_record_deleted',
      title: 'Work record deleted',
      message: `Your work record for ${record.month} has been deleted.`,
      link: '/work-records',
      metadata: { entityId: id, entityType: 'work_record', employeeId: empId, employeeName: empName, month: record.month },
    }).catch(() => {});
    notifyAdminsIfNeeded(user, {
      type: 'work_record_deleted',
      title: 'Work record deleted',
      message: `${user.role} deleted work record for ${empName} (${record.month}).`,
      link: '/work-records',
      metadata: { entityId: id, entityType: 'work_record', actorId: user.userId, actorRole: user.role, employeeId: empId, employeeName: empName, month: record.month },
    }).catch(() => {});

    logAudit({
      user,
      action: 'work_record_delete',
      entityType: 'work_record',
      entityId: id,
      summary: `Work record deleted for ${empName} (${record.month})`,
      metadata: { employeeId: empId, employeeName: empName, month: record.month },
      req,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
