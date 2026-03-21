import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache, revalidateTag } from 'next/cache';
import connectDB from '@/lib/db';
import RateMaster from '@/lib/models/RateMaster';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

type RateEntry = { branch: unknown; department?: unknown; amount: number };
type BranchRateEntry = { branch: unknown; amount: number };

async function fetchRates(includeInactive: boolean, branchId: string | null, departmentId: string | null) {
  await connectDB();
  const filter = includeInactive ? {} : { isActive: true };
  const rates = await RateMaster.find(filter)
    .populate('branchRates.branch', 'name')
    .populate('branchDepartmentRates.branch', 'name')
    .populate('branchDepartmentRates.department', 'name')
    .sort({ createdAt: -1 })
    .lean();

  if (!branchId) return rates as object[];

  const branchIdStr = String(branchId);
  const departmentIdStr = departmentId ? String(departmentId) : null;

  return (rates || []).filter((r) => {
    const bdr = (r.branchDepartmentRates as RateEntry[] | undefined) || [];
    const br = (r.branchRates as BranchRateEntry[] | undefined) || [];
    if (bdr.length > 0) {
      const match = bdr.find((e) => {
        const bid = e.branch && typeof e.branch === 'object' && '_id' in e.branch ? String((e.branch as { _id: unknown })._id) : String(e.branch);
        const did = e.department && typeof e.department === 'object' && '_id' in e.department ? String((e.department as { _id: unknown })._id) : String(e.department);
        return bid === branchIdStr && (!departmentIdStr || did === departmentIdStr);
      });
      return !!match;
    }
    return br.some((b) => {
      const bid = b.branch && typeof b.branch === 'object' && '_id' in b.branch ? String((b.branch as { _id: unknown })._id) : String(b.branch);
      return bid === branchIdStr;
    });
  }).map((r) => {
    const bdr = (r.branchDepartmentRates as RateEntry[] | undefined) || [];
    const br = (r.branchRates as BranchRateEntry[] | undefined) || [];
    let amount = 0;
    if (bdr.length > 0) {
      const match = bdr.find((e) => {
        const bid = e.branch && typeof e.branch === 'object' && '_id' in e.branch ? String((e.branch as { _id: unknown })._id) : String(e.branch);
        const did = e.department && typeof e.department === 'object' && '_id' in e.department ? String((e.department as { _id: unknown })._id) : String(e.department);
        return bid === branchIdStr && (!departmentIdStr || did === departmentIdStr);
      });
      amount = match?.amount ?? 0;
    } else if (br.length > 0) {
      const match = br.find((b) => {
        const bid = b.branch && typeof b.branch === 'object' && '_id' in b.branch ? String((b.branch as { _id: unknown })._id) : String(b.branch);
        return bid === branchIdStr;
      });
      amount = match?.amount ?? 0;
    }
    return { ...r, amountForBranch: amount };
  });
}

const getCachedRates = unstable_cache(
  fetchRates,
  ['rates'],
  { revalidate: 60, tags: ['rates'] }
);

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr']) && !user.employeeId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const branchId = searchParams.get('branch');
    const departmentId = searchParams.get('department');
    const rates = await getCachedRates(includeInactive, branchId, departmentId);
    return NextResponse.json(rates);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, description, unit, branchId, departmentId, amount } = body;

    if (!name || !unit) {
      return NextResponse.json({ error: 'Name and unit required' }, { status: 400 });
    }
    if (!branchId || !departmentId) {
      return NextResponse.json({ error: 'Branch and department required' }, { status: 400 });
    }
    const amt = typeof amount === 'number' ? amount : parseFloat(amount);
    if (typeof amt !== 'number' || amt < 0 || isNaN(amt)) {
      return NextResponse.json({ error: 'Valid amount required' }, { status: 400 });
    }

    await connectDB();
    const rate = await RateMaster.create({
      name,
      description: description || '',
      unit,
      branchDepartmentRates: [{ branch: branchId, department: departmentId, amount: amt }],
    });
    revalidateTag('rates', 'default');

    logAudit({
      user,
      action: 'rate_create',
      entityType: 'rate',
      entityId: rate._id.toString(),
      summary: `Rate "${name}" created`,
      metadata: { name, unit, branchId, departmentId },
      req,
    }).catch(() => {});

    const populated = await RateMaster.findById(rate._id)
      .populate('branchDepartmentRates.branch', 'name')
      .populate('branchDepartmentRates.department', 'name')
      .lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
