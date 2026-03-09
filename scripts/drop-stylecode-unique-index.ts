/**
 * Drop old unique index on styleCode alone.
 * The compound (brand + styleCode) unique index allows the same code for different brands.
 * Run: npx tsx scripts/drop-stylecode-unique-index.ts
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
      if (key) process.env[key] = match[2]?.trim().replace(/^["']|["']$/g, '') ?? '';
    }
  });
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/factory-management';

async function main() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;
  if (!db) throw new Error('No connection');

  const coll = db.collection('styleorders');
  const indexes = await coll.indexes();

  console.log('Current indexes:', indexes.map((i) => ({ name: i.name, key: i.key, unique: i.unique })));

  // Drop old unique indexes that don't include brand (block same code for different brands)
  const toDrop = indexes.filter(
    (i) =>
      i.unique &&
      i.key &&
      'styleCode' in i.key &&
      !('brand' in i.key)
  );
  for (const idx of toDrop) {
    const name = idx.name;
    if (name) {
      await coll.dropIndex(name);
      console.log(`Dropped old index: ${name} (did not include brand - was blocking same code for different brands)`);
    }
  }
  if (toDrop.length === 0) {
    try {
      await coll.dropIndex('styleCode_1');
      console.log('Dropped styleCode_1 index.');
    } catch {
      try {
        await coll.dropIndex('styleCode_1_branch_1');
        console.log('Dropped styleCode_1_branch_1 index.');
      } catch {
        console.log('No old styleCode indexes to drop (already correct).');
      }
    }
  }

  // Ensure compound unique index (brand + styleCode) exists - allows same code for different brands
  const indexesAfter = await coll.indexes();
  const compoundExists = indexesAfter.some(
    (idx) => idx.key && 'brand' in idx.key && 'styleCode' in idx.key && idx.unique
  );
  if (!compoundExists) {
    await coll.createIndex({ brand: 1, styleCode: 1 }, { unique: true });
    console.log('Created compound unique index (brand, styleCode).');
  } else {
    console.log('Compound index (brand, styleCode) already exists.');
  }

  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
