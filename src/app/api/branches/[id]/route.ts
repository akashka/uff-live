import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import connectDB from '@/lib/db';
import Branch from '@/lib/models/Branch';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await connectDB();
    const branch = await Branch.findById(id).lean();
    if (!branch) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(branch);
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
    const { name, address, phoneNumber, email, isActive } = body;

    await connectDB();
    const branch = await Branch.findById(id);
    if (!branch) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (name !== undefined) branch.name = name;
    if (address !== undefined) branch.address = address;
    if (phoneNumber !== undefined) branch.phoneNumber = phoneNumber;
    if (email !== undefined) branch.email = email;
    if (isActive !== undefined) branch.isActive = isActive;

    await branch.save();
    revalidateTag('branches', 'default');

    logAudit({
      user,
      action: 'branch_update',
      entityType: 'branch',
      entityId: id,
      summary: `Branch "${branch.name}" updated`,
      metadata: { name: branch.name, isActive: branch.isActive },
      req,
    }).catch(() => {});

    return NextResponse.json(branch);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
