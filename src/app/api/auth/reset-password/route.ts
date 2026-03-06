import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import { resetStore } from '@/lib/otp-store';

export async function POST(req: NextRequest) {
  try {
    const { email, otp, newPassword } = await req.json();
    if (!email || !otp || !newPassword) {
      return NextResponse.json({ error: 'Email, OTP and new password required' }, { status: 400 });
    }

    if (newPassword.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const stored = resetStore.get(email);
    if (!stored || stored.otp !== otp) {
      return NextResponse.json({ error: 'Invalid or expired OTP' }, { status: 401 });
    }
    if (Date.now() > stored.expires) {
      resetStore.delete(email);
      return NextResponse.json({ error: 'OTP expired' }, { status: 401 });
    }

    resetStore.delete(email);

    await connectDB();
    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    user.password = newPassword;
    await user.save();

    return NextResponse.json({ success: true, message: 'Password reset successful' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
