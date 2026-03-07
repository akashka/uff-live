import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import StyleOrder from '@/lib/models/StyleOrder';
import { getAuthUser, hasRole } from '@/lib/auth';
import { notifyAdminsIfNeeded } from '@/lib/notifications';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await connectDB();
    const doc = await StyleOrder.findById(id)
      .populate('branches', 'name _id')
      .populate('rateMasterItems', 'name unit _id')
      .lean();
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(doc);
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

    await connectDB();
    const doc = await StyleOrder.findById(id);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const { styleCode, details, branches: branchesInput, rateMasterItems, monthWiseData, isActive } = body;

    if (styleCode !== undefined) doc.styleCode = String(styleCode).trim();
    if (details !== undefined) doc.details = details;
    if (Array.isArray(branchesInput) && branchesInput.length > 0) {
      doc.branches = branchesInput.map((b: string) => new mongoose.Types.ObjectId(b));
    }
    if (Array.isArray(rateMasterItems)) {
      if (rateMasterItems.length === 0) {
        return NextResponse.json({ error: 'At least one rate master item is required' }, { status: 400 });
      }
      doc.rateMasterItems = rateMasterItems;
    }
    if (isActive !== undefined) doc.isActive = isActive;

    if (Array.isArray(monthWiseData)) {
      const validMonthData = monthWiseData
        .filter((m: { month: string; totalOrderQuantity: number; sellingPricePerQuantity: number }) =>
          m.month && typeof m.totalOrderQuantity === 'number' && typeof m.sellingPricePerQuantity === 'number'
        )
        .map((m: { month: string; totalOrderQuantity: number; sellingPricePerQuantity: number }) => ({
          month: String(m.month || '').slice(0, 7),
          totalOrderQuantity: Math.max(0, m.totalOrderQuantity),
          sellingPricePerQuantity: Math.max(0, m.sellingPricePerQuantity),
        }));
      doc.monthWiseData = validMonthData as typeof doc.monthWiseData;
    }

    await doc.save();
    const updated = await StyleOrder.findById(id)
      .populate('branches', 'name _id')
      .populate('rateMasterItems', 'name unit _id')
      .lean();

    notifyAdminsIfNeeded(user, {
      type: 'style_order_updated',
      title: 'Style order updated',
      message: `${user.role} updated style order "${doc.styleCode}".`,
      link: '/style-orders',
      metadata: { entityId: id, entityType: 'style_order', actorId: user.userId, actorRole: user.role, styleCode: doc.styleCode },
    }).catch(() => {});

    return NextResponse.json(updated);
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
    const doc = await StyleOrder.findById(id).lean();
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const styleCode = (doc as { styleCode?: string }).styleCode || 'Unknown';
    await StyleOrder.findByIdAndDelete(id);

    notifyAdminsIfNeeded(user, {
      type: 'style_order_deleted',
      title: 'Style order deleted',
      message: `${user.role} deleted style order "${styleCode}".`,
      link: '/style-orders',
      metadata: { entityId: id, entityType: 'style_order', actorId: user.userId, actorRole: user.role, styleCode },
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
