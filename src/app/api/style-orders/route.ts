import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import StyleOrder from '@/lib/models/StyleOrder';
import Branch from '@/lib/models/Branch';
import '@/lib/models/RateMaster'; // Register for populate('rateMasterItems')
import { getAuthUser, hasRole } from '@/lib/auth';
import { notifyAdminsIfNeeded } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const branchId = searchParams.get('branchId');
    const month = searchParams.get('month');

    let filter: Record<string, unknown> = {};
    if (!includeInactive) filter.isActive = true;
    if (branchId) filter.branches = branchId;
    if (month) filter.month = String(month).slice(0, 7);

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
    const {
      styleCode,
      brand,
      details,
      branches: branchesInput,
      month,
      totalOrderQuantity,
      clientCostPerPiece,
      clientCostTotalAmount,
    } = body;

    let branchIds = Array.isArray(branchesInput) ? branchesInput : (branchesInput ? [branchesInput] : []);
    await connectDB();
    if (branchIds.length === 0) {
      const allBranches = await Branch.find({ isActive: true }).select('_id').lean();
      branchIds = (allBranches || []).map((b) => String((b as { _id: unknown })._id));
    }
    if (!styleCode || !brand || branchIds.length === 0) {
      return NextResponse.json({ error: 'Style code, brand required. Add at least one branch to the system.' }, { status: 400 });
    }

    const codeStr = String(styleCode).trim();
    if (!/^\d{4}$/.test(codeStr)) {
      return NextResponse.json({ error: 'Style code must be a 4-digit number (e.g. 0001)' }, { status: 400 });
    }

    const brandStr = String(brand).trim();
    if (!brandStr) {
      return NextResponse.json({ error: 'Brand is required' }, { status: 400 });
    }

    const existing = await StyleOrder.findOne({ brand: brandStr, styleCode: codeStr });
    if (existing) {
      return NextResponse.json({ error: `Style code ${codeStr} with brand "${brandStr}" already exists` }, { status: 400 });
    }

    const now = new Date();
    const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthStr = (typeof month === 'string' && month.length >= 7) ? String(month).slice(0, 7) : defaultMonth;
    const qty = Math.max(0, Number(totalOrderQuantity) || 0);
    const perPiece = Math.max(0, Number(clientCostPerPiece) || 0);
    const totalCostRaw = Math.max(0, Number(clientCostTotalAmount) || 0);
    const totalCost = totalCostRaw > 0 ? totalCostRaw : (qty > 0 && perPiece > 0 ? qty * perPiece : 0);

    const doc = await StyleOrder.create({
      styleCode: codeStr,
      brand: brandStr,
      details: details || '',
      branches: branchIds.map((id: string) => new mongoose.Types.ObjectId(id)),
      rateMasterItems: [],
      month: monthStr,
      totalOrderQuantity: qty,
      clientCostPerPiece: perPiece,
      clientCostTotalAmount: totalCost,
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
      metadata: { entityId: String(doc._id), entityType: 'style_order', actorId: user.userId, actorRole: user.role, styleCode: codeStr, brand: brandStr },
    }).catch(() => {});

    logAudit({
      user,
      action: 'style_order_create',
      entityType: 'style_order',
      entityId: String(doc._id),
      summary: `Style order "${styleCode}" created`,
      metadata: { styleCode: codeStr, brand: brandStr },
      req,
    }).catch(() => {});

    return NextResponse.json(populated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
