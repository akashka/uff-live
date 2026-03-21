import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import StyleOrder from '@/lib/models/StyleOrder';
import '@/lib/models/RateMaster'; // Register for populate('rateMasterItems')
import { getAuthUser, hasRole } from '@/lib/auth';
import { areBranchesAllowed, getUserBranchScope } from '@/lib/branchAccess';
import { notifyAdminsIfNeeded } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await connectDB();
    const scope = await getUserBranchScope(user);
    const doc = await StyleOrder.findById(id)
      .populate('branches', 'name _id')
      .populate('rateMasterItems', 'name unit _id')
      .lean();
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (scope.isRestricted) {
      const docBranchIds = ((doc as { branches?: unknown[] }).branches || []).map((b) =>
        b && typeof b === 'object' && '_id' in (b as Record<string, unknown>) ? String((b as { _id: unknown })._id) : String(b)
      );
      const canAccess = docBranchIds.some((bid) => scope.allowedBranchIds.includes(bid));
      if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
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
    const scope = await getUserBranchScope(user);
    const doc = await StyleOrder.findById(id);
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (scope.isRestricted) {
      const docBranchIds = ((doc.branches || []) as unknown[]).map((b) => String(b));
      const canAccess = docBranchIds.some((bid) => scope.allowedBranchIds.includes(bid));
      if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { styleCode, brand, colour: colourInput, details, branches: branchesInput, totalOrderQuantity, clientCostPerPiece, clientCostTotalAmount, isActive } = body;

    const newCode = styleCode !== undefined ? String(styleCode).trim() : doc.styleCode;
    const newBrand = brand !== undefined ? String(brand).trim() : doc.brand;
    const newColour = colourInput !== undefined ? String(colourInput).trim() : (doc.colour ?? '');
    const monthVal = doc.month ?? '';

    if (styleCode !== undefined) {
      if (!/^\d{4}$/.test(newCode)) {
        return NextResponse.json({ error: 'Style code must be a 4-digit number (e.g. 0001)' }, { status: 400 });
      }
      doc.styleCode = newCode;
    }
    if (brand !== undefined) {
      doc.brand = newBrand;
      doc.markModified('brand');
    }

    // Check unique brand+code+month+colour when any changed (month is never editable)
    if (styleCode !== undefined || brand !== undefined || colourInput !== undefined) {
      const existing = await StyleOrder.findOne({ brand: newBrand, styleCode: newCode, month: monthVal, colour: newColour, _id: { $ne: id } });
      if (existing) {
        return NextResponse.json({ error: `Style code ${newCode} with brand "${newBrand}", month ${monthVal} and colour "${newColour || '(none)'}" already exists` }, { status: 400 });
      }
    }
    if (details !== undefined) doc.details = details;
    if (colourInput !== undefined) {
      doc.colour = String(colourInput).trim();
      doc.markModified('colour');
    }
    if (Array.isArray(branchesInput) && branchesInput.length > 0) {
      const nextBranchIds = branchesInput.map((b: string) => String(b));
      if (!areBranchesAllowed(scope, nextBranchIds)) {
        return NextResponse.json({ error: 'Forbidden: branch access denied' }, { status: 403 });
      }
      doc.branches = nextBranchIds.map((b: string) => new mongoose.Types.ObjectId(b));
    }
    doc.rateMasterItems = [];
    if (isActive !== undefined) doc.isActive = isActive;

    // Month is never editable - always disabled in UI for edit
    if (totalOrderQuantity !== undefined && totalOrderQuantity !== null) {
      doc.totalOrderQuantity = Math.max(0, Number(totalOrderQuantity) || 0);
      doc.markModified('totalOrderQuantity');
    }
    if (clientCostPerPiece !== undefined && clientCostPerPiece !== null) {
      doc.clientCostPerPiece = Math.max(0, Number(clientCostPerPiece) || 0);
      doc.markModified('clientCostPerPiece');
    }
    if (clientCostTotalAmount !== undefined && clientCostTotalAmount !== null) {
      doc.clientCostTotalAmount = Math.max(0, Number(clientCostTotalAmount) || 0);
      doc.markModified('clientCostTotalAmount');
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

    logAudit({
      user,
      action: 'style_order_update',
      entityType: 'style_order',
      entityId: id,
      summary: `Style order "${doc.styleCode}" updated`,
      metadata: { styleCode: doc.styleCode },
      req,
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
    const scope = await getUserBranchScope(user);
    const doc = await StyleOrder.findById(id).lean();
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (scope.isRestricted) {
      const docBranchIds = ((doc as { branches?: unknown[] }).branches || []).map((b) => String(b));
      const canAccess = docBranchIds.some((bid) => scope.allowedBranchIds.includes(bid));
      if (!canAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const styleCode = (doc as { styleCode?: string }).styleCode || 'Unknown';
    await StyleOrder.findByIdAndDelete(id);

    notifyAdminsIfNeeded(user, {
      type: 'style_order_deleted',
      title: 'Style order deleted',
      message: `${user.role} deleted style order "${styleCode}".`,
      link: '/style-orders',
      metadata: { entityId: id, entityType: 'style_order', actorId: user.userId, actorRole: user.role, styleCode },
    }).catch(() => {});

    logAudit({
      user,
      action: 'style_order_delete',
      entityType: 'style_order',
      entityId: id,
      summary: `Style order "${styleCode}" deleted`,
      metadata: { styleCode },
      req,
    }).catch(() => {});

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
