/**
 * Seed fresh dummy data: Clears ALL existing data, then seeds branches, employees,
 * rates, style orders (with month-wise data), work records (linked to style orders), payments.
 *
 * Run: npm run seed:fresh
 * Or: MONGODB_URI=... npx tsx scripts/seed-fresh.ts
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

async function seedFresh() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  const Branch = (await import('../src/lib/models/Branch')).default;
  const Employee = (await import('../src/lib/models/Employee')).default;
  const RateMaster = (await import('../src/lib/models/RateMaster')).default;
  const StyleOrder = (await import('../src/lib/models/StyleOrder')).default;
  const WorkRecord = (await import('../src/lib/models/WorkRecord')).default;
  const Payment = (await import('../src/lib/models/Payment')).default;
  const User = (await import('../src/lib/models/User')).default;

  // 1. Clear all existing data (order matters)
  console.log('\nClearing existing data...');
  await Payment.deleteMany({});
  await WorkRecord.deleteMany({});
  await StyleOrder.deleteMany({});
  await RateMaster.deleteMany({});
  await Employee.deleteMany({});
  await User.deleteMany({});
  await Branch.deleteMany({});
  console.log('✓ All data cleared\n');

  // 2. Create branches
  const branches = await Branch.insertMany([
    { name: 'UFF Main Factory', address: '123 Industrial Area, Bangalore', phoneNumber: '+91 9876543210', email: 'main@uff.com' },
    { name: 'UFF North Unit', address: '456 Sector B, Bangalore', phoneNumber: '+91 9876543211', email: 'north@uff.com' },
    { name: 'UFF South Unit', address: '789 Export Zone, Chennai', phoneNumber: '+91 9876543212', email: 'south@uff.com' },
  ]);
  console.log('✓ Branches created (3)');
  const branchIds = branches.map((b) => b._id);

  // 3. Create employees
  const employees = await Employee.insertMany([
    {
      employeeId: 'REC001',
      name: 'Ramesh Kumar',
      contactNumber: '+91 9000111111',
      email: 'ramesh@uff.com',
      emergencyNumber: '+91 9000111112',
      dateOfBirth: new Date('1990-05-15'),
      gender: 'male',
      employeeType: 'contractor',
      branches: [branchIds[0], branchIds[1]],
      pfOpted: true,
      pfNumber: 'KA/BLR/12345',
      monthlyPfAmount: 500,
      esiOpted: true,
      esiNumber: '52-12345-67',
      monthlyEsiAmount: 200,
      otherDeductions: [{ reason: 'Loan recovery', amount: 500 }],
    },
    {
      employeeId: 'REC002',
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
      employeeId: 'REC003',
      name: 'Suresh Reddy',
      contactNumber: '+91 9000333333',
      email: 'suresh@uff.com',
      emergencyNumber: '+91 9000333334',
      dateOfBirth: new Date('1988-01-10'),
      gender: 'male',
      employeeType: 'full_time',
      branches: [branchIds[0]],
      monthlySalary: 35000,
      overtimeCostPerHour: 80,
      salaryBreakup: { pf: 2100, esi: 525 },
      otherDeductions: [],
    },
    {
      employeeId: 'REC004',
      name: 'Lakshmi Nair',
      contactNumber: '+91 9000444444',
      email: 'lakshmi@uff.com',
      emergencyNumber: '+91 9000444445',
      dateOfBirth: new Date('1995-11-25'),
      gender: 'female',
      employeeType: 'full_time',
      branches: [branchIds[1]],
      monthlySalary: 28000,
      overtimeCostPerHour: 75,
      salaryBreakup: { pf: 1680, esi: 420 },
      otherDeductions: [],
    },
  ]);
  console.log('✓ Employees created (4)');
  const contractors = employees.filter((e) => e.employeeType === 'contractor');

  // 4. Create admin user
  const bcrypt = (await import('bcryptjs')).default;
  const adminUser = await User.create({
    email: 'admin@uff.com',
    password: 'Admin@123',
    role: 'admin',
    isActive: true,
  });
  console.log('✓ Admin user created (admin@uff.com / Admin@123)');

  // 5. Create rate masters
  const rates = await RateMaster.insertMany([
    { name: 'Stitching', description: 'Garment stitching work', unit: 'per piece', branchRates: branchIds.map((b) => ({ branch: b, amount: 18 })), isActive: true },
    { name: 'Cutting', description: 'Fabric cutting', unit: 'per piece', branchRates: branchIds.map((b) => ({ branch: b, amount: 12 })), isActive: true },
    { name: 'Finishing', description: 'Final finishing work', unit: 'per piece', branchRates: branchIds.map((b) => ({ branch: b, amount: 8 })), isActive: true },
    { name: 'Quality Check', description: 'QC inspection', unit: 'per piece', branchRates: branchIds.map((b) => ({ branch: b, amount: 15 })), isActive: true },
    { name: 'Packaging', description: 'Packing and packaging', unit: 'per piece', branchRates: branchIds.map((b) => ({ branch: b, amount: 5 })), isActive: true },
  ]);
  console.log(`✓ Rate Master created (${rates.length} rates)`);

  // 6. Create style orders (4-digit code + brand, single month each)
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const styleOrders = await StyleOrder.insertMany([
    {
      styleCode: '0001',
      brand: 'Montecarlo',
      colour: 'Red',
      details: 'Summer T-Shirt Order - stitching at Main, cutting at North',
      branches: [branchIds[0], branchIds[1]],
      rateMasterItems: [rates[0]._id, rates[1]._id, rates[2]._id],
      month: currentMonth,
      totalOrderQuantity: 500,
      clientCostPerPiece: 120,
      clientCostTotalAmount: 60000,
      isActive: true,
    },
    {
      styleCode: '0002',
      brand: 'Globus',
      colour: 'Blue',
      details: 'Formal Shirt Batch',
      branches: [branchIds[0]],
      rateMasterItems: [rates[0]._id, rates[2]._id, rates[3]._id],
      month: currentMonth,
      totalOrderQuantity: 800,
      clientCostPerPiece: 180,
      clientCostTotalAmount: 144000,
      isActive: true,
    },
    {
      styleCode: '0001',
      brand: 'Puma',
      colour: 'Black',
      details: 'Kurti Export Order - cutting at North, finishing at South',
      branches: [branchIds[1], branchIds[2]],
      rateMasterItems: [rates[0]._id, rates[1]._id, rates[4]._id],
      month: currentMonth,
      totalOrderQuantity: 1200,
      clientCostPerPiece: 95,
      clientCostTotalAmount: 114000,
      isActive: true,
    },
  ]);
  console.log(`✓ Style Orders created (${styleOrders.length}) for ${currentMonth}`);

  // 7. Create work records linked to style orders (current month)
  const workRecords: {
    employee: mongoose.Types.ObjectId;
    branch: mongoose.Types.ObjectId;
    month: string;
    styleOrder: mongoose.Types.ObjectId;
    workItems: { rateMaster: mongoose.Types.ObjectId; rateName: string; unit: string; quantity: number; ratePerUnit: number; amount: number }[];
    totalAmount: number;
  }[] = [];

  for (let i = 0; i < 12; i++) {
    const emp = contractors[i % contractors.length];
    const styleOrder = styleOrders[i % styleOrders.length];
    const branches = (styleOrder as { branches?: mongoose.Types.ObjectId[] }).branches || [];
    const branchId = branches[0] || branchIds[0];
    const rateEntry = rates[i % 3];
    const rateName = (rateEntry as { name?: string }).name || 'Stitching';
    const amountPerUnit = ((rateEntry as { branchRates?: { amount: number }[] }).branchRates?.[0]?.amount) ?? 18;
    const qty = 30 + (i % 60);
    const amount = qty * amountPerUnit;

    workRecords.push({
      employee: emp._id,
      branch: branchId,
      month: currentMonth,
      styleOrder: styleOrder._id,
      workItems: [{ rateMaster: rateEntry._id, rateName, unit: 'per piece', quantity: qty, ratePerUnit: amountPerUnit, amount }],
      totalAmount: amount,
    });
  }
  await WorkRecord.insertMany(workRecords);
  console.log(`✓ Work Records created (${workRecords.length}) linked to style orders`);

  // 8. Create payments
  const workRecs = await WorkRecord.find().limit(8).lean();
  let paidCount = 0;
  for (const wr of workRecs) {
    const totalAmount = wr.totalAmount ?? 0;
    const emp = employees.find((e) => String(e._id) === String(wr.employee));
    const pfDeduct = emp && (emp as { pfOpted?: boolean; monthlyPfAmount?: number }).pfOpted ? (emp as { monthlyPfAmount?: number }).monthlyPfAmount ?? 0 : 0;
    const esiDeduct = emp && (emp as { esiOpted?: boolean; monthlyEsiAmount?: number }).esiOpted ? (emp as { monthlyEsiAmount?: number }).monthlyEsiAmount ?? 0 : 0;
    const otherDeduct = emp && Array.isArray((emp as { otherDeductions?: { amount: number }[] }).otherDeductions)
      ? (emp as { otherDeductions: { amount: number }[] }).otherDeductions.reduce((s, d) => s + (d.amount || 0), 0)
      : 0;
    const netTotal = Math.max(0, totalAmount - pfDeduct - esiDeduct - otherDeduct);
    const paidAmount = Math.floor(netTotal * (0.9 + Math.random() * 0.1));
    await Payment.create({
      employee: wr.employee,
      paymentType: 'contractor',
      month: (wr as { month?: string }).month ?? currentMonth,
      baseAmount: totalAmount,
      addDeductAmount: 0,
      addDeductRemarks: '',
      pfDeducted: pfDeduct,
      esiDeducted: esiDeduct,
      otherDeducted: otherDeduct,
      advanceDeducted: 0,
      totalPayable: netTotal,
      paymentAmount: paidAmount,
      paymentMode: ['upi', 'bank_transfer', 'cash'][Math.floor(Math.random() * 3)] as 'upi' | 'bank_transfer' | 'cash',
      transactionRef: `TXN${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
      remainingAmount: netTotal - paidAmount,
      carriedForward: 0,
      carriedForwardRemarks: '',
      isAdvance: false,
      workRecordRefs: [{ workRecord: wr._id, totalAmount }],
      paidAt: new Date(),
      createdBy: adminUser._id,
    });
    paidCount++;
  }
  console.log(`✓ Payments created (${paidCount})`);

  // 8b. Full-time salary payments
  const fullTimers = employees.filter((e) => e.employeeType === 'full_time');
  for (const emp of fullTimers) {
    const salary = (emp as { monthlySalary?: number }).monthlySalary ?? 30000;
    const pf = (emp as { salaryBreakup?: { pf?: number } }).salaryBreakup?.pf ?? 0;
    const esi = (emp as { salaryBreakup?: { esi?: number } }).salaryBreakup?.esi ?? 0;
    const otCost = (emp as { overtimeCostPerHour?: number }).overtimeCostPerHour ?? 0;
    const otHours = 6;
    const otAmount = otCost * otHours;
    const netPay = salary - pf - esi + otAmount;
    await Payment.create({
      employee: emp._id,
      paymentType: 'full_time',
      month: currentMonth,
      baseAmount: salary,
      addDeductAmount: 0,
      addDeductRemarks: '',
      pfDeducted: pf,
      esiDeducted: esi,
      otherDeducted: 0,
      advanceDeducted: 0,
      otHours,
      otAmount,
      daysWorked: 26,
      totalWorkingDays: 26,
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
  }
  if (fullTimers.length > 0) console.log(`✓ Full-time salary payments created (${fullTimers.length})`);

  // 9. Create employee users
  const { generatePassword } = await import('../src/lib/utils');
  for (const emp of employees) {
    const empObj = emp as { _id: mongoose.Types.ObjectId; email: string };
    const pwd = generatePassword(12);
    const hashed = await bcrypt.hash(pwd, 12);
    await User.create({
      email: empObj.email,
      password: hashed,
      role: 'employee',
      employeeId: empObj._id,
      isActive: true,
    });
  }
  console.log(`✓ User accounts created for employees`);

  console.log('\n' + '='.repeat(50));
  console.log('FRESH SEED COMPLETE');
  console.log('='.repeat(50));
  console.log('\nAdmin: admin@uff.com / Admin@123');
  console.log(`Style orders: ${styleOrders.length} (with month-wise data for ${currentMonth})`);
  console.log('Dashboard style charts will show data for current month.\n');

  process.exit(0);
}

seedFresh().catch((e) => {
  console.error(e);
  process.exit(1);
});
