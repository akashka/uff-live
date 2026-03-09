import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import { getAuthUser, hasRole } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { logAudit } from '@/lib/audit';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(authUser, ['admin'])) return NextResponse.json({ error: 'Forbidden. Admin only.' }, { status: 403 });

    const { id } = await params;
    const body = await req.json();

    await connectDB();
    const user = await User.findById(id);
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    if (body.email !== undefined) {
      const existing = await User.findOne({ email: body.email, _id: { $ne: id } });
      if (existing) return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      user.email = body.email;
    }
    if (body.password !== undefined && body.password.trim()) {
      user.password = await bcrypt.hash(body.password, 12);
    }
    if (body.isActive !== undefined) user.isActive = body.isActive;
    if (body.role !== undefined && ['admin', 'finance', 'accountancy', 'hr', 'employee'].includes(body.role)) {
      user.role = body.role;
    }

    await user.save();
    const updated = await User.findById(id).select('email role isActive employeeId createdAt').lean();

    logAudit({
      user: authUser,
      action: 'user_update',
      entityType: 'user',
      entityId: id,
      summary: `User "${user.email}" updated`,
      metadata: { email: user.email },
      req,
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
