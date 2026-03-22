import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
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
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return NextResponse.json({ error: 'Invalid payment ID' }, { status: 400 });
    }

    await connectDB();

    const payment = await Payment.findById(id)
      .populate('employee', 'name employeeType _id')
      .populate({
        path: 'workRecordRefs.workRecord',
        populate: [
          { path: 'styleOrder', select: 'styleCode brand colour' },
          { path: 'branch', select: 'name' },
        ],
        strictPopulate: false,
      })
      .populate({
        path: 'fullTimeWorkRecordRefs.fullTimeWorkRecord',
        populate: { path: 'branch', select: 'name' },
        strictPopulate: false,
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
