/**
 * Migration: Add employeeId (REC001, REC002, ...) to existing employees that don't have it.
 * Run: npx tsx scripts/migrate-employee-ids.ts
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

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/factory-management';

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  const Employee = (await import('../src/lib/models/Employee')).default;

  const all = await Employee.find({}).sort({ createdAt: 1 }).lean();
  const withId = all.filter((e) => e.employeeId && /^REC\d+$/i.test(String(e.employeeId)));
  const withoutId = all.filter((e) => !e.employeeId || !/^REC\d+$/i.test(String(e.employeeId)));

  let maxNum = 0;
  for (const e of withId) {
    const m = String(e.employeeId).match(/^REC(\d+)$/i);
    if (m) maxNum = Math.max(maxNum, parseInt(m[1], 10));
  }

  let updated = 0;
  for (const emp of withoutId) {
    maxNum++;
    const employeeId = `REC${String(maxNum).padStart(3, '0')}`;
    await Employee.updateOne({ _id: emp._id }, { $set: { employeeId } });
    console.log(`  ${(emp as { name?: string }).name} -> ${employeeId}`);
    updated++;
  }

  console.log(`\nDone. Updated ${updated} employee(s).`);
  process.exit(0);
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
