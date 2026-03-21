import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Vendor from '@/lib/models/Vendor';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limitParam = searchParams.get('limit');
    const limit = limitParam === '0' || limitParam === 'all' ? 10000 : Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limitParam || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
    const search = searchParams.get('search') || undefined;

    await connectDB();

    const filter: Record<string, unknown> = includeInactive ? {} : { isActive: true };
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { name: regex },
        { contactNumber: { $regex: q } },
        { vendorId: { $regex: q } },
      ];
    }

    const skip = (page - 1) * limit;
    const [vendors, total] = await Promise.all([
      Vendor.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Vendor.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: vendors,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    });
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
    const { name, contactNumber, email, address, bankName, bankBranch, ifscCode, accountNumber, upiId, panNumber, gstNumber, notes } = body;

    if (!name || !contactNumber) {
      return NextResponse.json({ error: 'Name and contact number are required' }, { status: 400 });
    }

    await connectDB();

    const allWithId = await Vendor.find({ vendorId: /^VEN\d+$/i }).select('vendorId').lean();
    let maxNum = 0;
    for (const v of allWithId) {
      const match = String(v.vendorId).match(/^VEN(\d+)$/i);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    const vendorId = `VEN${String(maxNum + 1).padStart(3, '0')}`;

    const vendor = await Vendor.create({
      vendorId,
      name,
      contactNumber,
      email: email || '',
      serviceType,
      address: address || '',
      bankName: bankName || '',
      bankBranch: bankBranch || '',
      ifscCode: ifscCode || '',
      accountNumber: accountNumber || '',
      upiId: upiId || '',
      panNumber: panNumber || '',
      gstNumber: gstNumber || '',
      notes: notes || '',
    });

    logAudit({
      user,
      action: 'vendor_create',
      entityType: 'vendor',
      entityId: String(vendor._id),
      summary: `Vendor "${name}" created`,
      metadata: { vendorName: name },
      req,
    }).catch(() => {});

    return NextResponse.json(vendor);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
