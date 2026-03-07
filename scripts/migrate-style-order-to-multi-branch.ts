/**
 * Migration: StyleOrder from single branch + per-rate month entries
 * to multiple branches + overall month data.
 *
 * Run: npx tsx scripts/migrate-style-order-to-multi-branch.ts
 * Or: MONGODB_URI=... npx tsx scripts/migrate-style-order-to-multi-branch.ts
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

  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');
  const collection = db.collection('styleorders');

  // Drop old unique index if exists (styleCode + branch)
  try {
    await collection.dropIndex('styleCode_1_branch_1');
    console.log('Dropped old index styleCode_1_branch_1');
  } catch {
    // Index may not exist
  }

  const docs = await collection.find({}).toArray();
  console.log(`Found ${docs.length} style order(s) to migrate`);

  let migrated = 0;
  for (const doc of docs) {
    const hasOldBranch = 'branch' in doc && doc.branch != null;
    const hasBranches = 'branches' in doc && Array.isArray(doc.branches);
    if (hasBranches && !hasOldBranch) {
      console.log(`  Skip ${doc.styleCode}: already migrated`);
      continue;
    }

    const updates: Record<string, unknown> = {};

    // branch -> branches
    if (hasOldBranch && !hasBranches) {
      updates.branches = [doc.branch];
      updates.$unset = { branch: '' };
    }

    // monthWiseData: entries[] -> totalOrderQuantity, sellingPricePerQuantity
    const monthWiseData = doc.monthWiseData;
    if (Array.isArray(monthWiseData) && monthWiseData.length > 0) {
      const firstHasEntries = monthWiseData[0] && 'entries' in monthWiseData[0];
      if (firstHasEntries) {
        const newMonthWiseData = monthWiseData.map((m: { month: string; entries?: { totalOrderQuantity: number; sellingPricePerQuantity: number }[] }) => {
          const entries = m.entries || [];
          const firstEntry = entries[0];
          const totalOrderQuantity = firstEntry?.totalOrderQuantity ?? 0;
          const sellingPricePerQuantity = firstEntry?.sellingPricePerQuantity ?? 0;
          return {
            month: m.month,
            totalOrderQuantity,
            sellingPricePerQuantity,
          };
        });
        updates.monthWiseData = newMonthWiseData;
      }
    }

    if (Object.keys(updates).length > 0) {
      const unset = updates.$unset as Record<string, string> | undefined;
      delete updates.$unset;
      const updateOp: Record<string, unknown> = { $set: updates };
      if (unset) updateOp.$unset = unset;
      await collection.updateOne({ _id: doc._id }, updateOp);
      migrated++;
      console.log(`  Migrated ${doc.styleCode}`);
    }
  }

  console.log(`\nDone. Migrated ${migrated} style order(s)`);
  await mongoose.disconnect();
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
