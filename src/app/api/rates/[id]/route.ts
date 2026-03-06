import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import RateMaster from '@/lib/models/RateMaster';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await connectDB();
    const rate = await RateMaster.findById(id)
      .populate('branchRates.branch', 'name')
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
        rate.branchRates = validRates;
      }
    }

    await rate.save();
    const updated = await RateMaster.findById(id)
      .populate('branchRates.branch', 'name')
      .lean();
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
