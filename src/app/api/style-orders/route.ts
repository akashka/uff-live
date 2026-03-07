import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import StyleOrder from '@/lib/models/StyleOrder';
import { getAuthUser, hasRole } from '@/lib/auth';
import { notifyAdminsIfNeeded } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const branchId = searchParams.get('branchId');
    const month = searchParams.get('month');

    let filter: Record<string, unknown> = {};
    if (!includeInactive) filter.isActive = true;
    if (branchId) filter.branches = branchId;
    if (month) filter['monthWiseData.month'] = month;

    const list = await StyleOrder.find(filter)
      .populate('branches', 'name _id')
      .populate('rateMasterItems', 'name unit _id')
      .sort({ styleCode: 1 })
      .lean();

    return NextResponse.json(list);
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
    const { styleCode, details, branches: branchesInput, rateMasterItems, monthWiseData } = body;

    const branchIds = Array.isArray(branchesInput) ? branchesInput : (branchesInput ? [branchesInput] : []);
    const rateIds = Array.isArray(rateMasterItems) ? rateMasterItems : [];
    if (!styleCode || branchIds.length === 0) {
      return NextResponse.json({ error: 'Style code and at least one branch required' }, { status: 400 });
    }
    if (rateIds.length === 0) {
      return NextResponse.json({ error: 'At least one rate master item is required' }, { status: 400 });
    }

    await connectDB();

    const existing = await StyleOrder.findOne({ styleCode });
    if (existing) {
      return NextResponse.json({ error: 'Style code already exists' }, { status: 400 });
    }

    const validMonthData = (Array.isArray(monthWiseData) ? monthWiseData : [])
      .filter((m: { month: string; totalOrderQuantity: number; sellingPricePerQuantity: number }) =>
        m.month && typeof m.totalOrderQuantity === 'number' && typeof m.sellingPricePerQuantity === 'number'
      )
      .map((m: { month: string; totalOrderQuantity: number; sellingPricePerQuantity: number }) => ({
        month: String(m.month || '').slice(0, 7),
        totalOrderQuantity: Math.max(0, m.totalOrderQuantity),
        sellingPricePerQuantity: Math.max(0, m.sellingPricePerQuantity),
      }));

    const doc = await StyleOrder.create({
      styleCode: String(styleCode).trim(),
      details: details || '',
      branches: branchIds.map((id: string) => new mongoose.Types.ObjectId(id)),
      rateMasterItems: rateIds,
      monthWiseData: validMonthData,
      isActive: true,
    });

    const populated = await StyleOrder.findById(doc._id)
      .populate('branches', 'name _id')
      .populate('rateMasterItems', 'name unit _id')
      .lean();

    notifyAdminsIfNeeded(user, {
      type: 'style_order_created',
      title: 'Style order created',
      message: `${user.role} created style order "${styleCode}".`,
      link: '/style-orders',
      metadata: { entityId: String(doc._id), entityType: 'style_order', actorId: user.userId, actorRole: user.role, styleCode },
    }).catch(() => {});

    logAudit({
      user,
      action: 'style_order_create',
      entityType: 'style_order',
      entityId: String(doc._id),
      summary: `Style order "${styleCode}" created`,
      metadata: { styleCode },
      req,
    }).catch(() => {});

    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
