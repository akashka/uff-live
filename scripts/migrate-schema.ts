/**
 * Migration script: Updates existing DB documents to match current schema.
 *
 * - Employee: migrate salaryBreakup.other → otherDeductions, add overtimeCostPerHour,
 *   add pfNumber/esiNumber placeholders, ensure otherDeductions exists
 * - Payment: add otherDeducted, otHours, otAmount where missing
 * - StyleOrder: add colour where missing
 * - Remove deprecated fields (salaryBreakup.other)
 *
 * Run: npm run migrate
 * Or: MONGODB_URI=... npx tsx scripts/migrate-schema.ts
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

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  const Employee = (await import('../src/lib/models/Employee')).default;
  const Payment = (await import('../src/lib/models/Payment')).default;
  const StyleOrder = (await import('../src/lib/models/StyleOrder')).default;

  let employeeUpdates = 0;
  let paymentUpdates = 0;
  let styleOrderUpdates = 0;

  // 1. Migrate Employees
  const employees = await Employee.find().lean();
  for (const emp of employees) {
    const updates: Record<string, unknown> = {};
    const empObj = emp as unknown as Record<string, unknown> & { _id: mongoose.Types.ObjectId };

    // Migrate salaryBreakup.other → otherDeductions
    const breakup = empObj.salaryBreakup as { pf?: number; esi?: number; other?: number } | undefined;
    if (breakup?.other !== undefined && breakup.other !== 0) {
      const existingOther = Array.isArray(empObj.otherDeductions)
        ? (empObj.otherDeductions as { reason: string; amount: number }[]).reduce((s, d) => s + (d.amount || 0), 0)
        : 0;
      const newOther = (breakup.other ?? 0) - existingOther;
      if (newOther > 0) {
        const current = (empObj.otherDeductions as { reason: string; amount: number }[]) || [];
        updates.otherDeductions = [...current, { reason: 'Migrated from salaryBreakup', amount: newOther }];
      }
    }

    // Remove salaryBreakup.other (keep pf, esi only)
    if (breakup && 'other' in breakup) {
      updates.salaryBreakup = { pf: breakup.pf ?? 0, esi: breakup.esi ?? 0 };
    }

    // Add overtimeCostPerHour for full-time if missing
    if (empObj.employeeType === 'full_time' && (empObj.overtimeCostPerHour == null || empObj.overtimeCostPerHour === 0)) {
      updates.overtimeCostPerHour = 80; // default
    }

    // Ensure otherDeductions exists (empty array if missing)
    if (!Array.isArray(empObj.otherDeductions)) {
      updates.otherDeductions = updates.otherDeductions ?? [];
    }

    // Add pfNumber/esiNumber if opted but missing
    if (empObj.pfOpted && !empObj.pfNumber) {
      updates.pfNumber = 'KA/BLR/MIGRATED';
    }
    if (empObj.esiOpted && !empObj.esiNumber) {
      updates.esiNumber = '52-MIGRATED-00';
    }

    if (Object.keys(updates).length > 0) {
      await Employee.updateOne({ _id: empObj._id }, { $set: updates });
      employeeUpdates++;
    }
  }
  console.log(`✓ Employees: ${employeeUpdates} updated`);

  // 2. Migrate Payments
  const payments = await Payment.find().lean();
  for (const p of payments) {
    const updates: Record<string, unknown> = {};
    const pObj = p as unknown as Record<string, unknown> & { _id: mongoose.Types.ObjectId };

    if (pObj.otherDeducted == null) {
      updates.otherDeducted = 0;
    }
    if (pObj.paymentType === 'full_time') {
      if (pObj.otHours == null) updates.otHours = 0;
      if (pObj.otAmount == null) updates.otAmount = 0;
    }

    if (Object.keys(updates).length > 0) {
      await Payment.updateOne({ _id: pObj._id }, { $set: updates });
      paymentUpdates++;
    }
  }
  console.log(`✓ Payments: ${paymentUpdates} updated`);

  // 3. Migrate StyleOrders - add colour if missing
  const styleOrders = await StyleOrder.find({ $or: [{ colour: { $exists: false } }, { colour: null }] }).lean();
  for (const so of styleOrders) {
    await StyleOrder.updateOne({ _id: so._id }, { $set: { colour: '' } });
    styleOrderUpdates++;
  }
  console.log(`✓ Style Orders: ${styleOrderUpdates} updated (added colour)`);

  console.log('\n✓ Migration complete.');
  process.exit(0);
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
