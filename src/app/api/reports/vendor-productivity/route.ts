import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import Vendor from '@/lib/models/Vendor';
import Branch from '@/lib/models/Branch';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const vendorId = searchParams.get('vendorId') || '';
    const branchId = searchParams.get('branchId') || '';
    const monthFrom = searchParams.get('monthFrom') || '';
    const monthTo = searchParams.get('monthTo') || '';

    await connectDB();

    const filter: Record<string, unknown> = {};
    if (vendorId) filter.vendor = vendorId;
    if (branchId) filter.branch = branchId;

    if (monthFrom || monthTo) {
      filter.month = {};
      if (monthFrom) (filter.month as Record<string, string>).$gte = monthFrom.slice(0, 7);
      if (monthTo) (filter.month as Record<string, string>).$lte = monthTo.slice(0, 7);
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      filter.month = { $gte: `${y - 1}-01`, $lte: `${y}-${String(m).padStart(2, '0')}` };
    }

    const byVendorMonth = await VendorWorkOrder.aggregate([
      { $match: filter },
      { $group: { _id: { vendor: '$vendor', month: '$month' }, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.month': 1 } },
    ]);

    const vendorIds = [...new Set((byVendorMonth || []).map((x) => String(x._id.vendor)))];
    const vendors = vendorIds.length > 0 ? await Vendor.find({ _id: { $in: vendorIds } }).select('name vendorId').lean() : [];

    const vendorMap = new Map<string, { name: string; vendorId?: string }>();
    for (const v of vendors || []) {
      vendorMap.set(String((v as { _id?: unknown })._id), {
        name: (v as { name?: string }).name || '',
        vendorId: (v as { vendorId?: string }).vendorId,
      });
    }

    const byVendor: Record<
      string,
      { vendorName: string; vendorId?: string; months: { month: string; amount: number; count: number }[]; total: number }
    > = {};

    for (const row of byVendorMonth || []) {
      const vid = String(row._id.vendor);
      const month = row._id.month;
      const amount = row.totalAmount ?? 0;
      const count = row.count ?? 0;

      if (!byVendor[vid]) {
        const vend = vendorMap.get(vid);
        byVendor[vid] = {
          vendorName: vend?.name || vid,
          vendorId: vend?.vendorId,
          months: [],
          total: 0,
        };
      }
      byVendor[vid].months.push({ month, amount, count });
      byVendor[vid].total += amount;
    }

    const data = Object.entries(byVendor)
      .map(([id, v]) => ({ vendorId: id, ...v }))
      .sort((a, b) => b.total - a.total);

    const branches = branchId ? [] : await Branch.find({ isActive: true }).select('name _id').lean();
    return NextResponse.json({
      data,
      vendors: Array.from(vendorMap.entries()).map(([id, v]) => ({ id, ...v })),
      branches: (branches || []).map((b) => ({ id: (b as { _id?: unknown })._id, name: (b as { name?: string }).name })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch vendor productivity' }, { status: 500 });
  }
}
