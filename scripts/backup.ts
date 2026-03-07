#!/usr/bin/env tsx
/**
 * Scheduled backup script. Run via cron:
 * 0 2 * * * cd /path/to/factory-management && npx tsx scripts/backup.ts
 * (Runs daily at 2 AM)
 */
import mongoose from 'mongoose';
import * as fs from 'fs';
import * as path from 'path';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/factory-management';
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(process.cwd(), 'backups');

async function backup() {
  await mongoose.connect(MONGODB_URI);
  const db = mongoose.connection.db;
  if (!db) throw new Error('No database connection');

  const collections = await db.listCollections().toArray();
  const backup: Record<string, unknown[]> = {
    _meta: [{ createdAt: new Date().toISOString(), version: 1 }],
  };

  for (const { name } of collections) {
    const coll = db.collection(name);
    const docs = await coll.find({}).toArray();
    backup[name] = docs.map((d) => ({
      ...d,
      _id: String(d._id),
    }));
  }

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const filename = `backup_${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}.json`;
  const filepath = path.join(BACKUP_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(backup), 'utf-8');
  console.log(`Backup saved: ${filepath}`);
  await mongoose.disconnect();
}

backup().catch((e) => {
  console.error(e);
  process.exit(1);
});
