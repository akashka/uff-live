import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import Employee from '@/lib/models/Employee';
import RateMaster from '@/lib/models/RateMaster';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await connectDB();
    const record = await WorkRecord.findById(id)
      .populate('employee', 'name _id')
      .populate('branch', 'name _id')
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

    const { employeeId, branchId, periodStart, periodEnd, workItems, notes, otHours, otAmount } = body;

    if (periodStart !== undefined) record.periodStart = new Date(periodStart);
    if (periodEnd !== undefined) record.periodEnd = new Date(periodEnd);
    if (notes !== undefined) record.notes = notes;
    if (otHours !== undefined) record.otHours = Number(otHours) || 0;
    if (otAmount !== undefined) record.otAmount = Number(otAmount) || 0;

    if (workItems && Array.isArray(workItems) && workItems.length > 0) {
      const empId = employeeId || record.employee?.toString();
      const branch = branchId || record.branch?.toString();
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
