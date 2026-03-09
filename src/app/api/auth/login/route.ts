import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { signToken } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { loginId, password } = body;

    if (!loginId || !password) {
      return NextResponse.json({ error: 'Login ID and password required' }, { status: 400 });
    }

    const id = String(loginId).trim();

    await connectDB();
    let user = await User.findOne({ email: id, isActive: true });
    if (!user) {
      const empByPhone = await Employee.findOne({ contactNumber: id });
      if (empByPhone) {
        user = await User.findOne({ employeeId: empByPhone._id, isActive: true });
      }
    }
    if (!user) {
      const empById = await Employee.findOne({ employeeId: { $regex: new RegExp(`^${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } });
      if (empById) {
        user = await User.findOne({ employeeId: empById._id, isActive: true });
      }
    }
    if (!user) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
    }

    logAudit({
      actorId: user._id.toString(),
      actorEmail: user.email,
      actorRole: user.role,
      action: 'login',
      entityType: 'auth',
      entityId: null,
      summary: `User ${user.email} logged in`,
      req,
    }).catch(() => {});

    const token = signToken({
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      employeeId: user.employeeId?.toString(),
    });

    const res = NextResponse.json({ success: true });
    res.cookies.set('auth-token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    return res;
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
