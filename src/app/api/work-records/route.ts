import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import Employee from '@/lib/models/Employee';
import RateMaster from '@/lib/models/RateMaster';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');

    let filter: Record<string, unknown> = {};

    if (employeeId) {
      if (hasRole(user, ['admin', 'finance', 'hr'])) {
        filter = { employee: employeeId };
      } else if (user.employeeId === employeeId) {
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

    if (periodStart) filter = { ...filter, periodEnd: { $gte: new Date(periodStart) } };
    if (periodEnd) filter = { ...filter, periodStart: { $lte: new Date(periodEnd) } };

    const records = await WorkRecord.find(filter)
      .populate('employee', 'name _id')
      .populate('branch', 'name _id')
      .sort({ periodEnd: -1 })
      .lean();
    return NextResponse.json(records);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { employeeId, branchId, periodStart, periodEnd, workItems, notes, otHours, otAmount } = body;

    if (!employeeId || !branchId || !periodStart || !periodEnd || !Array.isArray(workItems)) {
      return NextResponse.json({ error: 'Employee, branch, period and work items required' }, { status: 400 });
    }

    await connectDB();

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    if (employee.employeeType !== 'contractor') {
      return NextResponse.json({ error: 'Work records are for contractor employees only' }, { status: 400 });
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
      const amount = quantity * multiplier * ratePerUnit;

      workItemsWithAmounts.push({
        rateMaster: item.rateMasterId,
        rateName: (rateMaster as { name: string }).name,
        unit: (rateMaster as { unit: string }).unit,
        quantity,
        multiplier,
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
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      workItems: workItemsWithAmounts,
      otHours: Number(otHours) || 0,
      otAmount: otAmt,
      totalAmount: finalTotal,
      notes: notes || '',
    });

    const populated = await WorkRecord.findById(record._id)
      .populate('employee', 'name _id')
      .populate('branch', 'name _id')
      .lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
