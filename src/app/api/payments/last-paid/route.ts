import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    if (!employeeId) return NextResponse.json({ error: 'employeeId required' }, { status: 400 });

    if (!hasRole(user, ['admin', 'finance', 'hr']) && user.employeeId !== employeeId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const lastPayment = await Payment.findOne({ employee: employeeId })
      .sort({ paidAt: -1 })
      .select('paidAt month')
      .lean();

    return NextResponse.json({
      lastPaidAt: lastPayment?.paidAt || null,
      lastMonth: lastPayment?.month || null,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
