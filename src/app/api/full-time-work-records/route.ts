import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import FullTimeWorkRecord from '@/lib/models/FullTimeWorkRecord';
import Employee from '@/lib/models/Employee';
import { getAuthUser, hasRole } from '@/lib/auth';
import { roundAmount } from '@/lib/utils';

function getWorkingDaysInMonth(monthStr: string): number {
  const [y, m] = monthStr.split('-').map(Number);
  const date = new Date(y, m - 1, 1);
  let workingDays = 0;
  const lastDay = new Date(y, m, 0).getDate();
  for (let d = 1; d <= lastDay; d++) {
    const day = new Date(y, m - 1, d);
    if (day.getDay() !== 0) workingDays++; // exclude Sunday
  }
  return workingDays;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const branchId = searchParams.get('branchId');
    const month = searchParams.get('month');

    const filter: Record<string, unknown> = {};
    if (employeeId) filter.employee = employeeId;
    if (branchId) filter.branch = branchId;
    if (month) filter.month = String(month).slice(0, 7);

    const records = await FullTimeWorkRecord.find(filter)
      .populate({ path: 'employee', select: 'name _id overtimeCostPerHour monthlySalary dailySalary' })
      .populate('branch', 'name _id')
      .sort({ month: -1, createdAt: -1 })
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
    const { employeeId, branchId, month, daysWorked, otHours, notes } = body;

    if (!employeeId || !branchId || !month) {
      return NextResponse.json({ error: 'Employee, branch and month required' }, { status: 400 });
    }

    const monthStr = String(month).slice(0, 7);
    const workingDays = getWorkingDaysInMonth(monthStr);
    const days = Math.max(0, Math.min(workingDays, Number(daysWorked) || 0));
    const otH = Math.max(0, Number(otHours) || 0);

    await connectDB();

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    if ((employee as { employeeType?: string }).employeeType !== 'full_time') {
      return NextResponse.json({ error: 'Full-time work records are for full-time employees only' }, { status: 400 });
    }

    // Check total days already entered for this employee in this month
    const existing = await FullTimeWorkRecord.find({ employee: employeeId, month: monthStr }).lean();
    const totalDaysEntered = existing.reduce((s, r) => s + ((r as { daysWorked?: number }).daysWorked || 0), 0);
    const maxAllowed = Math.max(0, workingDays - totalDaysEntered);
    if (days > maxAllowed) {
      return NextResponse.json(
        { error: `Maximum ${maxAllowed} days allowed (${totalDaysEntered} already entered, ${workingDays} working days in month)` },
        { status: 400 }
      );
    }

    const branchIds = ((employee as { branches?: unknown[] }).branches || []).map((b: unknown) =>
      typeof b === 'object' && b && '_id' in b ? (b as { _id: { toString: () => string } })._id.toString() : String(b)
    );
    if (!branchIds.includes(branchId)) {
      return NextResponse.json({ error: 'Employee is not associated with this branch' }, { status: 400 });
    }

    const emp = employee as { monthlySalary?: number; dailySalary?: number; overtimeCostPerHour?: number };
    let baseAmount = 0;
    if (emp.monthlySalary && emp.monthlySalary > 0) {
      baseAmount = roundAmount((emp.monthlySalary / workingDays) * days);
    } else if (emp.dailySalary && emp.dailySalary > 0) {
      baseAmount = roundAmount(emp.dailySalary * days);
    }
    const otAmount = roundAmount((emp.overtimeCostPerHour || 0) * otH);
    const totalAmount = roundAmount(baseAmount + otAmount);

    const record = await FullTimeWorkRecord.create({
      employee: employeeId,
      branch: branchId,
      month: monthStr,
      daysWorked: days,
      otHours: otH,
      otAmount,
      totalAmount,
      notes: notes || '',
    });

    const populated = await FullTimeWorkRecord.findById(record._id)
      .populate({ path: 'employee', select: 'name _id' })
      .populate('branch', 'name _id')
      .lean();

    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
