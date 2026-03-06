import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import { getAuthUser, hasRole } from '@/lib/auth';
import { generatePassword } from '@/lib/utils';
import bcrypt from 'bcryptjs';

export async function GET(req: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(authUser, ['admin'])) return NextResponse.json({ error: 'Forbidden. Admin only.' }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type'); // 'admin' | 'all'

    let filter: Record<string, unknown> = {};
    if (type === 'admin') {
      filter = { role: 'admin', employeeId: null };
    }

    const users = await User.find(filter)
      .select('email role isActive employeeId createdAt')
      .populate('employeeId', 'name email employeeType')
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json(users);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await getAuthUser();
    if (!authUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(authUser, ['admin'])) return NextResponse.json({ error: 'Forbidden. Admin only.' }, { status: 403 });

    const body = await req.json();
    const { email, password } = body;

    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    await connectDB();

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    const pwd = password || generatePassword(12);
    const hashedPassword = await bcrypt.hash(pwd, 12);

    const user = await User.create({
      email,
      password: hashedPassword,
      role: 'admin',
      isActive: true,
    });

    const created = await User.findById(user._id).select('email role isActive createdAt').lean();
    return NextResponse.json({ user: created, generatedPassword: password ? undefined : pwd });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
