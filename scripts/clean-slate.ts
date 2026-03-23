/**
 * DESTRUCTIVE: Removes all application data and all users except the main admin.
 *
 * Main admin is identified by MAIN_ADMIN_EMAIL (default: admin@uff.com).
 * After wipe, ensures that admin exists with password from ADMIN_PASSWORD (default: Admin@123).
 *
 * Run: npm run clean-slate
 * Or:  MAIN_ADMIN_EMAIL=you@co.com npx tsx scripts/clean-slate.ts
 *
 * Loads MONGODB_URI from .env.local if not set.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import mongoose from 'mongoose';

const envPath = resolve(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  const content = readFileSync(envPath, 'utf8');
  content.split('\n').forEach((line) => {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      const key = match[1]?.trim() ?? '';
      if (key && process.env[key] === undefined) {
        process.env[key] = match[2]?.trim().replace(/^["']|["']$/g, '') ?? '';
      }
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/factory-management';
const MAIN_ADMIN_EMAIL = (process.env.MAIN_ADMIN_EMAIL || 'admin@uff.com').toLowerCase().trim();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

async function cleanSlate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  const AuditLog = (await import('../src/lib/models/AuditLog')).default;
  const Notification = (await import('../src/lib/models/Notification')).default;
  const Payment = (await import('../src/lib/models/Payment')).default;
  const VendorPayment = (await import('../src/lib/models/VendorPayment')).default;
  const WorkRecord = (await import('../src/lib/models/WorkRecord')).default;
  const FullTimeWorkRecord = (await import('../src/lib/models/FullTimeWorkRecord')).default;
  const VendorWorkOrder = (await import('../src/lib/models/VendorWorkOrder')).default;
  const StyleOrder = (await import('../src/lib/models/StyleOrder')).default;
  const RateMaster = (await import('../src/lib/models/RateMaster')).default;
  const Employee = (await import('../src/lib/models/Employee')).default;
  const Vendor = (await import('../src/lib/models/Vendor')).default;
  const Department = (await import('../src/lib/models/Department')).default;
  const Branch = (await import('../src/lib/models/Branch')).default;
  const User = (await import('../src/lib/models/User')).default;
  const SystemConfig = (await import('../src/lib/models/SystemConfig')).default;

  // Optional / legacy collections (ignore if empty)
  let PaymentHistory: typeof mongoose.Model | null = null;
  let SalaryPayment: typeof mongoose.Model | null = null;
  let WorkMaster: typeof mongoose.Model | null = null;
  try {
    PaymentHistory = (await import('../src/lib/models/PaymentHistory')).default;
  } catch {
    /* optional */
  }
  try {
    SalaryPayment = (await import('../src/lib/models/SalaryPayment')).default;
  } catch {
    /* optional */
  }
  try {
    WorkMaster = (await import('../src/lib/models/WorkMaster')).default;
  } catch {
    /* optional */
  }

  console.log('\nDeleting data (order: dependents first)...\n');

  const del = async (name: string, fn: () => Promise<unknown>) => {
    const r = await fn();
    const n = (r as { deletedCount?: number })?.deletedCount ?? 0;
    console.log(`  ${name}: ${n} document(s) removed`);
  };

  await del('AuditLog', () => AuditLog.deleteMany({}));
  await del('Notification', () => Notification.deleteMany({}));
  await del('Payment', () => Payment.deleteMany({}));
  await del('VendorPayment', () => VendorPayment.deleteMany({}));
  await del('WorkRecord', () => WorkRecord.deleteMany({}));
  await del('FullTimeWorkRecord', () => FullTimeWorkRecord.deleteMany({}));
  await del('VendorWorkOrder', () => VendorWorkOrder.deleteMany({}));
  await del('StyleOrder', () => StyleOrder.deleteMany({}));
  await del('RateMaster', () => RateMaster.deleteMany({}));
  await del('Employee', () => Employee.deleteMany({}));
  await del('Vendor', () => Vendor.deleteMany({}));
  await del('Department', () => Department.deleteMany({}));
  await del('Branch', () => Branch.deleteMany({}));

  if (PaymentHistory) await del('PaymentHistory', () => PaymentHistory!.deleteMany({}));
  if (SalaryPayment) await del('SalaryPayment', () => SalaryPayment!.deleteMany({}));
  if (WorkMaster) await del('WorkMaster', () => WorkMaster!.deleteMany({}));

  await del('SystemConfig', () => SystemConfig.deleteMany({}));

  const adminLower = MAIN_ADMIN_EMAIL.toLowerCase();
  const allUsers = await User.find({}).sort({ createdAt: 1 });
  const matching = allUsers.filter((u) => (u.email || '').toLowerCase() === adminLower);
  const keepId = matching[0]?._id;
  const userRes = await User.deleteMany(keepId ? { _id: { $ne: keepId } } : {});
  console.log(`  User (non-admin): ${userRes.deletedCount} document(s) removed`);

  let admin = keepId ? await User.findById(keepId) : null;
  if (!admin) {
    admin = await User.create({
      email: MAIN_ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
      isActive: true,
    });
    console.log(`\n✓ Created main admin: ${MAIN_ADMIN_EMAIL}`);
  } else {
    admin.password = ADMIN_PASSWORD;
    admin.role = 'admin';
    admin.isActive = true;
    await admin.save();
    await User.updateOne({ _id: admin._id }, { $unset: { employeeId: '' } });
    console.log(`\n✓ Main admin kept & password reset: ${MAIN_ADMIN_EMAIL}`);
  }

  console.log('\n' + '='.repeat(50));
  console.log('CLEAN SLATE COMPLETE — only main admin remains.');
  console.log('='.repeat(50));
  console.log(`\nLogin:\n  Email:    ${MAIN_ADMIN_EMAIL}\n  Password: ${ADMIN_PASSWORD}\n`);

  await mongoose.disconnect();
  process.exit(0);
}

cleanSlate().catch((e) => {
  console.error(e);
  process.exit(1);
});
