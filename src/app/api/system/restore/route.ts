import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import mongoose from 'mongoose';
import { getAuthUser, hasRole } from '@/lib/auth';
import Branch from '@/lib/models/Branch';
import Department from '@/lib/models/Department';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import Payment from '@/lib/models/Payment';
import WorkRecord from '@/lib/models/WorkRecord';
import StyleOrder from '@/lib/models/StyleOrder';
import RateMaster from '@/lib/models/RateMaster';
import Vendor from '@/lib/models/Vendor';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import VendorPayment from '@/lib/models/VendorPayment';
import Notification from '@/lib/models/Notification';
import AuditLog from '@/lib/models/AuditLog';
import SystemConfig from '@/lib/models/SystemConfig';
import SalaryPayment from '@/lib/models/SalaryPayment';
import PaymentHistory from '@/lib/models/PaymentHistory';
import WorkMaster from '@/lib/models/WorkMaster';

const COLLECTION_MAP: Record<string, mongoose.Model<mongoose.Document>> = {
  branches: Branch,
  departments: Department,
  employees: Employee,
  users: User,
  payments: Payment,
  workrecords: WorkRecord,
  styleorders: StyleOrder,
  ratemasters: RateMaster,
  vendors: Vendor,
  vendorworkorders: VendorWorkOrder,
  vendorpayments: VendorPayment,
  notifications: Notification,
  auditlogs: AuditLog,
  systemconfigs: SystemConfig,
  salarypayments: SalaryPayment,
  paymenthistories: PaymentHistory,
  workmasters: WorkMaster,
};

/** POST - Restore from backup. Admin only. DESTRUCTIVE - replaces all data. */
export async function POST(req: Request) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file || !file.size) {
      return NextResponse.json({ error: 'No backup file provided' }, { status: 400 });
    }

    const text = await file.text();
    let backup: Record<string, unknown[]>;
    try {
      backup = JSON.parse(text);
    } catch {
      return NextResponse.json({ error: 'Invalid backup file format' }, { status: 400 });
    }

    if (!backup._meta || !Array.isArray(backup._meta)) {
      return NextResponse.json({ error: 'Invalid backup: missing _meta' }, { status: 400 });
    }

    await connectDB();

    const session = await mongoose.startSession();
    session.startTransaction();
    try {
      for (const [collName, model] of Object.entries(COLLECTION_MAP)) {
        if (collName === '_meta') continue;
        const data = backup[collName];
        if (!Array.isArray(data)) continue;

        await model.deleteMany({}).session(session);
        if (data.length > 0) {
          const docs = data.map((d) => {
            const { _id, ...rest } = d as { _id?: string; [k: string]: unknown };
            return { _id: _id ? new mongoose.Types.ObjectId(_id) : undefined, ...rest };
          });
          await model.insertMany(docs, { session });
        }
      }
      await session.commitTransaction();
    } catch (e) {
      await session.abortTransaction();
      throw e;
    } finally {
      session.endSession();
    }

    return NextResponse.json({ success: true, message: 'Restore completed' });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Restore failed' }, { status: 500 });
  }
}
