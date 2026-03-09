import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import StyleOrder from '@/lib/models/StyleOrder';
import RateMaster from '@/lib/models/RateMaster';
import WorkRecord from '@/lib/models/WorkRecord';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import { getAuthUser, hasRole } from '@/lib/auth';

/** GET styles for branch+month with available quantity per rate master (for work record form) */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    const month = searchParams.get('month');

    if (!branchId || !month) {
      return NextResponse.json({ error: 'branchId and month required' }, { status: 400 });
    }

    const monthStr = String(month).slice(0, 7); // YYYY-MM

    await connectDB();

    const styles = await StyleOrder.find({
      branches: branchId,
      isActive: true,
      month: monthStr,
    })
      .populate('branches', 'name _id')
      .lean();

    // All rate masters for dropdown (no style-rate mapping)
    const allRates = await RateMaster.find({ isActive: true }).select('_id name unit').lean();

    // Get produced quantities: work records for this branch+month with this style
    const styleIds = styles.map((s: { _id: { toString: () => string } }) => s._id.toString());

    const producedByStyleRate = new Map<string, number>(); // key: styleId_rateMasterId
    if (styleIds.length > 0) {
      const [workRecords, vendorWorkOrders] = await Promise.all([
        WorkRecord.find({
          branch: branchId,
          month: monthStr,
          styleOrder: { $in: styleIds },
        })
          .select('styleOrder workItems')
          .lean(),
        VendorWorkOrder.find({
          branch: branchId,
          month: monthStr,
          styleOrder: { $in: styleIds },
        })
          .select('styleOrder workItems')
          .lean(),
      ]);

      for (const wr of workRecords) {
        const styleId = wr.styleOrder?.toString?.() || '';
        if (!styleId) continue;
        for (const wi of wr.workItems || []) {
          const rateId = (wi.rateMaster && typeof wi.rateMaster === 'object' && '_id' in wi.rateMaster)
            ? (wi.rateMaster as { _id: { toString: () => string } })._id.toString()
            : String(wi.rateMaster);
          const key = `${styleId}_${rateId}`;
          producedByStyleRate.set(key, (producedByStyleRate.get(key) || 0) + (wi.quantity || 0));
        }
      }
      for (const vwo of vendorWorkOrders) {
        const styleId = vwo.styleOrder?.toString?.() || '';
        if (!styleId) continue;
        for (const wi of vwo.workItems || []) {
          const rateId = (wi.rateMaster && typeof wi.rateMaster === 'object' && '_id' in wi.rateMaster)
            ? (wi.rateMaster as { _id: { toString: () => string } })._id.toString()
            : String(wi.rateMaster);
          const key = `${styleId}_${rateId}`;
          producedByStyleRate.set(key, (producedByStyleRate.get(key) || 0) + (wi.quantity || 0));
        }
      }
    }

    // Enrich each style: build entries from ALL rate masters (no style-rate mapping)
    const enriched = styles.map((s: {
      _id: unknown;
      month?: string;
      totalOrderQuantity?: number;
      clientCostPerPiece?: number;
    }) => {
      const styleId = (s._id as { toString: () => string }).toString();
      const totalOrderQty = (s as { totalOrderQuantity?: number }).totalOrderQuantity ?? 0;
      const sellingPricePerQty = (s as { clientCostPerPiece?: number }).clientCostPerPiece ?? 0;

      const rateItems = (allRates || []).map((r: { _id: unknown }) => {
        const rateId = String(r._id);
        const produced = producedByStyleRate.get(`${styleId}_${rateId}`) || 0;
        const available = Math.max(0, totalOrderQty - produced);
        return {
          rateMasterId: rateId,
          totalOrderQuantity: totalOrderQty,
          sellingPricePerQuantity: sellingPricePerQty,
          producedQuantity: produced,
          availableQuantity: available,
        };
      });

      return {
        ...s,
        monthData: { month: monthStr, totalOrderQuantity: totalOrderQty, sellingPricePerQuantity: sellingPricePerQty, entries: rateItems },
      };
    });

    return NextResponse.json(enriched);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
