import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import { generateOTP } from '@/lib/utils';
import { resetStore } from '@/lib/otp-store';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    await connectDB();
    const user = await User.findOne({ email, isActive: true });
    if (!user) {
      return NextResponse.json({ error: 'No account found with this email' }, { status: 404 });
    }

    const otp = generateOTP(6);
    resetStore.set(email, { otp, expires: Date.now() + 15 * 60 * 1000 });

    console.log(`[DEV] Reset OTP for ${email}: ${otp}`);

    return NextResponse.json({ success: true, message: 'Reset OTP sent' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
