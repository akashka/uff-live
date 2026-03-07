import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import Notification from '@/lib/models/Notification';
import AuditLog from '@/lib/models/AuditLog';
import SystemConfig from '@/lib/models/SystemConfig';

const DEFAULT_RETENTION = {
  auditLogsDays: 365,
  notificationsDays: 90,
};

/** GET - Get retention policies. Admin only. */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const config = await SystemConfig.findOne({ key: 'retention' }).lean();
    const policies = (config?.value as Record<string, number>) || DEFAULT_RETENTION;

    return NextResponse.json({ policies });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

/** PATCH - Update retention policies. Admin only. */
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const auditLogsDays = typeof body.auditLogsDays === 'number' ? body.auditLogsDays : undefined;
    const notificationsDays = typeof body.notificationsDays === 'number' ? body.notificationsDays : undefined;

    await connectDB();
    const config = await SystemConfig.findOne({ key: 'retention' });
    const current = (config?.value as Record<string, number>) || { ...DEFAULT_RETENTION };
    if (auditLogsDays != null && auditLogsDays >= 0) current.auditLogsDays = auditLogsDays;
    if (notificationsDays != null && notificationsDays >= 0) current.notificationsDays = notificationsDays;

    await SystemConfig.findOneAndUpdate(
      { key: 'retention' },
      { $set: { value: current } },
      { upsert: true }
    );

    return NextResponse.json({ policies: current });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
