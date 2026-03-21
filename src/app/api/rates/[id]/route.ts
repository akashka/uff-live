import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import connectDB from '@/lib/db';
import RateMaster from '@/lib/models/RateMaster';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await connectDB();
    const rate = await RateMaster.findById(id)
      .populate('branchRates.branch', 'name')
      .populate('branchDepartmentRates.branch', 'name')
      .populate('branchDepartmentRates.department', 'name')
      .lean();
    if (!rate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(rate);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    await connectDB();
    const rate = await RateMaster.findById(id);
    if (!rate) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.name !== undefined) rate.name = body.name;
    if (body.description !== undefined) rate.description = body.description;
    if (body.unit !== undefined) rate.unit = body.unit;
    if (body.isActive !== undefined) rate.isActive = body.isActive;

    if (body.branchRates !== undefined && Array.isArray(body.branchRates)) {
      const validRates = body.branchRates
        .filter((r: { branch: string; amount: number }) => r.branch && typeof r.amount === 'number' && r.amount >= 0)
        .map((r: { branch: string; amount: number }) => ({ branch: r.branch, amount: r.amount }));
      if (validRates.length > 0) {
        rate.branchRates = validRates as typeof rate.branchRates;
      }
    }

    if (body.branchId && body.departmentId && typeof body.amount === 'number' && body.amount >= 0) {
      const bdr = (rate.branchDepartmentRates || []) as { branch: { toString?: () => string }; department: { toString?: () => string }; amount: number }[];
      const idx = bdr.findIndex(
        (e) => String(e.branch?.toString?.() || e.branch) === body.branchId && String(e.department?.toString?.() || e.department) === body.departmentId
      );
      if (idx >= 0) {
        rate.branchDepartmentRates[idx].amount = body.amount;
      } else {
        rate.branchDepartmentRates.push({
          branch: body.branchId,
          department: body.departmentId,
          amount: body.amount,
        } as (typeof rate.branchDepartmentRates)[0]);
      }
    }

    await rate.save();
    revalidateTag('rates', 'default');

    logAudit({
      user,
      action: 'rate_update',
      entityType: 'rate',
      entityId: id,
      summary: `Rate "${rate.name}" updated`,
      metadata: { name: rate.name },
      req,
    }).catch(() => {});

    const updated = await RateMaster.findById(id)
      .populate('branchRates.branch', 'name')
      .populate('branchDepartmentRates.branch', 'name')
      .populate('branchDepartmentRates.department', 'name')
      .lean();
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
