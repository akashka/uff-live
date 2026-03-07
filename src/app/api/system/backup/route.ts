import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';
import { getAuthUser, hasRole } from '@/lib/auth';
import Branch from '@/lib/models/Branch';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import Payment from '@/lib/models/Payment';
import WorkRecord from '@/lib/models/WorkRecord';
import StyleOrder from '@/lib/models/StyleOrder';
import RateMaster from '@/lib/models/RateMaster';
import Notification from '@/lib/models/Notification';
import AuditLog from '@/lib/models/AuditLog';
import SystemConfig from '@/lib/models/SystemConfig';

const COLLECTIONS: { name: string; model: mongoose.Model<mongoose.Document> }[] = [
  { name: 'branches', model: Branch },
  { name: 'employees', model: Employee },
  { name: 'users', model: User },
  { name: 'payments', model: Payment },
  { name: 'workrecords', model: WorkRecord },
  { name: 'styleorders', model: StyleOrder },
  { name: 'ratemasters', model: RateMaster },
  { name: 'notifications', model: Notification },
  { name: 'auditlogs', model: AuditLog },
  { name: 'systemconfigs', model: SystemConfig },
];

/** POST - Create a full backup. Admin only. */
export async function POST() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();

    const backup: Record<string, unknown[]> = {
      _meta: [
        {
          version: 1,
          createdAt: new Date().toISOString(),
          createdBy: user.userId,
        },
      ],
    };

    for (const { name, model } of COLLECTIONS) {
      const docs = await (model as mongoose.Model<unknown>).find({}).lean();
      backup[name] = docs.map((d) => ({
        ...d,
        _id: String((d as { _id?: unknown })._id),
      }));
    }

    const json = JSON.stringify(backup, null, 0);
    const buf = Buffer.from(json, 'utf-8');

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Backup failed' }, { status: 500 });
  }
}
