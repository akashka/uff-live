import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import WorkRecord from '@/lib/models/WorkRecord';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const currentYear = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
    const previousYear = currentYear - 1;

    await connectDB();

    const [currentYearPayments, previousYearPayments, currentYearWork, previousYearWork] = await Promise.all([
      Payment.aggregate([
        { $match: { month: { $regex: `^${currentYear}-` }, isAdvance: false } },
        { $group: { _id: '$month', total: { $sum: '$paymentAmount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      Payment.aggregate([
        { $match: { month: { $regex: `^${previousYear}-` }, isAdvance: false } },
        { $group: { _id: '$month', total: { $sum: '$paymentAmount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      WorkRecord.aggregate([
        { $match: { month: { $regex: `^${currentYear}-` } } },
        { $group: { _id: '$month', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      WorkRecord.aggregate([
        { $match: { month: { $regex: `^${previousYear}-` } } },
        { $group: { _id: '$month', total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const curPayMap = new Map((currentYearPayments || []).map((p) => [p._id, { total: p.total, count: p.count }]));
    const prevPayMap = new Map((previousYearPayments || []).map((p) => [p._id, { total: p.total, count: p.count }]));
    const curWorkMap = new Map((currentYearWork || []).map((w) => [w._id, { total: w.total, count: w.count }]));
    const prevWorkMap = new Map((previousYearWork || []).map((w) => [w._id, { total: w.total, count: w.count }]));

    const months = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
    const data = months.map((m) => {
      const curMonth = `${currentYear}-${m}`;
      const prevMonth = `${previousYear}-${m}`;
      const curPay = curPayMap.get(curMonth);
      const prevPay = prevPayMap.get(prevMonth);
      const curWork = curWorkMap.get(curMonth);
      const prevWork = prevWorkMap.get(prevMonth);
      return {
        month: m,
        monthLabel: new Date(currentYear, parseInt(m, 10) - 1, 1).toLocaleString('en-GB', { month: 'short' }),
        currentYear: {
          payments: curPay?.total ?? 0,
          paymentCount: curPay?.count ?? 0,
          workAmount: curWork?.total ?? 0,
          workRecordCount: curWork?.count ?? 0,
        },
        previousYear: {
          payments: prevPay?.total ?? 0,
          paymentCount: prevPay?.count ?? 0,
          workAmount: prevWork?.total ?? 0,
          workRecordCount: prevWork?.count ?? 0,
        },
        paymentChange: prevPay?.total
          ? (((curPay?.total ?? 0) - prevPay.total) / prevPay.total) * 100
          : null,
        workChange: prevWork?.total ? (((curWork?.total ?? 0) - prevWork.total) / prevWork.total) * 100 : null,
      };
    });

    const curTotalPay = data.reduce((s, d) => s + d.currentYear.payments, 0);
    const prevTotalPay = data.reduce((s, d) => s + d.previousYear.payments, 0);
    const curTotalWork = data.reduce((s, d) => s + d.currentYear.workAmount, 0);
    const prevTotalWork = data.reduce((s, d) => s + d.previousYear.workAmount, 0);

    return NextResponse.json({
      currentYear,
      previousYear,
      data,
      summary: {
        currentYear: { totalPayments: curTotalPay, totalWork: curTotalWork },
        previousYear: { totalPayments: prevTotalPay, totalWork: prevTotalWork },
        paymentChangePct: prevTotalPay ? ((curTotalPay - prevTotalPay) / prevTotalPay) * 100 : null,
        workChangePct: prevTotalWork ? ((curTotalWork - prevTotalWork) / prevTotalWork) * 100 : null,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch year-over-year data' }, { status: 500 });
  }
}
