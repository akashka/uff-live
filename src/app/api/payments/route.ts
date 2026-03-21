import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import WorkRecord from '@/lib/models/WorkRecord';
import Employee from '@/lib/models/Employee';
import { getAuthUser, hasRole } from '@/lib/auth';
import { notifyAdminsIfNeeded, notifyEmployee } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';
import { computeVirtualDaysAttended } from '@/lib/minimumWages';
import { roundAmount, roundDays } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId');
    const month = searchParams.get('month');
    const paymentType = searchParams.get('paymentType'); // 'contractor' | 'full_time'
    const isAdvance = searchParams.get('isAdvance'); // 'true' | 'false' - filter by advance (full_time only)

    let filter: Record<string, unknown> = {};
    if (month) filter.month = String(month).slice(0, 7);
    if (paymentType === 'contractor' || paymentType === 'full_time') filter.paymentType = paymentType;
    // Salary/work payment = isAdvance false or missing (legacy). Advance = isAdvance true.
    if ((paymentType === 'full_time' || paymentType === 'contractor') && isAdvance === 'true') {
      filter.isAdvance = true;
    } else if ((paymentType === 'full_time' || paymentType === 'contractor') && isAdvance === 'false') {
      filter.$or = [{ isAdvance: false }, { isAdvance: { $exists: false } }];
    }
    if (employeeId) {
      if (hasRole(user, ['admin', 'finance', 'accountancy', 'hr']) || user.employeeId === employeeId) {
        filter.employee = employeeId;
      } else {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    } else if (user.employeeId) {
      filter.employee = user.employeeId;
    } else if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) {
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

    // For accountancy role: ensure virtualDaysAttended is set for full-time salary payments (compute if missing)
    const isAccountancy = user.role === 'accountancy';
    const data = isAccountancy && Array.isArray(payments)
      ? payments.map((p) => {
          const rec = p as unknown as { paymentType?: string; isAdvance?: boolean; virtualDaysAttended?: number; paymentAmount?: number; totalWorkingDays?: number };
          const isFullTimeSalary = rec.paymentType === 'full_time' && !(rec.isAdvance ?? false);
          if (isFullTimeSalary) {
            let vda = rec.virtualDaysAttended;
            if (vda == null) {
              const amt = rec.paymentAmount ?? 0;
              const dw = (rec as { daysWorked?: number }).daysWorked ?? 0;
              const computed = computeVirtualDaysAttended(amt, dw);
              vda = computed != null ? roundDays(computed) : undefined;
            }
            return { ...p, virtualDaysAttended: vda };
          }
          return p;
        })
      : payments;

    return NextResponse.json({
      data,
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
      month,
      baseAmount,
      addDeductAmount,
      addDeductRemarks,
      pfDeducted,
      esiDeducted,
      otherDeducted,
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
      daysWorked,
      totalWorkingDays,
      otHours,
      otAmount,
    } = body;

    if (!employeeId || !paymentType || !month || totalPayable === undefined || paymentAmount === undefined || paymentAmount === null || !paymentMode) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
    }

    const monthStr = String(month).slice(0, 7); // YYYY-MM

    await connectDB();

    const emp = await Employee.findById(employeeId).lean();
    if (!emp) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    let workRecordRefs: { workRecord: mongoose.Types.ObjectId; totalAmount: number }[] = [];
    if (paymentType === 'contractor' && Array.isArray(workRecordIds) && workRecordIds.length > 0) {
      const records = await WorkRecord.find({ _id: { $in: workRecordIds }, employee: employeeId }).lean();
      workRecordRefs = (records || []).map((r) => ({
        workRecord: r._id instanceof mongoose.Types.ObjectId ? r._id : new mongoose.Types.ObjectId(r._id),
        totalAmount: roundAmount(r.totalAmount || 0),
      }));
    }

    const isFullTimeSalary = paymentType === 'full_time' && (isAdvance === false || isAdvance === undefined);

    const paymentData: Record<string, unknown> = {
      employee: employeeId,
      paymentType,
      month: monthStr,
      baseAmount: roundAmount(baseAmount ?? 0),
      addDeductAmount: roundAmount(addDeductAmount ?? 0),
      addDeductRemarks: addDeductRemarks || '',
      pfDeducted: roundAmount(pfDeducted ?? 0),
      esiDeducted: roundAmount(esiDeducted ?? 0),
      otherDeducted: roundAmount(otherDeducted ?? 0),
      advanceDeducted: roundAmount(advanceDeducted ?? 0),
      totalPayable: roundAmount(totalPayable),
      paymentAmount: roundAmount(paymentAmount),
      paymentMode,
      transactionRef: transactionRef || '',
      remainingAmount: roundAmount(remainingAmount ?? 0),
      carriedForward: roundAmount(carriedForward ?? 0),
      carriedForwardRemarks: carriedForwardRemarks || '',
      isAdvance: isAdvance ?? false,
      workRecordRefs,
      paidAt: new Date(),
      createdBy: user.userId,
    };

    if (isFullTimeSalary) {
      paymentData.daysWorked = roundDays(typeof body.daysWorked === 'number' ? body.daysWorked : Number(body.daysWorked) || 0);
      paymentData.totalWorkingDays = roundDays(typeof body.totalWorkingDays === 'number' ? body.totalWorkingDays : Number(body.totalWorkingDays) || 0);
      const vda = computeVirtualDaysAttended(paymentAmount, paymentData.daysWorked as number);
      if (vda != null) paymentData.virtualDaysAttended = roundDays(vda);
      if (body.otHours != null) paymentData.otHours = roundAmount(Number(body.otHours) || 0);
      if (body.otAmount != null) paymentData.otAmount = roundAmount(Number(body.otAmount) || 0);
    }

    // Use collection.insertOne to bypass Mongoose schema caching (ensures daysWorked is saved)
    const doc: Record<string, unknown> = {
      _id: new mongoose.Types.ObjectId(),
      employee: new mongoose.Types.ObjectId(employeeId),
      paymentType,
      month: monthStr,
      baseAmount: paymentData.baseAmount,
      addDeductAmount: paymentData.addDeductAmount,
      addDeductRemarks: addDeductRemarks || '',
      pfDeducted: paymentData.pfDeducted,
      esiDeducted: paymentData.esiDeducted,
      otherDeducted: roundAmount(otherDeducted ?? 0),
      advanceDeducted: paymentData.advanceDeducted,
      totalPayable: paymentData.totalPayable,
      paymentAmount: paymentData.paymentAmount,
      paymentMode,
      transactionRef: transactionRef || '',
      remainingAmount: paymentData.remainingAmount,
      carriedForward: paymentData.carriedForward,
      carriedForwardRemarks: carriedForwardRemarks || '',
      isAdvance: isAdvance ?? false,
      workRecordRefs,
      paidAt: new Date(),
      createdBy: new mongoose.Types.ObjectId(user.userId),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    if (isFullTimeSalary) {
      doc.daysWorked = paymentData.daysWorked;
      doc.totalWorkingDays = paymentData.totalWorkingDays;
      if (paymentData.virtualDaysAttended != null) doc.virtualDaysAttended = paymentData.virtualDaysAttended;
      if (paymentData.otHours != null) doc.otHours = paymentData.otHours;
      if (paymentData.otAmount != null) doc.otAmount = paymentData.otAmount;
      if (paymentData.otherDeducted != null) doc.otherDeducted = paymentData.otherDeducted;
    }
    await Payment.collection.insertOne(doc);
    const payment = { _id: doc._id, ...doc };

    const populated = await Payment.findById(payment._id)
      .populate('employee', 'name employeeType')
      .populate('workRecordRefs.workRecord')
      .lean();

    const empName = (populated?.employee as { name?: string })?.name || 'Employee';
    const passbookLink = `/employees/${employeeId}/passbook`;

    notifyEmployee(employeeId, {
      type: 'payment_created',
      title: 'Payment recorded',
      message: `A payment of ₹${paymentAmount.toLocaleString()} has been recorded for you for ${monthStr}${isAdvance ? ' (Advance)' : ''}.`,
      link: passbookLink,
      metadata: { entityId: String(payment._id), entityType: 'payment', employeeId, employeeName: empName, month: monthStr, amount: paymentAmount },
    }).catch(() => {});
    notifyAdminsIfNeeded(user, {
      type: 'payment_created',
      title: 'Payment recorded',
      message: `${user.role} recorded a payment of ₹${paymentAmount.toLocaleString()} for ${empName} for ${monthStr}.`,
      link: '/payments',
      metadata: { entityId: String(payment._id), entityType: 'payment', actorId: user.userId, actorRole: user.role, employeeId, employeeName: empName, month: monthStr, amount: paymentAmount },
    }).catch(() => {});

    logAudit({
      user,
      action: 'payment_create',
      entityType: 'payment',
      entityId: String(payment._id),
      summary: `Payment of ₹${paymentAmount.toLocaleString()} recorded for ${empName} (${monthStr})${isAdvance ? ' [Advance]' : ''}`,
      metadata: { employeeId, employeeName: empName, month: monthStr, amount: paymentAmount, paymentType, isAdvance: isAdvance ?? false },
      req,
    }).catch(() => {});

    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
