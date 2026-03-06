import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import Payment from '@/lib/models/Payment';
import Employee from '@/lib/models/Employee';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const periodStart = searchParams.get('periodStart');
    const periodEnd = searchParams.get('periodEnd');
    const type = searchParams.get('type');

    if (!employeeId || !periodStart || !periodEnd || !type) {
      return NextResponse.json({ error: 'employeeId, periodStart, periodEnd, type required' }, { status: 400 });
    }

    await connectDB();

    const emp = await Employee.findById(employeeId).lean();
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    if (type === 'contractor') {
      const workRecords = await WorkRecord.find({
        employee: employeeId,
        periodStart: { $lte: new Date(periodEnd) },
        periodEnd: { $gte: new Date(periodStart) },
      })
        .populate('branch', 'name')
        .sort({ periodStart: 1 })
        .lean();

      const totalWorkAmount = workRecords.reduce((sum, r) => sum + (r.totalAmount || 0), 0);
      const pfToDeduct = emp.pfOpted && emp.monthlyPfAmount ? emp.monthlyPfAmount : 0;
      const esiToDeduct = emp.esiOpted && emp.monthlyEsiAmount ? emp.monthlyEsiAmount : 0;

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
      const gross = emp.monthlySalary || 0;
      const deductions = (emp.salaryBreakup?.pf || 0) + (emp.salaryBreakup?.esi || 0) + (emp.salaryBreakup?.other || 0);
      const baseAmount = gross - deductions;

      return NextResponse.json({
        type: 'full_time',
        baseAmount,
        grossSalary: gross,
        deductions,
      });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
