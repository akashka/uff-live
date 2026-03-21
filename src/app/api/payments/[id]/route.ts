import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    await connectDB();

    const payment = await Payment.findById(id)
      .populate('employee', 'name employeeType')
      .populate({
        path: 'workRecordRefs.workRecord',
        populate: [
          { path: 'styleOrder', select: 'styleCode brand' },
          { path: 'branch', select: 'name' },
        ],
      })
      .lean();

    if (!payment) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });

    const empId =
      payment.employee && typeof payment.employee === 'object' && '_id' in payment.employee
        ? String((payment.employee as { _id: unknown })._id)
        : String(payment.employee);
    const canAccess =
      hasRole(user, ['admin', 'finance', 'accountancy', 'hr']) ||
      (user.employeeId && String(empId) === String(user.employeeId));
    if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json(payment);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
