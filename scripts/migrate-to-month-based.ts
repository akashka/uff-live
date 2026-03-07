/**
 * Migration script: Convert Payment and WorkRecord to month-based design.
 * - Payment: periodStart/periodEnd → month (YYYY-MM)
 * - WorkRecord: migrate any legacy periodStart/periodEnd → month
 *
 * Run: npm run migrate
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
      const [, key, val] = match;
      process.env[key?.trim() ?? ''] = val?.trim().replace(/^["']|["']$/g, '') ?? '';
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/factory-management';

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected.\n');

  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  // 1. Migrate Payments: periodStart/periodEnd → month
  const paymentsCollection = db.collection('payments');
  const paymentsWithPeriod = await paymentsCollection.find({
    $or: [{ periodStart: { $exists: true } }, { periodEnd: { $exists: true } }],
  }).toArray();

  console.log(`Found ${paymentsWithPeriod.length} payments with periodStart/periodEnd to migrate`);

  let paymentUpdated = 0;
  for (const p of paymentsWithPeriod) {
    const periodEnd = p.periodEnd ? new Date(p.periodEnd) : null;
    const periodStart = p.periodStart ? new Date(p.periodStart) : null;
    const d = periodEnd || periodStart || new Date();
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    await paymentsCollection.updateOne(
      { _id: p._id },
      {
        $set: { month },
        $unset: { periodStart: '', periodEnd: '' },
      }
    );
    paymentUpdated++;
  }
  console.log(`✓ Migrated ${paymentUpdated} payments to month-based\n`);

  // 2. Migrate WorkRecords: periodStart/periodEnd → month (if any legacy records exist)
  const workRecordsCollection = db.collection('workrecords');
  const workRecordsWithPeriod = await workRecordsCollection.find({
    $or: [{ periodStart: { $exists: true } }, { periodEnd: { $exists: true } }],
  }).toArray();

  console.log(`Found ${workRecordsWithPeriod.length} work records with periodStart/periodEnd to migrate`);

  let wrUpdated = 0;
  for (const wr of workRecordsWithPeriod) {
    const periodEnd = wr.periodEnd ? new Date(wr.periodEnd) : null;
    const periodStart = wr.periodStart ? new Date(wr.periodStart) : null;
    const d = periodEnd || periodStart || new Date();
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    await workRecordsCollection.updateOne(
      { _id: wr._id },
      {
        $set: { month },
        $unset: { periodStart: '', periodEnd: '' },
      }
    );
    wrUpdated++;
  }
  console.log(`✓ Migrated ${wrUpdated} work records to month-based\n`);

  console.log('Migration complete.');
  await mongoose.disconnect();
  process.exit(0);
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
