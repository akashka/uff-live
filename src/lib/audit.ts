import connectDB from '@/lib/db';
import AuditLog from '@/lib/models/AuditLog';
import type { JWTPayload } from '@/lib/auth';
import type { AuditAction } from '@/lib/models/AuditLog';

export interface AuditParams {
  user?: JWTPayload | null;
  /** For login: pass user data from DB since JWT not yet set */
  actorEmail?: string;
  actorId?: string;
  actorRole?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, unknown>;
  req?: Request;
}

/**
 * Log an audit event. Fire-and-forget; does not throw.
 * Use after successful mutations to record who did what.
 */
export async function logAudit(params: AuditParams): Promise<void> {
  try {
    await connectDB();

    const actorId = params.user?.userId ?? params.actorId ?? null;
    const actorEmail = params.user?.email ?? params.actorEmail ?? null;
    const actorRole = params.user?.role ?? params.actorRole ?? null;

    let ipAddress: string | undefined;
    let userAgent: string | undefined;
    if (params.req) {
      const headers = params.req.headers;
      ipAddress = headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? headers.get('x-real-ip') ?? undefined;
      userAgent = headers.get('user-agent') ?? undefined;
    }

    await AuditLog.create({
      action: params.action,
      actorId,
      actorEmail,
      actorRole,
      entityType: params.entityType,
      entityId: params.entityId ?? null,
      summary: params.summary,
      metadata: params.metadata ?? {},
      ipAddress,
      userAgent,
    });
  } catch (err) {
    console.error('[Audit] Failed to log:', err);
  }
}
