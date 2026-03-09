import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import StyleOrder from '@/lib/models/StyleOrder';
import WorkRecord from '@/lib/models/WorkRecord';
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
      'monthWiseData.month': monthStr,
    })
      .populate('branches', 'name _id')
      .populate('rateMasterItems', 'name unit _id')
      .lean();

    // Get produced quantities: work records for this branch+month with this style
    const styleIds = styles.map((s: { _id: { toString: () => string } }) => s._id.toString());

    const producedByStyleRate = new Map<string, number>(); // key: styleId_rateMasterId
    if (styleIds.length > 0) {
      const workRecords = await WorkRecord.find({
        branch: branchId,
        month: monthStr,
        styleOrder: { $in: styleIds },
      })
        .select('styleOrder workItems')
        .lean();

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
    }

    // Enrich each style: build entries from rateMasterItems using overall totalOrderQuantity per month
    const enriched = styles.map((s: {
      _id: unknown;
      rateMasterItems?: { _id: unknown; name?: string; unit?: string }[];
      monthWiseData?: { month: string; totalOrderQuantity: number; sellingPricePerQuantity: number }[];
    }) => {
      const styleId = (s._id as { toString: () => string }).toString();
      const monthData = (s.monthWiseData || []).find((m) => m.month === monthStr);
      const totalOrderQty = monthData?.totalOrderQuantity ?? 0;
      const sellingPricePerQty = monthData?.sellingPricePerQuantity ?? 0;

      const rateItems = (s.rateMasterItems || []).map((r) => {
        const rateId = (r && typeof r === 'object' && '_id' in r)
          ? String((r as { _id: unknown })._id)
          : String(r);
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
        monthData: monthData ? { ...monthData, entries: rateItems } : null,
      };
    });

    return NextResponse.json(enriched);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
