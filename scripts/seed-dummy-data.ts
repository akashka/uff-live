/**
 * Seed dummy data: Rate Master, Work Records, Payments
 * Run: npm run seed:dummy
 * Or: MONGODB_URI=... npx tsx scripts/seed-dummy-data.ts
 *
 * Ensures branches & employees exist, then adds dummy rates, work records, payments.
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

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  const Branch = (await import('../src/lib/models/Branch')).default;
  const Employee = (await import('../src/lib/models/Employee')).default;
  const RateMaster = (await import('../src/lib/models/RateMaster')).default;
  const WorkRecord = (await import('../src/lib/models/WorkRecord')).default;
  const Payment = (await import('../src/lib/models/Payment')).default;
  const User = (await import('../src/lib/models/User')).default;

  // 1. Ensure branches exist
  let branches = await Branch.find().lean();
  if (branches.length === 0) {
    branches = await Branch.insertMany([
      { name: 'UFF Main Factory', address: '123 Industrial Area, Bangalore', phoneNumber: '+91 9876543210', email: 'main@uff.com' },
      { name: 'UFF North Unit', address: '456 Sector B, Bangalore', phoneNumber: '+91 9876543211', email: 'north@uff.com' },
      { name: 'UFF South Unit', address: '789 Export Zone, Chennai', phoneNumber: '+91 9876543212', email: 'south@uff.com' },
    ]);
    console.log('✓ Branches created (3)');
  }
  const branchIds = branches.map((b) => b._id);

  // 2. Ensure employees exist (contractors + full-time)
  let employees = await Employee.find({ isActive: true }).lean();
  if (employees.length === 0) {
    employees = await Employee.insertMany([
      {
        name: 'Ramesh Kumar',
        contactNumber: '+91 9000111111',
        email: 'ramesh@uff.com',
        emergencyNumber: '+91 9000111112',
        dateOfBirth: new Date('1990-05-15'),
        gender: 'male',
        employeeType: 'contractor',
        branches: [branchIds[0], branchIds[1]],
        pfOpted: true,
        monthlyPfAmount: 500,
        esiOpted: true,
        monthlyEsiAmount: 200,
      },
      {
        name: 'Priya Sharma',
        contactNumber: '+91 9000222222',
        email: 'priya@uff.com',
        emergencyNumber: '+91 9000222223',
        dateOfBirth: new Date('1992-08-20'),
        gender: 'female',
        employeeType: 'contractor',
        branches: [branchIds[0]],
      },
      {
        name: 'Suresh Reddy',
        contactNumber: '+91 9000333333',
        email: 'suresh@uff.com',
        emergencyNumber: '+91 9000333334',
        dateOfBirth: new Date('1988-01-10'),
        gender: 'male',
        employeeType: 'full_time',
        branches: [branchIds[0]],
        monthlySalary: 35000,
        salaryBreakup: { pf: 2100, esi: 525, other: 0 },
      },
      {
        name: 'Lakshmi Nair',
        contactNumber: '+91 9000444444',
        email: 'lakshmi@uff.com',
        emergencyNumber: '+91 9000444445',
        dateOfBirth: new Date('1995-11-25'),
        gender: 'female',
        employeeType: 'full_time',
        branches: [branchIds[1]],
        monthlySalary: 28000,
        salaryBreakup: { pf: 1680, esi: 420, other: 0 },
      },
    ]);
    console.log('✓ Employees created (4)');
  }

  const contractors = employees.filter((e) => e.employeeType === 'contractor');
  const fullTimers = employees.filter((e) => e.employeeType === 'full_time');
  let adminUser = await User.findOne({ role: 'admin' }).lean();
  if (!adminUser) {
    const created = await User.create({
      email: 'admin@uff.com',
      password: 'Admin@123',
      role: 'admin',
      isActive: true,
    });
    adminUser = created.toObject();
    console.log('✓ Admin user created (admin@uff.com / Admin@123)');
  }

  // 3. Rate Master - add if empty or fewer than 10
  let rates = await RateMaster.find({ isActive: true }).lean();
  if (rates.length < 10) {
    const dummyRates = [
      { name: 'Stitching', description: 'Garment stitching work', rate: 18 },
      { name: 'Cutting', description: 'Fabric cutting', rate: 12 },
      { name: 'Finishing', description: 'Final finishing work', rate: 8 },
      { name: 'Quality Check', description: 'QC inspection', rate: 15 },
      { name: 'Packaging', description: 'Packing and packaging', rate: 5 },
      { name: 'Ironing', description: 'Press and iron', rate: 6 },
      { name: 'Button Attach', description: 'Button attachment', rate: 3 },
      { name: 'Embroidery', description: 'Embroidery work', rate: 25 },
      { name: 'Label Attach', description: 'Label stitching', rate: 2 },
      { name: 'Thread Trimming', description: 'Thread trimming', rate: 4 },
    ];
    const toAdd = dummyRates.filter((r) => !rates.some((x) => (x as { name?: string }).name === r.name));
    if (toAdd.length > 0) {
      await RateMaster.insertMany(
        toAdd.map((r) => ({
          name: r.name,
          description: r.description,
          unit: 'per piece',
          branchRates: branchIds.map((b) => ({ branch: b, amount: r.rate })),
          isActive: true,
        }))
      );
      console.log(`✓ Rate Master: added ${toAdd.length} dummy rates`);
    }
    rates = await RateMaster.find({ isActive: true }).lean();
  }

  if (rates.length === 0) {
    console.error('No rate masters. Cannot create work records.');
    process.exit(1);
  }

  // 4. Work Records - add dummy records for contractors
  const workRecordCount = await WorkRecord.countDocuments();
  const targetWorkRecords = 15;
  if (workRecordCount < targetWorkRecords && contractors.length > 0) {
    const toAdd = targetWorkRecords - workRecordCount;
    const workRecords: {
      employee: mongoose.Types.ObjectId;
      branch: mongoose.Types.ObjectId;
      periodStart: Date;
      periodEnd: Date;
      workItems: { rateMaster: mongoose.Types.ObjectId; rateName: string; unit: string; quantity: number; ratePerUnit: number; amount: number }[];
      totalAmount: number;
    }[] = [];

    const rateEntries = rates.slice(0, 3);
    const now = new Date();
    for (let i = 0; i < toAdd; i++) {
      const emp = contractors[i % contractors.length];
      const branchId = branchIds[i % branchIds.length];
      const rateEntry = rateEntries[i % rateEntries.length];
      const rateId = rateEntry._id;
      const rateName = (rateEntry as { name?: string }).name || 'Stitching';
      const amountPerUnit = ((rateEntry as { branchRates?: { amount: number }[] }).branchRates?.[0]?.amount) ?? 18;

      const periodEnd = new Date(now);
      periodEnd.setDate(periodEnd.getDate() - i * 7);
      const periodStart = new Date(periodEnd);
      periodStart.setDate(periodStart.getDate() - 13);

      const qty = 40 + (i % 50);
      const amount = qty * amountPerUnit;

      workRecords.push({
        employee: emp._id,
        branch: branchId,
        periodStart,
        periodEnd,
        workItems: [{ rateMaster: rateId, rateName, unit: 'per piece', quantity: qty, ratePerUnit: amountPerUnit, amount }],
        totalAmount: amount,
      });
    }
    await WorkRecord.insertMany(workRecords);
    console.log(`✓ Work Records: added ${workRecords.length} dummy records`);
  }

  // 5. Payments - add dummy payments
  const workRecords = await WorkRecord.find().limit(20).lean();
  const paymentCount = await Payment.countDocuments();
  const targetPayments = 10;

  if (paymentCount < targetPayments && workRecords.length > 0 && adminUser) {
    const existingPeriods = new Set<string>();
    const paidWorkRecords = await Payment.find().lean();
    paidWorkRecords.forEach((p) => {
      existingPeriods.add(`${p.employee}-${p.periodStart}-${p.periodEnd}`);
    });

    let added = 0;
    for (const wr of workRecords) {
      if (added >= targetPayments - paymentCount) break;
      const key = `${wr.employee}-${wr.periodStart}-${wr.periodEnd}`;
      if (existingPeriods.has(key)) continue;

      const totalAmount = wr.totalAmount ?? 0;
      const paidAmount = Math.floor(totalAmount * (0.85 + Math.random() * 0.15));
      const remaining = totalAmount - paidAmount;

      await Payment.create({
        employee: wr.employee,
        paymentType: 'contractor',
        periodStart: wr.periodStart,
        periodEnd: wr.periodEnd,
        baseAmount: totalAmount,
        addDeductAmount: 0,
        addDeductRemarks: '',
        pfDeducted: 0,
        esiDeducted: 0,
        advanceDeducted: 0,
        totalPayable: totalAmount,
        paymentAmount: paidAmount,
        paymentMode: ['upi', 'bank_transfer', 'cash'][Math.floor(Math.random() * 3)] as 'upi' | 'bank_transfer' | 'cash',
        transactionRef: `TXN${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
        remainingAmount: remaining,
        carriedForward: 0,
        carriedForwardRemarks: '',
        isAdvance: false,
        workRecordRefs: [{ workRecord: wr._id, totalAmount }],
        paidAt: new Date(),
        createdBy: adminUser._id,
      });
      existingPeriods.add(key);
      added++;
    }
    if (added > 0) console.log(`✓ Payments: added ${added} dummy payments`);
  }

  // Full-time salary payments (if no contractor work records for them)
  if (fullTimers.length > 0 && adminUser && paymentCount < targetPayments) {
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);

    for (const emp of fullTimers.slice(0, 3)) {
      const existing = await Payment.findOne({
        employee: emp._id,
        paymentType: 'full_time',
        periodStart: { $lte: monthStart },
        periodEnd: { $gte: monthEnd },
      });
      if (existing) continue;

      const salary = (emp as { monthlySalary?: number }).monthlySalary ?? 30000;
      const pf = (emp as { salaryBreakup?: { pf?: number } }).salaryBreakup?.pf ?? 0;
      const esi = (emp as { salaryBreakup?: { esi?: number } }).salaryBreakup?.esi ?? 0;
      const netPay = salary - pf - esi;

      await Payment.create({
        employee: emp._id,
        paymentType: 'full_time',
        periodStart: monthStart,
        periodEnd: monthEnd,
        baseAmount: salary,
        addDeductAmount: 0,
        addDeductRemarks: '',
        pfDeducted: pf,
        esiDeducted: esi,
        advanceDeducted: 0,
        totalPayable: netPay,
        paymentAmount: netPay,
        paymentMode: 'bank_transfer',
        transactionRef: `SAL${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
        remainingAmount: 0,
        carriedForward: 0,
        carriedForwardRemarks: '',
        isAdvance: false,
        workRecordRefs: [],
        paidAt: new Date(),
        createdBy: adminUser._id,
      });
      console.log(`✓ Payments: added full-time salary for ${(emp as { name?: string }).name}`);
    }
  }

  console.log('\n✓ Dummy data seed complete.');
  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
