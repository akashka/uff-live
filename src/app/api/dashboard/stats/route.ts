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
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '30'; // days
    const days = parseInt(range, 10) || 30;

    const isAdmin = hasRole(user, ['admin']);
    const isFinance = hasRole(user, ['admin', 'finance']);
    const isHR = hasRole(user, ['admin', 'finance', 'hr']);
    const isEmployee = user.employeeId;

    const stats: Record<string, unknown> = {};

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
    }

    if (isFinance || isAdmin) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

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
      for (let i = days - 1; i >= 0; i -= 7) {
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
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

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
      for (let i = days - 1; i >= 0; i -= 7) {
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

    if (isEmployee && user.employeeId) {
      const employee = await Employee.findById(user.employeeId).lean();
      if (employee) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
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
        for (let i = days - 1; i >= 0; i -= 7) {
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
