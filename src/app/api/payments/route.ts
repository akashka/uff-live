import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import WorkRecord from '@/lib/models/WorkRecord';
import Employee from '@/lib/models/Employee';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const paymentRun = searchParams.get('paymentRun');

    let filter: Record<string, unknown> = {};
    if (paymentRun) filter.paymentRun = paymentRun;
    if (employeeId) {
      if (hasRole(user, ['admin', 'finance', 'hr'])) {
        filter = { employee: employeeId };
      } else if (user.employeeId === employeeId) {
        filter = { employee: employeeId };
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (user.employeeId) {
      filter = { employee: user.employeeId };
    } else if (hasRole(user, ['admin', 'finance', 'hr'])) {
      filter = {};
    } else {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const populateWorkRecords = searchParams.get('populateWorkRecords') === 'true';
    const skip = (page - 1) * limit;

    let query = Payment.find(filter)
      .populate('employee', 'name employeeType')
      .sort({ paidAt: -1 })
      .skip(skip)
      .limit(limit);
    if (populateWorkRecords) {
      query = query.populate('workRecordRefs.workRecord');
    }

    const [payments, total] = await Promise.all([
      query.lean().exec(),
      Payment.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: payments,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const {
      employeeId,
      paymentType,
      periodStart,
      periodEnd,
      baseAmount,
      addDeductAmount,
      addDeductRemarks,
      pfDeducted,
      esiDeducted,
      advanceDeducted,
      totalPayable,
      paymentAmount,
      paymentMode,
      transactionRef,
      remainingAmount,
      carriedForward,
      carriedForwardRemarks,
      isAdvance,
      workRecordIds,
      paymentRun,
    } = body;

    if (!employeeId || !paymentType || !periodStart || !periodEnd || totalPayable === undefined || paymentAmount === undefined || paymentAmount === null || !paymentMode) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
    }

    await connectDB();

    const emp = await Employee.findById(employeeId).lean();
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    let workRecordRefs: { workRecord: string; totalAmount: number }[] = [];
    if (paymentType === 'contractor' && Array.isArray(workRecordIds) && workRecordIds.length > 0) {
      const records = await WorkRecord.find({ _id: { $in: workRecordIds }, employee: employeeId }).lean();
      workRecordRefs = (records || []).map((r) => ({ workRecord: r._id.toString(), totalAmount: r.totalAmount || 0 }));
    }

    const payment = await Payment.create({
      employee: employeeId,
      paymentType,
      periodStart: new Date(periodStart),
      periodEnd: new Date(periodEnd),
      baseAmount: baseAmount ?? 0,
      addDeductAmount: addDeductAmount ?? 0,
      addDeductRemarks: addDeductRemarks || '',
      pfDeducted: pfDeducted ?? 0,
      esiDeducted: esiDeducted ?? 0,
      advanceDeducted: advanceDeducted ?? 0,
      totalPayable,
      paymentAmount,
      paymentMode,
      transactionRef: transactionRef || '',
      remainingAmount: remainingAmount ?? 0,
      carriedForward: carriedForward ?? 0,
      carriedForwardRemarks: carriedForwardRemarks || '',
      isAdvance: isAdvance ?? false,
      workRecordRefs,
      paymentRun: paymentRun || '',
      paidAt: new Date(),
      createdBy: user.userId,
    });

    const populated = await Payment.findById(payment._id)
      .populate('employee', 'name employeeType')
      .populate('workRecordRefs.workRecord')
      .lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
