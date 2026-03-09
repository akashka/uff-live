import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import { getAuthUser, hasRole } from '@/lib/auth';
import { computeVirtualDaysAttended } from '@/lib/minimumWages';
import { roundDays } from '@/lib/utils';

/**
 * GET /api/full-time/days-worked?month=YYYY-MM
 * Returns days worked per full-time employee for the given month.
 * For accountancy role: returns virtual days attended (compliance) instead of actual days.
 * Source: salary payments (isAdvance=false) with daysWorked/virtualDaysAttended stored.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const month = searchParams.get('month');
    if (!month) return NextResponse.json({ error: 'month required (YYYY-MM)' }, { status: 400 });

    const monthStr = String(month).slice(0, 7);
    const isAccountancy = user.role === 'accountancy';

    await connectDB();

    const payments = await Payment.find({
      paymentType: 'full_time',
      $or: [{ isAdvance: false }, { isAdvance: { $exists: false } }],
      month: monthStr,
      totalWorkingDays: { $exists: true, $gt: 0 },
    })
      .select('employee daysWorked totalWorkingDays virtualDaysAttended paymentAmount')
      .lean();

    const byEmployee: Record<string, { daysWorked: number; totalWorkingDays: number }> = {};
    for (const p of payments) {
      const emp = p.employee;
      const empId = emp?.toString?.() ?? String(emp ?? '');
      const twd = p.totalWorkingDays ?? 0;
      let dw: number;
      if (isAccountancy) {
        dw = p.virtualDaysAttended ?? 0;
        const actualDw = p.daysWorked ?? 0;
        if (dw === 0 && actualDw > 0 && (p.paymentAmount ?? 0) > 0) {
          const vda = computeVirtualDaysAttended(p.paymentAmount ?? 0, actualDw);
          dw = vda ?? 0;
        }
      } else {
        dw = p.daysWorked ?? 0;
      }
      // Use latest payment if multiple (e.g. corrections) - last one wins; round days
      byEmployee[empId] = { daysWorked: roundDays(dw), totalWorkingDays: roundDays(twd) };
    }

    return NextResponse.json({ byEmployee, month: monthStr });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
