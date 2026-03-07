import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import Employee from '@/lib/models/Employee';
import RateMaster from '@/lib/models/RateMaster';
import StyleOrder from '@/lib/models/StyleOrder';
import { getAuthUser, hasRole } from '@/lib/auth';
import { notifyAdminsIfNeeded, notifyEmployee } from '@/lib/notifications';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const branchId = searchParams.get('branchId');
    const month = searchParams.get('month');

    let filter: Record<string, unknown> = {};

    if (employeeId) {
      if (hasRole(user, ['admin', 'finance', 'hr'])) {
        filter = { employee: employeeId };
      } else if (user.employeeId && String(user.employeeId) === String(employeeId)) {
        filter = { employee: employeeId };
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (user.employeeId) {
      filter = { employee: user.employeeId };
    } else if (hasRole(user, ['admin', 'finance', 'hr'])) {
      filter = {};
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (branchId) filter = { ...filter, branch: branchId };
    if (month) filter = { ...filter, month: String(month).slice(0, 7) };

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      WorkRecord.find(filter)
        .populate('employee', 'name _id')
        .populate('branch', 'name _id')
        .populate('styleOrder', 'styleCode _id')
        .sort({ month: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      WorkRecord.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: records,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

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

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { employeeId, branchId, month, styleOrderId, workItems, notes, otHours, otAmount } = body;

    if (!employeeId || !branchId || !month || !Array.isArray(workItems)) {
      return NextResponse.json({ error: 'Employee, branch, month and work items required' }, { status: 400 });
    }

    const monthStr = String(month).slice(0, 7);

    await connectDB();

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    if (employee.employeeType !== 'contractor') {
      return NextResponse.json({ error: 'Work records are for contractor employees only' }, { status: 400 });
    }

    const branchIds = (employee.branches || []).map((b: unknown) => (typeof b === 'object' && b && '_id' in b ? (b as { _id: { toString: () => string } })._id.toString() : String(b)));
    if (!branchIds.includes(branchId)) {
      return NextResponse.json({ error: 'Employee is not associated with this branch' }, { status: 400 });
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
          (typeof br.branch === 'object' ? br.branch?.toString?.() : String(br.branch)) === branchId
      );
      const ratePerUnit = branchRate?.amount ?? 0;
      const quantity = Number(item.quantity) || 0;
      const multiplier = Number(item.multiplier) || 1;

      if (styleOrderId && quantity > 0) {
        const available = await getAvailableQuantity(styleOrderId, branchId, monthStr, item.rateMasterId);
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

    if (workItemsWithAmounts.length === 0) {
      return NextResponse.json({ error: 'No valid work items' }, { status: 400 });
    }

    const otAmt = Number(otAmount) || 0;
    const finalTotal = totalAmount + otAmt;

    const record = await WorkRecord.create({
      employee: employeeId,
      branch: branchId,
      month: monthStr,
      styleOrder: styleOrderId || undefined,
      workItems: workItemsWithAmounts,
      otHours: Number(otHours) || 0,
      otAmount: otAmt,
      totalAmount: finalTotal,
      notes: notes || '',
    });

    const populated = await WorkRecord.findById(record._id)
      .populate('employee', 'name _id')
      .populate('branch', 'name _id')
      .populate('styleOrder', 'styleCode _id')
      .lean();

    const empName = (populated?.employee as { name?: string })?.name || 'Employee';
    const branchName = (populated?.branch as { name?: string })?.name || '';

    notifyEmployee(employeeId, {
      type: 'work_record_created',
      title: 'Work record created',
      message: `A work record has been created for you for ${monthStr}${branchName ? ` (${branchName})` : ''}. Total: ₹${finalTotal.toLocaleString()}`,
      link: '/work-records',
      metadata: { entityId: String(record._id), entityType: 'work_record', employeeId, employeeName: empName, month: monthStr, amount: finalTotal },
    }).catch(() => {});

    notifyAdminsIfNeeded(user, {
      type: 'work_record_created',
      title: 'Work record created',
      message: `${user.role} created a work record for ${empName} for ${monthStr}. Amount: ₹${finalTotal.toLocaleString()}`,
      link: `/work-records`,
      metadata: { entityId: String(record._id), entityType: 'work_record', actorId: user.userId, actorRole: user.role, employeeId, employeeName: empName, month: monthStr, amount: finalTotal },
    }).catch(() => {});

    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
