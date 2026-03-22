import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import FullTimeWorkRecord from '@/lib/models/FullTimeWorkRecord';
import Payment from '@/lib/models/Payment';
import Employee from '@/lib/models/Employee';
import { getAuthUser, hasRole } from '@/lib/auth';
import { roundAmount, roundDays } from '@/lib/utils';

/** Check if PF/ESI/other already deducted for this employee in this month (salary payments only) */
async function getDeductionsAlreadyApplied(employeeId: string, monthStr: string) {
  const payments = await Payment.find({
    employee: employeeId,
    month: monthStr,
    isAdvance: false,
    paymentType: { $in: ['contractor', 'full_time'] },
  })
    .select('pfDeducted esiDeducted otherDeducted')
    .lean();
  const pf = roundAmount((payments || []).reduce((s, p) => s + ((p as { pfDeducted?: number }).pfDeducted ?? 0), 0));
  const esi = roundAmount((payments || []).reduce((s, p) => s + ((p as { esiDeducted?: number }).esiDeducted ?? 0), 0));
  const other = roundAmount((payments || []).reduce((s, p) => s + ((p as { otherDeducted?: number }).otherDeducted ?? 0), 0));
  return { pf, esi, other };
}

/** Get work record IDs already paid for this employee in this month */
async function getPaidWorkRecordIds(employeeId: string, monthStr: string) {
  const payments = await Payment.find({
    employee: employeeId,
    month: monthStr,
    isAdvance: false,
    paymentType: 'contractor',
    'workRecordRefs.0': { $exists: true },
  })
    .select('workRecordRefs.workRecord')
    .lean();
  const ids = new Set<string>();
  for (const p of payments || []) {
    const refs = (p as { workRecordRefs?: { workRecord?: unknown }[] }).workRecordRefs || [];
    for (const ref of refs) {
      const id = ref.workRecord;
      if (id) ids.add(String(id));
    }
  }
  return Array.from(ids);
}

