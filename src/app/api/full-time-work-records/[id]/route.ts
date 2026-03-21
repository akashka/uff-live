import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import FullTimeWorkRecord from '@/lib/models/FullTimeWorkRecord';
import Employee from '@/lib/models/Employee';
import { getAuthUser, hasRole } from '@/lib/auth';
import { canAccessBranch, getUserBranchScope } from '@/lib/branchAccess';
import { roundAmount } from '@/lib/utils';

function getWorkingDaysInMonth(monthStr: string): number {
  const [y, m] = monthStr.split('-').map(Number);
  let workingDays = 0;
  const lastDay = new Date(y, m, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const day = new Date(y, m - 1, d);
    if (day.getDay() !== 0) workingDays++;
  }
  return workingDays;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await connectDB();
    const record = await FullTimeWorkRecord.findById(id)
      .populate({ path: 'employee', select: 'name _id overtimeCostPerHour monthlySalary dailySalary' })
      .populate('branch', 'name _id')
      .lean();

    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const scope = await getUserBranchScope(user);
    const recordBranchId =
      record.branch && typeof record.branch === 'object' && '_id' in (record.branch as unknown as Record<string, unknown>)
        ? String((record.branch as { _id: unknown })._id)
        : String(record.branch ?? '');
    if (!canAccessBranch(scope, recordBranchId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(record);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await req.json();
    const { daysWorked, otHours, notes } = body;

    await connectDB();
    const existing = await FullTimeWorkRecord.findById(id).lean();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const scope = await getUserBranchScope(user);
    if (!canAccessBranch(scope, String((existing as { branch?: unknown }).branch ?? ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const monthStr = (existing as { month: string }).month;
    const employeeId = (existing as { employee: unknown }).employee?.toString?.() || String((existing as { employee: unknown }).employee);
    const workingDays = getWorkingDaysInMonth(monthStr);

    const otherRecords = await FullTimeWorkRecord.find({
      employee: employeeId,
      month: monthStr,
      _id: { $ne: id },
    }).lean();
    const totalDaysOthers = otherRecords.reduce((s, r) => s + ((r as { daysWorked?: number }).daysWorked || 0), 0);
    const maxAllowed = Math.max(0, workingDays - totalDaysOthers);

    const days = daysWorked != null ? Math.max(0, Math.min(maxAllowed, Number(daysWorked) || 0)) : (existing as { daysWorked?: number }).daysWorked ?? 0;
    const otH = otHours != null ? Math.max(0, Number(otHours) || 0) : (existing as { otHours?: number }).otHours ?? 0;

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const emp = employee as { monthlySalary?: number; dailySalary?: number; overtimeCostPerHour?: number };
    let baseAmount = 0;
    if (emp.monthlySalary && emp.monthlySalary > 0) {
      baseAmount = roundAmount((emp.monthlySalary / workingDays) * days);
    } else if (emp.dailySalary && emp.dailySalary > 0) {
      baseAmount = roundAmount(emp.dailySalary * days);
    }
    const otAmount = roundAmount((emp.overtimeCostPerHour || 0) * otH);
    const totalAmount = roundAmount(baseAmount + otAmount);

    const updated = await FullTimeWorkRecord.findByIdAndUpdate(
      id,
      { daysWorked: days, otHours: otH, otAmount, totalAmount, notes: notes ?? (existing as { notes?: string }).notes },
      { new: true }
    )
      .populate({ path: 'employee', select: 'name _id' })
      .populate('branch', 'name _id')
      .lean();

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    await connectDB();
    const scope = await getUserBranchScope(user);
    const existing = await FullTimeWorkRecord.findById(id).lean();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (!canAccessBranch(scope, String((existing as { branch?: unknown }).branch ?? ''))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const deleted = await FullTimeWorkRecord.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
