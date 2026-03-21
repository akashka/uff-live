import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache, revalidateTag } from 'next/cache';
import connectDB from '@/lib/db';
import Branch from '@/lib/models/Branch';
import { getAuthUser, hasRole } from '@/lib/auth';
import { getUserBranchScope } from '@/lib/branchAccess';
import { logAudit } from '@/lib/audit';

async function fetchBranches(includeInactive: boolean) {
  await connectDB();
  const filter = includeInactive ? {} : { isActive: true };
  return Branch.find(filter).sort({ createdAt: -1 }).lean();
}

const getCachedBranches = unstable_cache(
  fetchBranches,
  ['branches'],
  { revalidate: 60, tags: ['branches'] }
);

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const scope = await getUserBranchScope(user);
    const branches = await getCachedBranches(includeInactive);
    const filtered = scope.isRestricted
      ? (branches as { _id: unknown }[]).filter((b) => scope.allowedBranchIds.includes(String(b._id)))
      : branches;
    return NextResponse.json(filtered);
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
    const { name, address, phoneNumber, email } = body;
    if (!name || !address || !phoneNumber) {
      return NextResponse.json({ error: 'Name, address and phone required' }, { status: 400 });
    }

    await connectDB();
    const branch = await Branch.create({ name, address, phoneNumber, email: email || '' });
    revalidateTag('branches', 'default');

    logAudit({
      user,
      action: 'branch_create',
      entityType: 'branch',
      entityId: branch._id.toString(),
      summary: `Branch "${name}" created`,
      metadata: { name, address },
      req,
    }).catch(() => {});

    return NextResponse.json(branch);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
