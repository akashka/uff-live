import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import Vendor from '@/lib/models/Vendor';
import RateMaster from '@/lib/models/RateMaster';
import StyleOrder from '@/lib/models/StyleOrder';
import WorkRecord from '@/lib/models/WorkRecord';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { roundAmount } from '@/lib/utils';
import { VENDOR_WORK_ITEMS } from '@/app/api/vendor-work-items/route';

async function getAvailableQuantity(
  styleOrderId: string,
  branchId: string,
  month: string,
  rateMasterId: string,
  excludeVendorWorkOrderId?: string
): Promise<number> {
  const styleOrder = await StyleOrder.findById(styleOrderId).lean();
  if (!styleOrder) return 0;

  const monthStr = String(month).slice(0, 7);
  const so = styleOrder as { month?: string; totalOrderQuantity?: number };
  const totalOrderQty = so.month === monthStr ? (so.totalOrderQuantity ?? 0) : 0;

  const producedFromWorkRecords = await WorkRecord.aggregate([
    {
      $match: {
        styleOrder: new mongoose.Types.ObjectId(styleOrderId),
        branch: new mongoose.Types.ObjectId(branchId),
        month: monthStr,
      },
    },
    { $unwind: '$workItems' },
    { $match: { 'workItems.rateMaster': { $eq: new mongoose.Types.ObjectId(rateMasterId) } } },
    { $group: { _id: null, total: { $sum: '$workItems.quantity' } } },
  ]);
  const producedFromVendorOrders = await VendorWorkOrder.aggregate([
    {
      $match: {
        styleOrder: new mongoose.Types.ObjectId(styleOrderId),
        branch: new mongoose.Types.ObjectId(branchId),
        month: monthStr,
        ...(excludeVendorWorkOrderId ? { _id: { $ne: new mongoose.Types.ObjectId(excludeVendorWorkOrderId) } } : {}),
      },
    },
    { $unwind: '$workItems' },
    { $match: { 'workItems.rateMaster': { $eq: new mongoose.Types.ObjectId(rateMasterId) } } },
    { $group: { _id: null, total: { $sum: '$workItems.quantity' } } },
  ]);
  const producedQty = (producedFromWorkRecords[0]?.total ?? 0) + (producedFromVendorOrders[0]?.total ?? 0);
  return Math.max(0, totalOrderQty - producedQty);
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendorId');
    const branchId = searchParams.get('branchId');
    const month = searchParams.get('month');

    const filter: Record<string, unknown> = {};
    if (vendorId) filter.vendor = vendorId;
    if (branchId) filter.branch = branchId;
    if (month) filter.month = String(month).slice(0, 7);

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      VendorWorkOrder.find(filter)
        .populate('vendor', 'name vendorId serviceType _id')
        .populate('branch', 'name _id')
        .populate('styleOrder', 'styleCode brand _id')
        .sort({ month: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      VendorWorkOrder.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: records,
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
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { vendorId, branchId, month, styleOrderId, workItems, extraAmount, reasons } = body;

    if (!vendorId || !branchId || !month || !styleOrderId || !Array.isArray(workItems)) {
      return NextResponse.json({ error: 'Vendor, branch, month, style/order and work items required' }, { status: 400 });
    }

    const monthStr = String(month).slice(0, 7);

    await connectDB();

    const vendor = await Vendor.findById(vendorId).lean();
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });
    if (!(vendor as { isActive?: boolean }).isActive) {
      return NextResponse.json({ error: 'Vendor is inactive' }, { status: 400 });
    }

    const rateMasterIds = workItems
      .filter((w: { rateMasterId?: string; workItemKey?: string }) => w.rateMasterId)
      .map((w: { rateMasterId: string }) => w.rateMasterId);
    const rateMasters = rateMasterIds.length > 0 ? await RateMaster.find({ _id: { $in: rateMasterIds } }).lean() : [];

    const workItemsWithAmounts = [];
    let totalAmount = 0;

    for (const item of workItems) {
      const workItemKey = (item as { workItemKey?: string }).workItemKey;
      const isVendorWorkItem = !!workItemKey;
      const quantity = Math.max(0, Number(item.quantity) || 0);
      const multiplier = Number((item as { multiplier?: number }).multiplier) || 1;
      const ratePerUnit = Number((item as { ratePerUnit?: number }).ratePerUnit) ?? 0;

      if (quantity <= 0) continue;

      if (isVendorWorkItem) {
        const def = VENDOR_WORK_ITEMS.find((v) => v.id === workItemKey);
        if (!def) continue;
        const amount = roundAmount(quantity * multiplier * ratePerUnit);
        workItemsWithAmounts.push({
          rateMaster: null,
          workItemKey,
          rateName: def.name,
          unit: def.unit,
          quantity,
          multiplier,
          remarks: (item as { remarks?: string }).remarks || '',
          ratePerUnit,
          amount,
        });
        totalAmount += amount;
      } else {
        const rateMasterId = (item as { rateMasterId: string }).rateMasterId;
        const rateMaster = rateMasters.find((r: { _id: { toString: () => string } }) => r._id.toString() === rateMasterId);
        if (!rateMaster) continue;

        const branchRate = (rateMaster as { branchRates: { branch: { toString?: () => string }; amount: number }[] }).branchRates?.find(
          (br: { branch: { toString?: () => string }; amount: number }) =>
            (typeof br.branch === 'object' ? br.branch?.toString?.() : String(br.branch)) === branchId
        );
        const defaultRate = branchRate?.amount ?? 0;
        const effectiveRate = (item as { ratePerUnit?: number }).ratePerUnit != null ? Number((item as { ratePerUnit?: number }).ratePerUnit) : defaultRate;

        if (styleOrderId && quantity > 0) {
          const available = await getAvailableQuantity(styleOrderId, branchId, monthStr, rateMasterId);
          if (quantity > available) {
            return NextResponse.json(
              { error: `Quantity ${quantity} exceeds available ${available} for this rate. Reduce and try again.` },
              { status: 400 }
            );
          }
        }

        const amount = roundAmount(quantity * multiplier * effectiveRate);
        workItemsWithAmounts.push({
          rateMaster: rateMasterId,
          rateName: (rateMaster as { name: string }).name,
          unit: (rateMaster as { unit: string }).unit,
          quantity,
          multiplier,
          remarks: (item as { remarks?: string }).remarks || '',
          ratePerUnit: effectiveRate,
          amount,
        });
        totalAmount += amount;
      }
    }

    if (workItemsWithAmounts.length === 0) {
      return NextResponse.json({ error: 'No valid work items' }, { status: 400 });
    }

    const extraAmt = roundAmount(Number(extraAmount) || 0);
    const finalTotal = roundAmount(totalAmount + extraAmt);

    const record = await VendorWorkOrder.create({
      vendor: vendorId,
      branch: branchId,
      month: monthStr,
      styleOrder: styleOrderId,
      workItems: workItemsWithAmounts,
      extraAmount: extraAmt,
      reasons: reasons || '',
      totalAmount: finalTotal,
    });

    const populated = await VendorWorkOrder.findById(record._id)
      .populate('vendor', 'name vendorId serviceType _id')
      .populate('branch', 'name _id')
      .populate('styleOrder', 'styleCode brand _id')
      .lean();

    const vendorName = (populated?.vendor as { name?: string })?.name || 'Vendor';

    logAudit({
      user,
      action: 'vendor_work_order_create',
      entityType: 'vendor_work_order',
      entityId: String(record._id),
      summary: `Vendor work order created for ${vendorName} (${monthStr}) - ₹${finalTotal.toLocaleString()}`,
      metadata: { vendorId, vendorName, month: monthStr, amount: finalTotal },
      req,
    }).catch(() => {});

    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
