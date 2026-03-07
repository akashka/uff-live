import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import { getAuthUser, hasRole } from '@/lib/auth';

/** Get total advance outstanding for a full-time employee (advance given - advance deducted). */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 });

    await connectDB();

    const advanceGiven = await Payment.aggregate([
      { $match: { employee: employeeId, paymentType: 'full_time', isAdvance: true } },
      { $group: { _id: null, total: { $sum: '$paymentAmount' } } },
    ]);
    const totalAdvanceGiven = advanceGiven[0]?.total ?? 0;

    const advanceDeducted = await Payment.aggregate([
      { $match: { employee: employeeId, paymentType: 'full_time', isAdvance: false } },
      { $group: { _id: null, total: { $sum: '$advanceDeducted' } } },
    ]);
    const totalAdvanceDeducted = advanceDeducted[0]?.total ?? 0;

    const outstanding = Math.max(0, totalAdvanceGiven - totalAdvanceDeducted);

    return NextResponse.json({ outstanding, totalAdvanceGiven, totalAdvanceDeducted });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
