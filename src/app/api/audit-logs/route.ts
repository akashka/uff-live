import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import AuditLog from '@/lib/models/AuditLog';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden. Admin only.' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = (page - 1) * limit;
    const action = searchParams.get('action') || undefined;
    const entityType = searchParams.get('entityType') || undefined;
    const actorId = searchParams.get('actorId') || undefined;

    const filter: Record<string, unknown> = {};
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;
    if (actorId) filter.actorId = actorId;

    await connectDB();

    const [logs, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
    ]);

    return NextResponse.json({
      data: logs,
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
