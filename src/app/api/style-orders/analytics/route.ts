import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import StyleOrder from '@/lib/models/StyleOrder';
import RateMaster from '@/lib/models/RateMaster';
import WorkRecord from '@/lib/models/WorkRecord';
import { getAuthUser, hasRole } from '@/lib/auth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');

/** Style/order analytics: total order qty, total produced, selling price, mfg cost, profit/loss. Admin only for selling price & profit. */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const branchId = searchParams.get('branchId');
    const month = searchParams.get('month');
    const format = searchParams.get('format'); // 'excel' for export
    const isAdmin = hasRole(user, ['admin']);

    await connectDB();

    let filter: Record<string, unknown> = { isActive: true };
    if (branchId) filter.branches = branchId;
    if (month) filter['monthWiseData.month'] = month;

    const styles = await StyleOrder.find(filter)
      .populate('branches', 'name _id')
      .populate('rateMasterItems', 'name unit _id')
      .lean();

    const monthStr = month ? String(month).slice(0, 7) : null;
    const results: {
      _id: string;
      styleCode: string;
      branch: { name: string };
      month: string;
      rateMasterId: string;
      rateName: string;
      totalOrderQuantity: number;
      totalProducedQuantity: number;
      sellingPricePerQuantity: number;
      totalSellingPrice: number;
      manufacturingCost: number;
      profitLoss: number;
    }[] = [];

    for (const s of styles) {
      const branchesList = (s.branches || []) as { _id: unknown; name?: string }[];
      const monthDataList = (s.monthWiseData as { month: string; totalOrderQuantity: number; sellingPricePerQuantity: number }[]) || [];
      const monthsToProcess = monthStr ? monthDataList.filter((m) => m.month === monthStr) : monthDataList;
      const rateMasterIds = (s.rateMasterItems || []).map((r) =>
        r && typeof r === 'object' && '_id' in r ? (r as { _id: mongoose.Types.ObjectId })._id : r
      );

      for (const md of monthsToProcess) {
        const totalOrderQty = md.totalOrderQuantity ?? 0;
        const sellingPricePerQty = md.sellingPricePerQuantity ?? 0;

        for (let bi = 0; bi < branchesList.length; bi++) {
          const b = branchesList[bi];
          const branchIdForMatch = b._id && typeof b._id === 'object' ? (b._id as mongoose.Types.ObjectId) : b;
          const branchName = b?.name || '';

          for (const rateId of rateMasterIds) {
            const rateIdStr = String(rateId);
            const produced = await WorkRecord.aggregate([
              {
                $match: {
                  styleOrder: s._id,
                  branch: branchIdForMatch,
                  month: md.month,
                },
              },
              { $unwind: '$workItems' },
              { $match: { 'workItems.rateMaster': { $eq: new mongoose.Types.ObjectId(rateIdStr) } } },
              {
                $group: {
                  _id: null,
                  totalQty: { $sum: '$workItems.quantity' },
                  totalMfgCost: { $sum: '$workItems.amount' },
                },
              },
            ]);

            const producedQty = produced[0]?.totalQty ?? 0;
            const mfgCost = produced[0]?.totalMfgCost ?? 0;
            const totalSellingPrice = producedQty * sellingPricePerQty;
            const profitLoss = totalSellingPrice - mfgCost;

            const rateMaster = await RateMaster.findById(rateIdStr).select('name').lean();
            const rateName = (rateMaster as { name?: string })?.name || rateIdStr;

            results.push({
              _id: `${s._id}_${md.month}_${rateIdStr}_${String(branchIdForMatch)}`,
              styleCode: s.styleCode as string,
              branch: { name: branchName },
              month: md.month,
              rateMasterId: rateIdStr,
              rateName,
              totalOrderQuantity: totalOrderQty,
              totalProducedQuantity: producedQty,
              sellingPricePerQuantity: isAdmin ? sellingPricePerQty : 0,
              totalSellingPrice: isAdmin ? totalSellingPrice : 0,
              manufacturingCost: mfgCost,
              profitLoss: isAdmin ? profitLoss : 0,
            });
          }
        }
      }
    }

    // Summary: totalOrderQuantity counted once per (style, branch, month)
    const orderQtyByKey = new Map<string, number>();
    for (const r of results) {
      const key = `${r.styleCode}_${r.branch.name}_${r.month}`;
      if (!orderQtyByKey.has(key)) orderQtyByKey.set(key, r.totalOrderQuantity);
    }
    const summary = {
      totalOrderQuantity: [...orderQtyByKey.values()].reduce((a, b) => a + b, 0),
      totalProducedQuantity: results.reduce((s, r) => s + r.totalProducedQuantity, 0),
      totalManufacturingCost: results.reduce((s, r) => s + r.manufacturingCost, 0),
      totalSellingPrice: isAdmin ? results.reduce((s, r) => s + r.totalSellingPrice, 0) : 0,
      totalProfitLoss: isAdmin ? results.reduce((s, r) => s + r.profitLoss, 0) : 0,
    };

    if (format === 'excel') {
      const formatMonth = (m: string) => {
        if (!m || m.length < 7) return m;
        const d = new Date(m + '-01');
        return d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      };
      const rows = results.map((r) => ({
        'Style Code': r.styleCode,
        Branch: r.branch?.name || '-',
        Month: formatMonth(r.month),
        'Rate Name': r.rateName,
        'Order Qty': r.totalOrderQuantity,
        Produced: r.totalProducedQuantity,
        ...(isAdmin
          ? {
              'Mfg Cost (₹)': r.manufacturingCost,
              'Selling Price (₹)': r.totalSellingPrice,
              'Profit/Loss (₹)': r.profitLoss,
            }
          : {}),
      }));
      const ws = XLSX.utils.json_to_sheet(rows);
      const wsSummary = XLSX.utils.json_to_sheet([
        { Metric: 'Total Order Qty', Value: summary.totalOrderQuantity },
        { Metric: 'Total Produced', Value: summary.totalProducedQuantity },
        { Metric: 'Total Mfg Cost (₹)', Value: summary.totalManufacturingCost },
        ...(isAdmin
          ? [
              { Metric: 'Total Selling Price (₹)', Value: summary.totalSellingPrice },
              { Metric: 'Total Profit/Loss (₹)', Value: summary.totalProfitLoss },
            ]
          : []),
      ]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Analytics');
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `analytics_${month || 'all'}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({ data: results, summary });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
