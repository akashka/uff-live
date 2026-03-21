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

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await connectDB();
    const record = await VendorWorkOrder.findById(id)
      .populate('vendor', 'name vendorId serviceType _id')
      .populate('branch', 'name _id')
      .populate('styleOrder', 'styleCode brand colour _id')
      .lean();
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(record);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();
    const { branchId, month, styleOrderId, colour, workItems, extraAmount, reasons } = body;

    await connectDB();
    const existing = await VendorWorkOrder.findById(id).lean();
    if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const branchIdFinal = branchId || (existing.branch as { toString?: () => string })?.toString?.() || '';
    const monthStr = String(month || (existing as { month?: string }).month).slice(0, 7);
    const styleOrderIdFinal = styleOrderId ?? (existing.styleOrder as { toString?: () => string })?.toString?.();

    type WorkItemEntry = { rateMaster?: unknown; workItemKey?: string; rateName: string; unit: string; quantity: number; multiplier?: number; remarks?: string; ratePerUnit: number; amount: number };
    let workItemsWithAmounts = (existing.workItems || []) as WorkItemEntry[];
    let totalAmount = 0;

    if (Array.isArray(workItems) && workItems.length > 0) {
      const rateMasterIds = workItems
        .filter((w: { rateMasterId?: string; workItemKey?: string }) => (w as { rateMasterId?: string }).rateMasterId)
        .map((w: { rateMasterId: string }) => w.rateMasterId);
      const rateMasters = rateMasterIds.length > 0 ? await RateMaster.find({ _id: { $in: rateMasterIds } }).lean() : [];

      workItemsWithAmounts = [] as WorkItemEntry[];
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
              (typeof br.branch === 'object' ? br.branch?.toString?.() : String(br.branch)) === branchIdFinal
          );
          const defaultRate = branchRate?.amount ?? 0;
          const effectiveRate = (item as { ratePerUnit?: number }).ratePerUnit != null ? Number((item as { ratePerUnit?: number }).ratePerUnit) : defaultRate;

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
    } else {
      totalAmount = workItemsWithAmounts.reduce((s, wi) => s + (wi.amount || 0), 0);
    }

    const extraAmt = roundAmount(Number(extraAmount !== undefined ? extraAmount : (existing as { extraAmount?: number }).extraAmount) || 0);
    const finalTotal = roundAmount(totalAmount + extraAmt);

    const record = await VendorWorkOrder.findByIdAndUpdate(
      id,
      {
        branch: branchId || existing.branch,
        month: monthStr,
        styleOrder: styleOrderId !== undefined ? styleOrderId || null : existing.styleOrder,
        workItems: workItemsWithAmounts,
        extraAmount: extraAmt,
        reasons: reasons !== undefined ? reasons : (existing as { reasons?: string }).reasons ?? '',
        totalAmount: finalTotal,
      },
      { new: true }
    )
      .populate('vendor', 'name vendorId serviceType _id')
      .populate('branch', 'name _id')
      .populate('styleOrder', 'styleCode brand colour _id')
      .lean();

    logAudit({
      user,
      action: 'vendor_work_order_update',
      entityType: 'vendor_work_order',
      entityId: id,
      summary: `Vendor work order ${id} updated`,
      metadata: { vendorWorkOrderId: id },
      req,
    }).catch(() => {});

    return NextResponse.json(record);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await connectDB();
    const record = await VendorWorkOrder.findByIdAndDelete(id);
    if (!record) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    logAudit({
      user,
      action: 'vendor_work_order_delete',
      entityType: 'vendor_work_order',
      entityId: id,
      summary: `Vendor work order ${id} deleted`,
      req,
    }).catch(() => {});

    return NextResponse.json({ deleted: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
