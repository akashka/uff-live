import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import VendorPayment from '@/lib/models/VendorPayment';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendorId');
    const month = searchParams.get('month');
    const paymentType = searchParams.get('paymentType'); // 'advance' | 'monthly'

    const filter: Record<string, unknown> = {};
    if (vendorId) filter.vendor = vendorId;
    if (month) filter.month = String(month).slice(0, 7);
    if (paymentType === 'advance' || paymentType === 'monthly') filter.paymentType = paymentType;

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = (page - 1) * limit;

    const [payments, total] = await Promise.all([
      VendorPayment.find(filter)
        .populate('vendor', 'name vendorId serviceType _id')
        .sort({ paidAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorPayment.countDocuments(filter),
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
      vendorId,
      paymentType,
      month,
      baseAmount,
      addDeductAmount,
      addDeductRemarks,
      totalPayable,
      paymentAmount,
      paymentMode,
      transactionRef,
      remainingAmount,
      carriedForward,
      carriedForwardRemarks,
      vendorWorkOrderIds,
    } = body;

    if (!vendorId || !paymentType || !month || !paymentAmount) {
      return NextResponse.json({ error: 'Vendor, payment type, month and payment amount required' }, { status: 400 });
    }
    if (paymentType !== 'advance' && paymentType !== 'monthly') {
      return NextResponse.json({ error: 'Payment type must be advance or monthly' }, { status: 400 });
    }

    const monthStr = String(month).slice(0, 7);

    await connectDB();

    const vendorWorkOrderRefs: { vendorWorkOrder: mongoose.Types.ObjectId; totalAmount: number }[] = [];
    if (paymentType === 'monthly' && Array.isArray(vendorWorkOrderIds) && vendorWorkOrderIds.length > 0) {
      const VendorWorkOrder = (await import('@/lib/models/VendorWorkOrder')).default;
      const orders = await VendorWorkOrder.find({
        _id: { $in: vendorWorkOrderIds },
        vendor: vendorId,
        month: monthStr,
      }).lean();
      for (const o of orders) {
        const id = (o as { _id?: mongoose.Types.ObjectId })._id;
        if (id) {
          vendorWorkOrderRefs.push({
            vendorWorkOrder: id,
            totalAmount: (o as { totalAmount?: number }).totalAmount ?? 0,
          });
        }
      }
    }

    const baseAmt = Number(baseAmount) || 0;
    const addDeduct = Number(addDeductAmount) || 0;
    const totalPay = Number(totalPayable) || baseAmt + addDeduct;
    const paymentAmt = Number(paymentAmount) || 0;
    const remaining = Math.max(0, totalPay - paymentAmt);
    const carried = Number(carriedForward) || 0;

    const payment = await VendorPayment.create({
      vendor: vendorId,
      paymentType,
      month: monthStr,
      baseAmount: baseAmt,
      addDeductAmount: addDeduct,
      addDeductRemarks: (addDeductRemarks || '').slice(0, 500),
      totalPayable: totalPay,
      paymentAmount: paymentAmt,
      paymentMode: paymentMode || 'cash',
      transactionRef: (transactionRef || '').slice(0, 200),
      remainingAmount: remaining,
      carriedForward: carried,
      carriedForwardRemarks: (carriedForwardRemarks || '').slice(0, 500),
      vendorWorkOrderRefs,
      paidAt: new Date(),
      createdBy: new mongoose.Types.ObjectId(user.userId),
    });

    const populated = await VendorPayment.findById(payment._id)
      .populate('vendor', 'name vendorId serviceType _id')
      .lean();

    logAudit({
      user,
      action: 'vendor_payment_create',
      entityType: 'vendor_payment',
      entityId: String(payment._id),
      summary: `Vendor payment ₹${paymentAmt.toLocaleString()} to ${(populated?.vendor as { name?: string })?.name || 'Vendor'} (${paymentType})`,
      metadata: { vendorId, paymentType, month: monthStr, amount: paymentAmt },
      req,
    }).catch(() => {});

    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
