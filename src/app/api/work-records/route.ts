import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import Employee from '@/lib/models/Employee';
import RateMaster from '@/lib/models/RateMaster';
import StyleOrder from '@/lib/models/StyleOrder';
import { getAuthUser, hasRole } from '@/lib/auth';
import { notifyAdminsIfNeeded, notifyEmployee } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';
import { roundAmount } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const branchId = searchParams.get('branchId');
    const departmentId = searchParams.get('departmentId');
    const month = searchParams.get('month');

    let filter: Record<string, unknown> = {};

    if (employeeId) {
      if (hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) {
        filter = { employee: employeeId };
      } else if (user.employeeId && String(user.employeeId) === String(employeeId)) {
        filter = { employee: employeeId };
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (user.employeeId) {
      filter = { employee: user.employeeId };
    } else if (hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) {
      filter = {};
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (branchId) filter = { ...filter, branch: branchId };
    if (month) filter = { ...filter, month: String(month).slice(0, 7) };

    if (departmentId && hasRole(user, ['admin', 'finance', 'accountancy', 'hr']) && !employeeId && !user.employeeId) {
      const employeesInDept = await Employee.find({ department: departmentId }).select('_id').lean();
      const empIds = employeesInDept.map((e) => e._id);
      filter = { ...filter, employee: { $in: empIds } };
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      WorkRecord.find(filter)
        .populate({ path: 'employee', select: 'name _id department', populate: { path: 'department', select: 'name _id' } })
        .populate('branch', 'name _id')
        .populate('styleOrder', 'styleCode brand colours _id')
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
  const so = styleOrder as { month?: string; totalOrderQuantity?: number };
  const totalOrderQty = so.month === monthStr ? (so.totalOrderQuantity ?? 0) : 0;

  const producedFilter: Record<string, unknown> = {
    styleOrder: styleOrderId,
    branch: branchId,
    month: monthStr,
  };
  if (excludeWorkRecordId) producedFilter._id = { $ne: excludeWorkRecordId };

  const [producedFromWorkRecords, producedFromVendorOrders] = await Promise.all([
    WorkRecord.aggregate([
      { $match: producedFilter },
      { $unwind: '$workItems' },
      { $match: { 'workItems.rateMaster': { $eq: new mongoose.Types.ObjectId(rateMasterId) } } },
      { $group: { _id: null, total: { $sum: '$workItems.quantity' } } },
    ]),
    VendorWorkOrder.aggregate([
      {
        $match: {
          styleOrder: new mongoose.Types.ObjectId(styleOrderId),
          branch: new mongoose.Types.ObjectId(branchId),
          month: monthStr,
        },
      },
      { $unwind: '$workItems' },
      { $match: { 'workItems.rateMaster': { $eq: new mongoose.Types.ObjectId(rateMasterId) } } },
      { $group: { _id: null, total: { $sum: '$workItems.quantity' } } },
    ]),
  ]);
  const producedQty = (producedFromWorkRecords[0]?.total ?? 0) + (producedFromVendorOrders[0]?.total ?? 0);
  return Math.max(0, totalOrderQty - producedQty);
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { employeeId, branchId, month, styleOrderId, colour, workItems, notes, otHours, otAmount } = body;

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
    const departmentId = (employee.department && typeof employee.department === 'object' && (employee.department as { _id?: unknown })._id)
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
          return bid === branchId && did === departmentId;
        });
        defaultRate = match?.amount ?? 0;
      }
      if (defaultRate === 0 && br?.length) {
        const branchRate = br.find((b) => (typeof b.branch === 'object' ? (b.branch as { toString?: () => string })?.toString?.() : String(b.branch)) === branchId);
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

    if (workItemsWithAmounts.length === 0) {
      return NextResponse.json({ error: 'No valid work items' }, { status: 400 });
    }

    const otAmt = roundAmount(Number(otAmount) || 0);
    const finalTotal = roundAmount(totalAmount + otAmt);

    const record = await WorkRecord.create({
      employee: employeeId,
      branch: branchId,
      month: monthStr,
      styleOrder: styleOrderId,
      colour: colour ? String(colour).trim() : undefined,
      workItems: workItemsWithAmounts,
      otHours: Number(otHours) || 0,
      otAmount: otAmt,
      totalAmount: finalTotal,
      notes: notes || '',
    });

    const populated = await WorkRecord.findById(record._id)
      .populate({ path: 'employee', select: 'name _id department', populate: { path: 'department', select: 'name _id' } })
      .populate('branch', 'name _id')
      .populate('styleOrder', 'styleCode brand colours _id')
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

    logAudit({
      user,
      action: 'work_record_create',
      entityType: 'work_record',
      entityId: String(record._id),
      summary: `Work record created for ${empName} (${monthStr}) - ₹${finalTotal.toLocaleString()}`,
      metadata: { employeeId, employeeName: empName, month: monthStr, amount: finalTotal },
      req,
    }).catch(() => {});

    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
