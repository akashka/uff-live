import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import Payment from '@/lib/models/Payment';
import Employee from '@/lib/models/Employee';
import { getAuthUser, hasRole } from '@/lib/auth';
import { roundAmount, roundDays } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');
    const type = searchParams.get('type');

    if (!employeeId || !month || !type) {
      return NextResponse.json({ error: 'employeeId, month, type required' }, { status: 400 });
    }

    const monthStr = String(month).slice(0, 7); // YYYY-MM

    await connectDB();

    const emp = await Employee.findById(employeeId).lean();
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    if (type === 'contractor') {
      const workRecords = await WorkRecord.find({
        employee: employeeId,
        month: monthStr,
      })
        .populate('branch', 'name')
        .populate('styleOrder', 'styleCode brand')
        .sort({ month: 1 })
        .lean();

      const totalWorkAmount = roundAmount(workRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0));
      const pfToDeduct = roundAmount(emp.pfOpted && emp.monthlyPfAmount ? emp.monthlyPfAmount : 0);
      const esiToDeduct = roundAmount(emp.esiOpted && emp.monthlyEsiAmount ? emp.monthlyEsiAmount : 0);

      return NextResponse.json({
        type: 'contractor',
        workRecords,
        totalWorkAmount,
        pfOpted: emp.pfOpted,
        monthlyPfAmount: emp.monthlyPfAmount,
        pfToDeduct,
        esiOpted: emp.esiOpted,
        monthlyEsiAmount: emp.monthlyEsiAmount,
        esiToDeduct,
        baseAmount: totalWorkAmount,
      });
    }

    if (type === 'full_time') {
      const gross = roundAmount(emp.monthlySalary || 0);
      const pf = roundAmount(emp.salaryBreakup?.pf || 0);
      const esi = roundAmount(emp.salaryBreakup?.esi || 0);
      const other = roundAmount(emp.salaryBreakup?.other || 0);
      const totalDeductions = roundAmount(pf + esi + other);
      const baseAmount = roundAmount(gross - totalDeductions);

      // Working days in month (excluding Sundays)
      const [y, m] = monthStr.split('-').map(Number);
      const lastDay = new Date(y, m, 0);
      let totalWorkingDays = 0;
      for (let d = 1; d <= lastDay.getDate(); d++) {
        const day = new Date(y, m - 1, d);
        if (day.getDay() !== 0) totalWorkingDays++;
      }

      return NextResponse.json({
        type: 'full_time',
        baseAmount,
        grossSalary: gross,
        pf,
        esi,
        other,
        totalDeductions,
        totalWorkingDays: roundDays(totalWorkingDays),
      });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
