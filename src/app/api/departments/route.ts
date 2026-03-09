import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache, revalidateTag } from 'next/cache';
import connectDB from '@/lib/db';
import Department from '@/lib/models/Department';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

async function fetchDepartments(includeInactive: boolean) {
  await connectDB();
  const filter = includeInactive ? {} : { isActive: true };
  return Department.find(filter).sort({ name: 1 }).lean();
}

const getCachedDepartments = unstable_cache(
  fetchDepartments,
  ['departments'],
  { revalidate: 60, tags: ['departments'] }
);

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const departments = await getCachedDepartments(includeInactive);
    return NextResponse.json(departments);
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
    const { name, description } = body;
    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await connectDB();
    const department = await Department.create({ name: name.trim(), description: description?.trim() || '' });
    revalidateTag('departments', 'default');

    logAudit({
      user,
      action: 'department_create',
      entityType: 'department',
      entityId: department._id.toString(),
      summary: `Department "${name}" created`,
      metadata: { name },
      req,
    }).catch(() => {});

    return NextResponse.json(department);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
