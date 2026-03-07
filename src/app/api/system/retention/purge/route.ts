import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { getAuthUser, hasRole } from '@/lib/auth';
import Notification from '@/lib/models/Notification';
import AuditLog from '@/lib/models/AuditLog';
import SystemConfig from '@/lib/models/SystemConfig';

/** POST - Purge old data per retention policies. Admin only. */
export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const config = await SystemConfig.findOne({ key: 'retention' }).lean();
    const policies = (config?.value as { auditLogsDays?: number; notificationsDays?: number }) || {};
    const auditLogsDays = policies.auditLogsDays ?? 365;
    const notificationsDays = policies.notificationsDays ?? 90;

    const auditCutoff = new Date();
    auditCutoff.setDate(auditCutoff.getDate() - auditLogsDays);
    const notifCutoff = new Date();
    notifCutoff.setDate(notifCutoff.getDate() - notificationsDays);

    const [auditResult, notifResult] = await Promise.all([
      AuditLog.deleteMany({ createdAt: { $lt: auditCutoff } }),
      Notification.deleteMany({ createdAt: { $lt: notifCutoff } }),
    ]);

    return NextResponse.json({
      success: true,
      purged: {
        auditLogs: auditResult.deletedCount,
        notifications: notifResult.deletedCount,
      },
      cutoffDates: {
        auditLogs: auditCutoff.toISOString(),
        notifications: notifCutoff.toISOString(),
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Purge failed' }, { status: 500 });
  }
}
