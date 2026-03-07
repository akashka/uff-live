import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Notification from '@/lib/models/Notification';
import User from '@/lib/models/User';
import type { NotificationType } from '@/lib/models/Notification';
import type { JWTPayload } from '@/lib/auth';

interface CreateNotificationParams {
  recipientIds: string[];
  type: NotificationType;
  title: string;
  message: string;
  link: string;
  metadata?: Record<string, unknown>;
}

/** Create notifications for given recipients. Fire-and-forget - does not block API response. */
export async function createNotifications(params: CreateNotificationParams): Promise<void> {
  const { recipientIds, type, title, message, link, metadata = {} } = params;
  if (recipientIds.length === 0) return;

  try {
    await connectDB();
    const docs = recipientIds.map((recipientId) => ({
      recipientId: new mongoose.Types.ObjectId(recipientId),
      type,
      title,
      message,
      link,
      metadata,
    }));
    await Notification.insertMany(docs);
  } catch (e) {
    console.error('[notifications] createNotifications error:', e);
  }
}

/** Get all admin user IDs (for admin notifications when other roles take action) */
export async function getAdminUserIds(): Promise<string[]> {
  try {
    await connectDB();
    const admins = await User.find({ role: 'admin', isActive: true }).select('_id').lean();
    return admins.map((a) => String(a._id));
  } catch (e) {
    console.error('[notifications] getAdminUserIds error:', e);
    return [];
  }
}

/** Get user ID for an employee (employee receives notification when work record or payment is for them) */
export async function getUserIdByEmployeeId(employeeId: string): Promise<string | null> {
  try {
    await connectDB();
    const user = await User.findOne({ employeeId }).select('_id').lean();
    return user ? String(user._id) : null;
  } catch (e) {
    console.error('[notifications] getUserIdByEmployeeId error:', e);
    return null;
  }
}

/** Notify admins when a non-admin user performs an action. Skip if actor is admin. */
export async function notifyAdminsIfNeeded(
  actor: JWTPayload,
  params: Omit<CreateNotificationParams, 'recipientIds'>
): Promise<void> {
  if (actor.role === 'admin') return;
  const adminIds = await getAdminUserIds();
  if (adminIds.length === 0) return;
  await createNotifications({ ...params, recipientIds: adminIds });
}

/** Notify employee when work record or payment is created for them */
export async function notifyEmployee(
  employeeId: string,
  params: Omit<CreateNotificationParams, 'recipientIds'>
): Promise<void> {
  const userId = await getUserIdByEmployeeId(employeeId);
  if (!userId) return;
  await createNotifications({ ...params, recipientIds: [userId] });
}
