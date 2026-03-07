import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import { getAuthUser, hasRole } from '@/lib/auth';

/**
 * GET /api/full-time/days-worked?month=YYYY-MM
 * Returns days worked per full-time employee for the given month.
 * Source: salary payments (isAdvance=false) with daysWorked stored.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    if (!month) return NextResponse.json({ error: 'month required (YYYY-MM)' }, { status: 400 });

    const monthStr = String(month).slice(0, 7);

    await connectDB();

    const payments = await Payment.find({
      paymentType: 'full_time',
      $or: [{ isAdvance: false }, { isAdvance: { $exists: false } }],
      month: monthStr,
      daysWorked: { $exists: true, $ne: null },
    })
      .select('employee daysWorked totalWorkingDays')
      .lean();

    const byEmployee: Record<string, { daysWorked: number; totalWorkingDays: number }> = {};
    for (const p of payments) {
      const emp = p.employee;
      const empId = emp?.toString?.() ?? String(emp ?? '');
      const dw = p.daysWorked ?? 0;
      const twd = p.totalWorkingDays ?? 0;
      // Use latest payment if multiple (e.g. corrections) - last one wins
      byEmployee[empId] = { daysWorked: dw, totalWorkingDays: twd };
    }

    return NextResponse.json({ byEmployee, month: monthStr });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
