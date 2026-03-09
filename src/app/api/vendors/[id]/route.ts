import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Vendor from '@/lib/models/Vendor';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await connectDB();
    const vendor = await Vendor.findById(id).lean();
    if (!vendor) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(vendor);
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
    const vendor = await Vendor.findById(id);
    if (!vendor) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (body.vendorId !== undefined) return NextResponse.json({ error: 'Vendor ID cannot be changed' }, { status: 400 });

    if (body.name !== undefined) vendor.name = body.name;
    if (body.contactNumber !== undefined) vendor.contactNumber = body.contactNumber;
    if (body.email !== undefined) vendor.email = body.email;
    if (body.serviceType !== undefined) vendor.serviceType = body.serviceType;
    if (body.address !== undefined) vendor.address = body.address;
    if (body.bankName !== undefined) vendor.bankName = body.bankName;
    if (body.bankBranch !== undefined) vendor.bankBranch = body.bankBranch;
    if (body.ifscCode !== undefined) vendor.ifscCode = body.ifscCode;
    if (body.accountNumber !== undefined) vendor.accountNumber = body.accountNumber;
    if (body.upiId !== undefined) vendor.upiId = body.upiId;
    if (body.panNumber !== undefined) vendor.panNumber = body.panNumber;
    if (body.gstNumber !== undefined) vendor.gstNumber = body.gstNumber;
    if (body.notes !== undefined) vendor.notes = body.notes;
    if (body.isActive !== undefined) vendor.isActive = body.isActive;

    await vendor.save();

    logAudit({
      user,
      action: 'vendor_update',
      entityType: 'vendor',
      entityId: id,
      summary: `Vendor "${vendor.name}" updated`,
      metadata: { vendorName: vendor.name },
      req,
    }).catch(() => {});

    const updated = await Vendor.findById(id).lean();
    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
