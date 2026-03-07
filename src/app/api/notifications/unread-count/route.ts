import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Notification from '@/lib/models/Notification';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ count: 0 });

    await connectDB();
    const count = await Notification.countDocuments({
      recipientId: user.userId,
      readAt: null,
    });
    return NextResponse.json({ count });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ count: 0 });
  }
}
