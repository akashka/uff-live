import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import Employee from '@/lib/models/Employee';
import RateMaster from '@/lib/models/RateMaster';
import StyleOrder from '@/lib/models/StyleOrder';
import { getAuthUser, hasRole } from '@/lib/auth';

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
  const monthData = (styleOrder.monthWiseData as { month: string; totalOrderQuantity: number }[])?.find(
    (m) => m.month === monthStr
  );
  const totalOrderQty = monthData?.totalOrderQuantity ?? 0;

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
      .populate('styleOrder', 'styleCode _id')
      .lean();
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const emp = record.employee as { _id?: unknown } | undefined;
    const empId = emp && typeof emp === 'object' && '_id' in emp ? String(emp._id) : String(record.employee);
    const canAccess = hasRole(user, ['admin', 'finance', 'hr']) || (user.employeeId && String(user.employeeId) === empId);
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
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    await connectDB();
    const record = await WorkRecord.findById(id);
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { employeeId, branchId, month, styleOrderId, workItems, notes, otHours, otAmount } = body;

    if (month !== undefined) record.month = String(month).slice(0, 7);
    if (notes !== undefined) record.notes = notes;
    if (otHours !== undefined) record.otHours = Number(otHours) || 0;
    if (otAmount !== undefined) record.otAmount = Number(otAmount) || 0;
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

      const workItemsWithAmounts = [];
      let totalAmount = 0;

      for (const item of workItems) {
        const rateMaster = rateMasters.find((r: { _id: { toString: () => string } }) => r._id.toString() === item.rateMasterId);
        if (!rateMaster) continue;

        const branchRate = (rateMaster as { branchRates: { branch: { toString?: () => string }; amount: number }[] }).branchRates?.find(
          (br: { branch: { toString?: () => string }; amount: number }) =>
            (typeof br.branch === 'object' ? br.branch?.toString?.() : String(br.branch)) === branch
        );
        const ratePerUnit = branchRate?.amount ?? 0;
        const quantity = Number(item.quantity) || 0;
        const multiplier = Number(item.multiplier) || 1;

        if (styleId && quantity > 0) {
          const available = await getAvailableQuantity(styleId, String(branch), monthStr, item.rateMasterId, id);
          if (quantity > available) {
            return NextResponse.json(
              { error: `Quantity ${quantity} exceeds available ${available} for this rate. Reduce and try again.` },
              { status: 400 }
            );
          }
        }

        const amount = quantity * multiplier * ratePerUnit;
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
    record.totalAmount = workSum + (record.otAmount || 0);

    await record.save();
    const updated = await WorkRecord.findById(id)
      .populate('employee', 'name')
      .populate('branch', 'name')
      .populate('styleOrder', 'styleCode _id')
      .lean();
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
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await connectDB();
    const record = await WorkRecord.findByIdAndDelete(id);
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
