import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import connectDB from '@/lib/db';
import Department from '@/lib/models/Department';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    await connectDB();
    const department = await Department.findById(id).lean();
    if (!department) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(department);
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
    const { name, description, isActive } = body;

    await connectDB();
    const department = await Department.findById(id);
    if (!department) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    if (name !== undefined) department.name = name;
    if (description !== undefined) department.description = description;
    if (isActive !== undefined) department.isActive = isActive;

    await department.save();
    revalidateTag('departments', 'default');

    logAudit({
      user,
      action: 'department_update',
      entityType: 'department',
      entityId: id,
      summary: `Department "${department.name}" updated`,
      metadata: { name: department.name, isActive: department.isActive },
      req,
    }).catch(() => {});

    return NextResponse.json(department);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
