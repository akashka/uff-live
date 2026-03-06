/**
 * Seed script to create initial admin user (admin@uff.com / Admin@123)
 * Run: npm run seed:admin
 * Or: npx tsx scripts/seed-admin.ts
 *
 * Loads MONGODB_URI from .env.local if not set
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

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

const ADMIN_EMAIL = 'admin@uff.com';
const ADMIN_PASSWORD = 'Admin@123';

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  const User = (await import('../src/lib/models/User')).default;

  let adminUser = await User.findOne({ email: ADMIN_EMAIL });
  if (adminUser) {
    adminUser.password = ADMIN_PASSWORD;
    await adminUser.save();
    console.log('✓ Admin password reset:', ADMIN_EMAIL);
  } else {
    adminUser = await User.create({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
      employeeId: null,
      isActive: true,
    });
    console.log('✓ Admin user created:', ADMIN_EMAIL);
  }

  console.log('\nLogin credentials:');
  console.log('  Email:    ' + ADMIN_EMAIL);
  console.log('  Password: ' + ADMIN_PASSWORD);
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
