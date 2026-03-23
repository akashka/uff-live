/**
 * Removes all Rate Master entries and dependent data that references rates:
 * WorkRecord, FullTimeWorkRecord, VendorWorkOrder, StyleOrder, then RateMaster.
 * Does NOT remove branches, employees, vendors, users, or payments (orphan refs may exist — run clean-slate for full wipe).
 *
 * Run: npm run clean-rates
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

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  const WorkRecord = (await import('../src/lib/models/WorkRecord')).default;
  const FullTimeWorkRecord = (await import('../src/lib/models/FullTimeWorkRecord')).default;
  const VendorWorkOrder = (await import('../src/lib/models/VendorWorkOrder')).default;
  const StyleOrder = (await import('../src/lib/models/StyleOrder')).default;
  const RateMaster = (await import('../src/lib/models/RateMaster')).default;

  const del = async (name: string, fn: () => Promise<unknown>) => {
    const r = await fn();
    const n = (r as { deletedCount?: number })?.deletedCount ?? 0;
    console.log(`  ${name}: ${n} removed`);
  };

  console.log('\nClearing data that depends on rates, then Rate Master...\n');
  await del('WorkRecord', () => WorkRecord.deleteMany({}));
  await del('FullTimeWorkRecord', () => FullTimeWorkRecord.deleteMany({}));
  await del('VendorWorkOrder', () => VendorWorkOrder.deleteMany({}));
  await del('StyleOrder', () => StyleOrder.deleteMany({}));
  await del('RateMaster', () => RateMaster.deleteMany({}));

  const raw = mongoose.connection.db?.collection('ratemasters');
  if (raw) {
    const extra = await raw.deleteMany({});
    if (extra.deletedCount > 0) console.log(`  ratemasters (raw): ${extra.deletedCount} extra removed`);
  }

  console.log('\n✓ Rate Master and dependent records cleared.\n');
  await mongoose.disconnect();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
