/**
 * Migration: StyleOrder from monthWiseData[] to single month + brand + 4-digit code
 *
 * Run: MONGODB_URI=... npx tsx scripts/migrate-style-order-schema.ts
 *
 * For each existing style order:
 * - Adds brand: 'Unknown' if missing
 * - Pads styleCode to 4 digits if it's numeric
 * - Takes first month from monthWiseData as month
 * - Flattens totalOrderQuantity, sellingPricePerQuantity -> totalOrderQuantity, clientCostPerPiece
 * - Adds clientCostTotalAmount
 * - Removes monthWiseData
 *
 * NOTE: The compound unique index (brand + styleCode) will be created by the model.
 * If you have duplicate brand+code after migration, the script will skip/fail those.
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

async function migrate() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  const db = mongoose.connection.db;
  if (!db) throw new Error('No connection');

  const coll = db.collection('styleorders');
  const oldSchemaDocs = await coll.find({ monthWiseData: { $exists: true, $ne: [] } }).toArray();

  // Drop old unique index on styleCode (we now use compound brand+styleCode)
  try {
    await coll.dropIndex('styleCode_1');
    console.log('Dropped old styleCode unique index.');
  } catch {
    // Index may not exist
  }

  if (oldSchemaDocs.length === 0) {
    console.log('No documents with monthWiseData found. Migration complete (index dropped if existed).');
    process.exit(0);
    return;
  }

  console.log(`Found ${oldSchemaDocs.length} style orders to migrate.`);

  for (const doc of oldSchemaDocs) {
    const monthWiseData = (doc as { monthWiseData?: { month: string; totalOrderQuantity: number; sellingPricePerQuantity: number }[] }).monthWiseData || [];
    const first = monthWiseData[0];

    let code = String((doc as { styleCode?: string }).styleCode || '0001').trim();
    const digits = code.replace(/\D/g, '');
    if (digits.length <= 4 && digits.length > 0) {
      code = digits.padStart(4, '0');
    }

    const brand = (doc as { brand?: string }).brand || 'Unknown';
    const month = first?.month || `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
    const totalOrderQuantity = first?.totalOrderQuantity ?? 0;
    const clientCostPerPiece = first?.sellingPricePerQuantity ?? 0;
    const clientCostTotalAmount = totalOrderQuantity > 0 && clientCostPerPiece > 0 ? totalOrderQuantity * clientCostPerPiece : 0;

    try {
      await coll.updateOne(
        { _id: doc._id },
        {
          $set: {
            styleCode: code,
            brand,
            month,
            totalOrderQuantity,
            clientCostPerPiece,
            clientCostTotalAmount,
          },
          $unset: { monthWiseData: 1 },
        }
      );
      console.log(`  Migrated: ${(doc as { styleCode?: string }).styleCode} -> ${code} (${brand})`);
    } catch (e) {
      console.error(`  Failed to migrate ${doc._id}:`, (e as Error).message);
    }
  }

  console.log('Migration complete.');
  process.exit(0);
}

migrate().catch((e) => {
  console.error(e);
  process.exit(1);
});
