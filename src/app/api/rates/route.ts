import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import RateMaster from '@/lib/models/RateMaster';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const branchId = searchParams.get('branch');
    const filter = includeInactive ? {} : { isActive: true };
    let rates = await RateMaster.find(filter)
      .populate('branchRates.branch', 'name')
      .sort({ createdAt: -1 })
      .lean();

    if (branchId) {
      const branchIdStr = String(branchId);
      const withAmount = (rates || []).map((r) => {
        const br = (r.branchRates as { branch: unknown; amount: number }[] | undefined)?.find((b) => {
          const bid = b.branch && typeof b.branch === 'object' && '_id' in b.branch
            ? String((b.branch as { _id: unknown })._id)
            : String(b.branch);
          return bid === branchIdStr;
        });
        return { ...r, amountForBranch: br?.amount ?? 0 };
      });
      return NextResponse.json(withAmount);
    }
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
    const { name, description, unit, branchRates } = body;

    if (!name || !unit) {
      return NextResponse.json({ error: 'Name and unit required' }, { status: 400 });
    }
    if (!Array.isArray(branchRates) || branchRates.length === 0) {
      return NextResponse.json({ error: 'At least one branch rate required' }, { status: 400 });
    }

    const validRates = branchRates
      .filter((r: { branch: string; amount: number }) => r.branch && typeof r.amount === 'number' && r.amount >= 0)
      .map((r: { branch: string; amount: number }) => ({ branch: r.branch, amount: r.amount }));

    if (validRates.length === 0) {
      return NextResponse.json({ error: 'Valid branch rates required' }, { status: 400 });
    }

    await connectDB();
    const rate = await RateMaster.create({ name, description: description || '', unit, branchRates: validRates });
    const populated = await RateMaster.findById(rate._id)
      .populate('branchRates.branch', 'name')
      .lean();
    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
