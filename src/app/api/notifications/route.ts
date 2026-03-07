import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Notification from '@/lib/models/Notification';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const unreadParam = searchParams.get('unread');
    const unreadOnly = unreadParam === 'true';
    const readOnly = unreadParam === 'false';
    const type = searchParams.get('type'); // filter by notification type
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = { recipientId: user.userId };
    if (unreadOnly) filter.readAt = null;
    if (readOnly) filter.readAt = { $ne: null };
    if (type) filter.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientId: user.userId, readAt: null }),
    ]);

    return NextResponse.json({
      data: notifications,
      total,
      page,
      limit,
      hasMore: page * limit < total,
      unreadCount,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