/** Get full-time work record IDs already paid for this employee in this month */
async function getPaidFullTimeWorkRecordIds(employeeId: string, monthStr: string) {
  const payments = await Payment.find({
    employee: employeeId,
    month: monthStr,
    isAdvance: false,
    paymentType: 'full_time',
    'fullTimeWorkRecordRefs.0': { $exists: true },
  })
    .select('fullTimeWorkRecordRefs.fullTimeWorkRecord')
    .lean();
  const ids = new Set<string>();
  for (const p of payments || []) {
    const refs = (p as { fullTimeWorkRecordRefs?: { fullTimeWorkRecord?: unknown }[] }).fullTimeWorkRecordRefs || [];
    for (const ref of refs) {
      const id = ref.fullTimeWorkRecord;
      if (id) ids.add(String(id));
    }
  }
  return Array.from(ids);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');
    const type = searchParams.get('type');
    const selectedIdsParam = searchParams.get('selectedWorkRecordIds'); // comma-separated for contractor
    const selectedFtIdsParam = searchParams.get('selectedFullTimeWorkRecordIds'); // comma-separated for full_time

    if (!employeeId || !month || !type) {
      return NextResponse.json({ error: 'employeeId, month, type required' }, { status: 400 });
    }

    const monthStr = String(month).slice(0, 7); // YYYY-MM

    await connectDB();

    const emp = await Employee.findById(employeeId).lean();
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    // Working days in month (excluding Sundays)
    const [y, m] = monthStr.split('-').map(Number);
    const lastDay = new Date(y, m, 0);
    let totalWorkingDays = 0;
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const day = new Date(y, m - 1, d);
      if (day.getDay() !== 0) totalWorkingDays++;
    }
    const twd = roundDays(totalWorkingDays);

    const legacyOther = (emp.salaryBreakup as { other?: number } | undefined)?.other ?? 0;
    const otherTotal = roundAmount(
      (Array.isArray(emp.otherDeductions) ? emp.otherDeductions.reduce((s: number, d: { amount?: number }) => s + (d.amount || 0), 0) : 0) +
      legacyOther
    );

    if (type === 'contractor') {
      const allWorkRecords = await WorkRecord.find({
        employee: employeeId,
        month: monthStr,
      })
        .populate('branch', 'name')
        .populate('styleOrder', 'styleCode brand colour')
        .sort({ month: 1, createdAt: 1 })
        .lean();

      const paidIds = await getPaidWorkRecordIds(employeeId, monthStr);
      const workRecordsWithPaid = (allWorkRecords || []).map((r) => {
        const rid = (r as { _id?: mongoose.Types.ObjectId })._id;
        const idStr = rid ? String(rid) : '';
        const workItems = (r as { workItems?: { rateOverrideApproved?: boolean }[] }).workItems || [];
        const isPendingApproval = workItems.some((wi: { rateOverrideApproved?: boolean }) => wi.rateOverrideApproved === false);
        return {
          ...r,
          isPaid: paidIds.includes(idStr),
          isPendingApproval,
        };
      });

      const selectedIds = selectedIdsParam ? selectedIdsParam.split(',').filter(Boolean) : null;
      const recordsToSum = selectedIds
        ? workRecordsWithPaid.filter((r) => selectedIds.includes(String((r as { _id?: unknown })._id)))
        : workRecordsWithPaid.filter((r) => !(r as { isPaid?: boolean }).isPaid && !(r as { isPendingApproval?: boolean }).isPendingApproval);

      const totalWorkAmount = roundAmount(recordsToSum.reduce((sum, r) => sum + (r.totalAmount || 0), 0));

      const { pf: pfAlready, esi: esiAlready, other: otherAlready } = await getDeductionsAlreadyApplied(employeeId, monthStr);
      const pfTotal = roundAmount(emp.pfOpted && emp.monthlyPfAmount ? emp.monthlyPfAmount : 0);
      const esiTotal = roundAmount(emp.esiOpted && emp.monthlyEsiAmount ? emp.monthlyEsiAmount : 0);
      const pfToDeduct = Math.max(0, pfTotal - pfAlready);
      const esiToDeduct = Math.max(0, esiTotal - esiAlready);
      const otherToDeduct = Math.max(0, otherTotal - otherAlready);

      return NextResponse.json({
        type: 'contractor',
        workRecords: workRecordsWithPaid,
        totalWorkAmount,
        pfOpted: emp.pfOpted,
        monthlyPfAmount: emp.monthlyPfAmount,
        pfToDeduct,
        esiOpted: emp.esiOpted,
        monthlyEsiAmount: emp.monthlyEsiAmount,
        esiToDeduct,
        otherToDeduct,
        baseAmount: totalWorkAmount,
      });
    }

    if (type === 'full_time') {
      const monthlySalary = roundAmount(emp.monthlySalary || 0);
      const dailySalary = roundAmount(emp.dailySalary || 0);
      const salaryBasis = monthlySalary > 0 ? 'monthly' : 'daily';
      const pfTotal = roundAmount(emp.salaryBreakup?.pf || 0);
      const esiTotal = roundAmount(emp.salaryBreakup?.esi || 0);
      const { pf: pfAlready, esi: esiAlready, other: otherAlready } = await getDeductionsAlreadyApplied(employeeId, monthStr);
      const pf = Math.max(0, pfTotal - pfAlready);
      const esi = Math.max(0, esiTotal - esiAlready);
      const other = Math.max(0, otherTotal - otherAlready);
      const totalDeductions = roundAmount(pf + esi + other);
      const overtimeCostPerHour = roundAmount(emp.overtimeCostPerHour || 0);

      const allFtRecords = await FullTimeWorkRecord.find({ employee: employeeId, month: monthStr })
        .populate('branch', 'name')
        .sort({ createdAt: 1 })
        .lean();

      const paidFtIds = await getPaidFullTimeWorkRecordIds(employeeId, monthStr);
      const fullTimeWorkRecordsWithPaid = (allFtRecords || []).map((r) => {
        const rid = (r as { _id?: mongoose.Types.ObjectId })._id;
        const idStr = rid ? String(rid) : '';
        return {
          ...r,
          isPaid: paidFtIds.includes(idStr),
        };
      });

      const selectedFtIds = selectedFtIdsParam ? selectedFtIdsParam.split(',').filter(Boolean) : null;
      const recordsToSum = selectedFtIds
        ? fullTimeWorkRecordsWithPaid.filter((r) => selectedFtIds.includes(String((r as { _id?: unknown })._id)))
        : fullTimeWorkRecordsWithPaid.filter((r) => !(r as { isPaid?: boolean }).isPaid);

      const totalDaysWorked = roundDays(recordsToSum.reduce((s: number, r: { daysWorked?: number }) => s + (r.daysWorked ?? 0), 0));
      const totalOtHours = roundAmount(recordsToSum.reduce((s: number, r: { otHours?: number }) => s + (r.otHours ?? 0), 0));
      const totalOtAmount = roundAmount(recordsToSum.reduce((s: number, r: { otAmount?: number }) => s + (r.otAmount ?? 0), 0));

      let gross = 0;
      let baseAmount = 0;
      if (totalDaysWorked > 0) {
        if (salaryBasis === 'monthly') {
          gross = roundAmount((monthlySalary / twd) * totalDaysWorked);
        } else {
          gross = roundAmount(dailySalary * totalDaysWorked);
        }
        baseAmount = roundAmount(gross - totalDeductions);
      }

      return NextResponse.json({
        type: 'full_time',
        salaryBasis,
        baseAmount,
        grossSalary: gross,
        monthlySalary,
        dailySalary,
        pf,
        esi,
        other,
        totalDeductions,
        totalWorkingDays: twd,
        daysWorked: totalDaysWorked,
        otHours: totalOtHours,
        otAmount: totalOtAmount,
        overtimeCostPerHour,
        fullTimeWorkRecords: fullTimeWorkRecordsWithPaid,
      });
    }

    return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
