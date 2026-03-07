import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { formatDate } from '@/lib/utils';

function getISOWeek(d: Date): { year: number; week: number } {
  const t = new Date(d);
  const day = (t.getDay() + 6) % 7;
  t.setDate(t.getDate() - day + 3);
  const firstThu = new Date(t.getFullYear(), 0, 4);
  const week = 1 + Math.round(((t.getTime() - firstThu.getTime()) / 86400000 - 3 + ((firstThu.getDay() + 6) % 7)) / 7);
  return { year: t.getFullYear(), week };
}
import Employee from '@/lib/models/Employee';
import Branch from '@/lib/models/Branch';
import Payment from '@/lib/models/Payment';
import WorkRecord from '@/lib/models/WorkRecord';
import StyleOrder from '@/lib/models/StyleOrder';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '1'; // months: 1=current month, 3=last 3 months, 6=last 6 months
    const months = parseInt(range, 10) || 1;

    const isAdmin = hasRole(user, ['admin']);
    const isFinance = hasRole(user, ['admin', 'finance']);
    const isHR = hasRole(user, ['admin', 'finance', 'hr']);
    const isEmployee = user.employeeId;

    const stats: Record<string, unknown> = {};
    const now = new Date();

    if (isHR || isAdmin) {
      const [totalEmployees, activeEmployees, contractors, fullTime, branches] = await Promise.all([
        Employee.countDocuments(),
        Employee.countDocuments({ isActive: true }),
        Employee.countDocuments({ employeeType: 'contractor', isActive: true }),
        Employee.countDocuments({ employeeType: 'full_time', isActive: true }),
        Branch.countDocuments({ isActive: true }),
      ]);

      stats.employees = { total: totalEmployees, active: activeEmployees, contractors, fullTime };
      if (isAdmin) stats.branches = branches;

      // Full-time days worked stats for current month
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const daysWorkedPayments = await Payment.find({
        paymentType: 'full_time',
        isAdvance: false,
        month: currentMonth,
        daysWorked: { $exists: true, $ne: null },
      })
        .select('employee daysWorked totalWorkingDays')
        .lean();
      const daysWorkedByEmp = new Map<string, { daysWorked: number; totalWorkingDays: number }>();
      for (const p of daysWorkedPayments) {
        const empId = String(p.employee);
        daysWorkedByEmp.set(empId, { daysWorked: p.daysWorked ?? 0, totalWorkingDays: p.totalWorkingDays ?? 0 });
      }
      const daysWorkedValues = Array.from(daysWorkedByEmp.values());
      const fullTimeWithDaysWorked = daysWorkedValues.length;
      const avgDaysWorked = fullTimeWithDaysWorked > 0
        ? Math.round((daysWorkedValues.reduce((s, x) => s + x.daysWorked, 0) / fullTimeWithDaysWorked) * 10) / 10
        : null;
      const fullAttendanceCount = daysWorkedValues.filter((x) => x.totalWorkingDays > 0 && x.daysWorked >= x.totalWorkingDays).length;
      stats.fullTimeDaysWorked = {
        currentMonth,
        recorded: fullTimeWithDaysWorked,
        avgDaysWorked: avgDaysWorked,
        fullAttendance: fullAttendanceCount,
        totalFullTime: fullTime,
      };
    }

    if (isFinance || isAdmin) {
      const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

      const [totals, byModeArr, weeklyTrend] = await Promise.all([
        Payment.aggregate([
          { $match: { paidAt: { $gte: startDate } } },
          {
            $group: {
              _id: null,
              totalPaid: { $sum: '$paymentAmount' },
              totalPayable: { $sum: '$totalPayable' },
              totalRemaining: { $sum: '$remainingAmount' },
              count: { $sum: 1 },
            },
          },
        ]),
        Payment.aggregate([
          { $match: { paidAt: { $gte: startDate } } },
          { $group: { _id: { $ifNull: ['$paymentMode', 'other'] }, paid: { $sum: '$paymentAmount' } } },
        ]),
        Payment.aggregate([
          { $match: { paidAt: { $gte: startDate } } },
          {
            $group: {
              _id: { year: { $isoWeekYear: '$paidAt' }, week: { $isoWeek: '$paidAt' } },
              paid: { $sum: '$paymentAmount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.week': 1 } },
        ]),
      ]);

      const t = totals[0];
      const totalPaid = t?.totalPaid ?? 0;
      const totalPayable = t?.totalPayable ?? 0;
      const totalRemaining = t?.totalRemaining ?? 0;
      const count = t?.count ?? 0;
      const byMode = (byModeArr || []).reduce((acc, x) => {
        acc[x._id] = x.paid;
        return acc;
      }, {} as Record<string, number>);

      const weeklyMap = new Map(
        (weeklyTrend || []).map((w: { _id: { year: number; week: number }; paid: number; count: number }) => [
          `${w._id?.year}-${w._id?.week}`,
          { paid: w.paid, count: w.count },
        ])
      );
      const monthlyData: { month: string; paid: number; count: number }[] = [];
      const daysForPaymentTrend = Math.min(months * 31, 180);
      for (let i = daysForPaymentTrend - 1; i >= 0; i -= 7) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const weekStart = new Date(d);
        weekStart.setHours(0, 0, 0, 0);
        const { year: y, week: w } = getISOWeek(weekStart);
        const bucket = weeklyMap.get(`${y}-${w}`);
        monthlyData.push({
          month: formatDate(weekStart),
          paid: bucket?.paid ?? 0,
          count: bucket?.count ?? 0,
        });
      }

      stats.payments = {
        totalPaid,
        totalPayable,
        totalRemaining,
        count,
        byMode,
        trend: monthlyData,
      };
    }

    if (isHR || isAdmin) {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

      const [workTotals, workWeeklyTrend] = await Promise.all([
        WorkRecord.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: null,
              total: { $sum: '$totalAmount' },
              count: { $sum: 1 },
            },
          },
        ]),
        WorkRecord.aggregate([
          { $match: { createdAt: { $gte: startDate } } },
          {
            $group: {
              _id: { year: { $isoWeekYear: '$createdAt' }, week: { $isoWeek: '$createdAt' } },
              amount: { $sum: '$totalAmount' },
              count: { $sum: 1 },
            },
          },
          { $sort: { '_id.year': 1, '_id.week': 1 } },
        ]),
      ]);

      const wt = workTotals[0];
      const workTotal = wt?.total ?? 0;
      const workCount = wt?.count ?? 0;
      const workWeeklyMap = new Map(
        (workWeeklyTrend || []).map((w: { _id: { year: number; week: number }; amount: number; count: number }) => [
          `${w._id?.year}-${w._id?.week}`,
          { amount: w.amount, count: w.count },
        ])
      );
      const workTrend: { month: string; amount: number; count: number }[] = [];
      const daysForWorkTrend = Math.min(months * 31, 180);
      for (let i = daysForWorkTrend - 1; i >= 0; i -= 7) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const weekStart = new Date(d);
        weekStart.setHours(0, 0, 0, 0);
        const { year: y, week: w } = getISOWeek(weekStart);
        const bucket = workWeeklyMap.get(`${y}-${w}`);
        workTrend.push({
          month: formatDate(weekStart),
          amount: bucket?.amount ?? 0,
          count: bucket?.count ?? 0,
        });
      }

      stats.workRecords = { total: workTotal, count: workCount, trend: workTrend };
    }

    if (isAdmin || isHR) {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const styleOrderCount = await StyleOrder.countDocuments({ isActive: true });
      const workWithStyle = await WorkRecord.aggregate([
        { $match: { createdAt: { $gte: startDate }, styleOrder: { $exists: true, $ne: null } } },
        { $group: { _id: null, count: { $sum: 1 }, totalAmount: { $sum: '$totalAmount' } } },
      ]);

      // Style-wise stats for current month (aggregated by style)
      const styles = await StyleOrder.find({ isActive: true })
        .populate('branches', 'name _id')
        .select('styleCode branches monthWiseData')
        .lean();

      const byStyle: { styleCode: string; branchName: string; totalOrderQty: number; totalProduced: number; mfgCost: number; completionPct: number }[] = [];
      for (const s of styles) {
        const monthData = (s.monthWiseData as { month: string; totalOrderQuantity: number }[])?.find((m) => m.month === currentMonth);
        if (!monthData) continue;

        const totalOrderQty = monthData.totalOrderQuantity ?? 0;

        const produced = await WorkRecord.aggregate([
          { $match: { styleOrder: s._id, month: currentMonth } },
          { $unwind: '$workItems' },
          { $group: { _id: null, totalQty: { $sum: '$workItems.quantity' }, totalMfg: { $sum: '$workItems.amount' } } },
        ]);
        const totalProduced = produced[0]?.totalQty ?? 0;
        const mfgCost = produced[0]?.totalMfg ?? 0;
        const completionPct = totalOrderQty > 0 ? Math.round((totalProduced / totalOrderQty) * 100) : 0;
        const branchesList = (s.branches || []) as { name?: string }[];
        const branchName = branchesList.map((b) => b?.name || '').filter(Boolean).join(', ') || '';

        byStyle.push({
          styleCode: s.styleCode,
          branchName,
          totalOrderQty,
          totalProduced,
          mfgCost,
          completionPct,
        });
      }

      const completedStyles = byStyle.filter((x) => x.completionPct >= 100);
      const behindStyles = byStyle.filter((x) => x.totalOrderQty > 0 && x.completionPct < 100);
      const suggestions: string[] = [];
      if (completedStyles.length > 0) {
        suggestions.push(`${completedStyles.length} style(s) completed: ${completedStyles.map((x) => x.styleCode).join(', ')}`);
      }
      if (behindStyles.length > 0) {
        const lowest = [...behindStyles].sort((a, b) => a.completionPct - b.completionPct).slice(0, 3);
        suggestions.push(`Need attention: ${lowest.map((x) => `${x.styleCode} (${x.completionPct}%)`).join(', ')}`);
      }
      if (byStyle.length === 0 && styleOrderCount > 0) {
        suggestions.push('Add month-wise data to style orders for current month to track production.');
      }
      if (byStyle.length === 0 && styleOrderCount === 0) {
        suggestions.push('Create style/order codes and link work records to track production.');
      }
      if (behindStyles.length > 0) {
        const avgCompletion = behindStyles.reduce((s, x) => s + x.completionPct, 0) / behindStyles.length;
        suggestions.push(`Avg completion of behind styles: ${Math.round(avgCompletion)}%. Focus on lowest performers first.`);
      }
      if (completedStyles.length > 0 && behindStyles.length === 0) {
        suggestions.push('All active styles on track. Great job!');
      }

      const totalOrderAll = byStyle.reduce((s, x) => s + x.totalOrderQty, 0);
      const totalProducedAll = byStyle.reduce((s, x) => s + x.totalProduced, 0);
      const overallCompletion = totalOrderAll > 0 ? Math.round((totalProducedAll / totalOrderAll) * 100) : 0;
      const estimatedRemaining = totalOrderAll - totalProducedAll;

      // Estimate days to complete (based on last 7 days production rate)
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const recentProduced = await WorkRecord.aggregate([
        { $match: { createdAt: { $gte: weekAgo }, styleOrder: { $exists: true, $ne: null } } },
        { $unwind: '$workItems' },
        { $group: { _id: null, totalQty: { $sum: '$workItems.quantity' } } },
      ]);
      const weeklyRate = recentProduced[0]?.totalQty ?? 0;
      const estCompletionDays = weeklyRate > 0 && estimatedRemaining > 0
        ? Math.ceil((estimatedRemaining / (weeklyRate / 7)))
        : null;

      stats.styleOrders = {
        count: styleOrderCount,
        workRecordsWithStyle: workWithStyle[0]?.count ?? 0,
        workAmountWithStyle: workWithStyle[0]?.totalAmount ?? 0,
        byStyle,
        completedCount: completedStyles.length,
        behindCount: behindStyles.length,
        overallCompletion,
        totalOrderQty: totalOrderAll,
        totalProduced: totalProducedAll,
        estimatedRemaining,
        estCompletionDays,
        suggestions,
      };
    }

    // Alerts & updates (for admin, finance, hr)
    if (isAdmin || isFinance || isHR) {
      const now = new Date();
      const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
      const alerts: { type: string; message: string; priority: 'high' | 'medium' | 'low'; href?: string }[] = [];

      if (isFinance || isAdmin) {
        const unpaidWork = await WorkRecord.aggregate([
          { $match: { month: currentMonth } },
          { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        ]);
        const paidThisMonth = await Payment.aggregate([
          { $match: { month: currentMonth, isAdvance: false } },
          { $group: { _id: null, paid: { $sum: '$paymentAmount' } } },
        ]);
        const workTotal = unpaidWork[0]?.total ?? 0;
        const paidTotal = paidThisMonth[0]?.paid ?? 0;
        const pending = workTotal - paidTotal;
        if (pending > 0) {
          alerts.push({
            type: 'payment',
            message: `₹${pending.toLocaleString()} work amount pending payment this month`,
            priority: 'high',
            href: '/payments/contractors',
          });
        }
      }

      if (isAdmin || isHR) {
        const styleStats = stats.styleOrders as { behindCount?: number; completedCount?: number } | undefined;
        if (styleStats?.behindCount && styleStats.behindCount > 0) {
          alerts.push({
            type: 'production',
            message: `${styleStats.behindCount} style(s) behind target — review production`,
            priority: 'medium',
            href: '/reports',
          });
        }
      }

      stats.alerts = alerts;
    }

    if (isEmployee && user.employeeId) {
      const employee = await Employee.findById(user.employeeId).lean();
      if (employee) {
        const now = new Date();
        const startDate = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
        const empObjId = new mongoose.Types.ObjectId(user.employeeId);
        const empFilter = { employee: empObjId };

        const [
          myWorkTotals,
          myPaymentTotals,
          myWorkWeekly,
          myPaymentWeekly,
        ] = await Promise.all([
          WorkRecord.aggregate([
            { $match: { ...empFilter, createdAt: { $gte: startDate } } },
            { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
          ]),
          Payment.aggregate([
            { $match: { ...empFilter, paidAt: { $gte: startDate } } },
            {
              $group: {
                _id: null,
                paidTotal: { $sum: '$paymentAmount' },
                paidTotalPayable: { $sum: '$totalPayable' },
                dueTotal: { $sum: '$remainingAmount' },
                count: { $sum: 1 },
              },
            },
          ]),
          WorkRecord.aggregate([
            { $match: { ...empFilter, createdAt: { $gte: startDate } } },
            {
              $group: {
                _id: { year: { $isoWeekYear: '$createdAt' }, week: { $isoWeek: '$createdAt' } },
                amount: { $sum: '$totalAmount' },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.year': 1, '_id.week': 1 } },
          ]),
          Payment.aggregate([
            { $match: { ...empFilter, paidAt: { $gte: startDate } } },
            {
              $group: {
                _id: { year: { $isoWeekYear: '$paidAt' }, week: { $isoWeek: '$paidAt' } },
                paid: { $sum: '$paymentAmount' },
                count: { $sum: 1 },
              },
            },
            { $sort: { '_id.year': 1, '_id.week': 1 } },
          ]),
        ]);

        const mwt = myWorkTotals[0];
        const mpt = myPaymentTotals[0];
        const workTotal = mwt?.total ?? 0;
        const workRecordsCount = mwt?.count ?? 0;
        const paidTotal = mpt?.paidTotal ?? 0;
        const paidTotalPayable = mpt?.paidTotalPayable ?? 0;
        const dueTotal = mpt?.dueTotal ?? 0;
        const paymentsCount = mpt?.count ?? 0;

        const workWeeklyMap = new Map(
          (myWorkWeekly || []).map((w: { _id: { year: number; week: number }; amount: number; count: number }) => [
            `${w._id?.year}-${w._id?.week}`,
            { amount: w.amount, count: w.count },
          ])
        );
        const paymentWeeklyMap = new Map(
          (myPaymentWeekly || []).map((p: { _id: { year: number; week: number }; paid: number; count: number }) => [
            `${p._id?.year}-${p._id?.week}`,
            { paid: p.paid, count: p.count },
          ])
        );

        const myWorkTrend: { month: string; amount: number; count: number }[] = [];
        const myPaymentTrend: { month: string; paid: number; count: number }[] = [];
        const daysForTrend = Math.min(months * 31, 180);
        for (let i = daysForTrend - 1; i >= 0; i -= 7) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const weekStart = new Date(d);
          weekStart.setHours(0, 0, 0, 0);
          const { year: y, week: w } = getISOWeek(weekStart);
          const wBucket = workWeeklyMap.get(`${y}-${w}`);
          const pBucket = paymentWeeklyMap.get(`${y}-${w}`);
          myWorkTrend.push({
            month: formatDate(weekStart),
            amount: wBucket?.amount ?? 0,
            count: wBucket?.count ?? 0,
          });
          myPaymentTrend.push({
            month: formatDate(weekStart),
            paid: pBucket?.paid ?? 0,
            count: pBucket?.count ?? 0,
          });
        }

        stats.myStats = {
          employeeType: employee.employeeType,
          workRecords: workRecordsCount,
          workTotal,
          payments: paymentsCount,
          paidTotal,
          paidTotalPayable,
          dueTotal,
          workTrend: myWorkTrend,
          paymentTrend: myPaymentTrend,
        };
      }
    }

    return NextResponse.json(stats);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
