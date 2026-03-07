import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';
import Notification from '@/lib/models/Notification';
import { getAuthUser, hasRole } from '@/lib/auth';
import { createNotifications } from '@/lib/notifications';

/** GET /api/reminders/birthdays-anniversaries?date=YYYY-MM-DD
 * Returns today's birthdays and anniversaries.
 * Admin/HR/Finance: all employees.
 * Employee: only colleagues at the same branch.
 */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const dateParam = searchParams.get('date');
    const today = dateParam ? new Date(dateParam) : new Date();
    const month = today.getMonth() + 1;
    const day = today.getDate();

    const isUniversal = hasRole(user, ['admin', 'finance', 'hr']);
    let branchFilter: mongoose.Types.ObjectId[] | null = null;

    if (!isUniversal) {
      if (!user.employeeId) {
        return NextResponse.json({ birthdays: [], anniversaries: [] });
      }
      const myEmployee = await Employee.findById(user.employeeId).select('branches').lean();
      if (!myEmployee?.branches?.length) {
        return NextResponse.json({ birthdays: [], anniversaries: [] });
      }
      branchFilter = myEmployee.branches as mongoose.Types.ObjectId[];
    }

    const baseMatch: Record<string, unknown> = { isActive: true };
    if (branchFilter && branchFilter.length > 0) {
      baseMatch.branches = { $in: branchFilter };
    }

    const [birthdays, anniversaries] = await Promise.all([
      Employee.find({
        ...baseMatch,
        $expr: {
          $and: [
            { $eq: [{ $month: '$dateOfBirth' }, month] },
            { $eq: [{ $dayOfMonth: '$dateOfBirth' }, day] },
          ],
        },
      })
        .select('_id name dateOfBirth branches')
        .populate('branches', 'name')
        .lean(),
      Employee.find({
        ...baseMatch,
        anniversaryDate: { $exists: true, $ne: null },
        $expr: {
          $and: [
            { $eq: [{ $month: '$anniversaryDate' }, month] },
            { $eq: [{ $dayOfMonth: '$anniversaryDate' }, day] },
          ],
        },
      })
        .select('_id name anniversaryDate branches')
        .populate('branches', 'name')
        .lean(),
    ]);

    // Create notifications for current user (only once per day per event)
    const todayStart = new Date(today);
    todayStart.setHours(0, 0, 0, 0);
    const recipientId = user.userId;
    for (const b of birthdays) {
      const existing = await Notification.findOne({
        recipientId,
        type: 'birthday_reminder',
        'metadata.employeeId': String(b._id),
        createdAt: { $gte: todayStart },
      });
      if (!existing) {
        await createNotifications({
          recipientIds: [recipientId],
          type: 'birthday_reminder',
          title: "Birthday today",
          message: `Today is ${b.name}'s birthday. Wish them!`,
          link: `/employees/${b._id}`,
          metadata: { employeeId: String(b._id), employeeName: b.name },
        });
      }
    }
    for (const a of anniversaries) {
      const existing = await Notification.findOne({
        recipientId,
        type: 'anniversary_reminder',
        'metadata.employeeId': String(a._id),
        createdAt: { $gte: todayStart },
      });
      if (!existing) {
        await createNotifications({
          recipientIds: [recipientId],
          type: 'anniversary_reminder',
          title: "Anniversary today",
          message: `Today is ${a.name}'s anniversary. Congratulations!`,
          link: `/employees/${a._id}`,
          metadata: { employeeId: String(a._id), employeeName: a.name },
        });
      }
    }

    return NextResponse.json({
      birthdays: birthdays.map((e) => ({
        _id: e._id,
        name: e.name,
        dateOfBirth: e.dateOfBirth,
        branches: e.branches,
      })),
      anniversaries: anniversaries.map((e) => ({
        _id: e._id,
        name: e.name,
        anniversaryDate: e.anniversaryDate,
        branches: e.branches,
      })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
