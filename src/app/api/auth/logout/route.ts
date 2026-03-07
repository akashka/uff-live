import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: Request) {
  const user = await getAuthUser();
  if (user) {
    logAudit({
      user,
      action: 'logout',
      entityType: 'auth',
      entityId: null,
      summary: `User ${user.email} logged out`,
      req,
    }).catch(() => {});
  }
  const res = NextResponse.json({ success: true });
  res.cookies.set('auth-token', '', { maxAge: 0, path: '/' });
  return res;
}
