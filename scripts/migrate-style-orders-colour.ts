/**
 * Migration: StyleOrder colours[] -> colour (single)
 * Uniqueness changes from (brand, styleCode) to (brand, styleCode, month, colour).
 * Same brand+order in a month can exist with different colours.
 *
 * Run: npx tsx scripts/migrate-style-orders-colour.ts
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

  // Drop old unique index (brand + styleCode only)
  const oldIdx = indexes.find((i) => i.key && (i.key as Record<string, number>).brand === 1 && (i.key as Record<string, number>).styleCode === 1 && !('month' in (i.key || {})) && i.unique);
  if (oldIdx?.name) {
    await coll.dropIndex(oldIdx.name);
    console.log(`Dropped old index: ${oldIdx.name}`);
  } else {
    console.log('No old brand+styleCode unique index to drop.');
  }

  // Populate colour from colours for existing docs
  const docs = await coll.find({}).toArray();
  let updated = 0;
  for (const doc of docs) {
    const d = doc as { colours?: string[]; colour?: string };
    const colour = d.colour ?? (Array.isArray(d.colours) && d.colours.length > 0 ? d.colours[0] : '') ?? '';
    const update: { $set: { colour: string }; $unset?: { colours: 1 } } = { $set: { colour } };
    if (Array.isArray(d.colours)) {
      update.$unset = { colours: 1 };
    }
    await coll.updateOne({ _id: doc._id }, update);
    updated++;
  }
  console.log(`Migrated ${updated} documents: colours -> colour`);

  // Create new compound unique index (allows same brand+code in a month with different colours)
  await coll.createIndex({ brand: 1, styleCode: 1, month: 1, colour: 1 }, { unique: true });
  console.log('Created unique index (brand, styleCode, month, colour).');

  console.log('Done.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
