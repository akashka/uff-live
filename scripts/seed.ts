/**
 * Seed script: Admin user + dummy data (branches, employees, rates, work records, payments)
 * Run: npm run seed
 * Or: MONGODB_URI=... npx tsx scripts/seed.ts
 *
 * Loads MONGODB_URI from .env.local if not set
 */

import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import mongoose from 'mongoose';

// Load .env.local
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

// Admin credentials (printed at end)
const ADMIN_EMAIL = 'admin@uff.com';
const ADMIN_PASSWORD = 'Admin@123';

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);

  // Import models after connect (they need mongoose)
  const User = (await import('../src/lib/models/User')).default;
  const Branch = (await import('../src/lib/models/Branch')).default;
  const Department = (await import('../src/lib/models/Department')).default;
  const Employee = (await import('../src/lib/models/Employee')).default;
  const RateMaster = (await import('../src/lib/models/RateMaster')).default;
  const WorkRecord = (await import('../src/lib/models/WorkRecord')).default;
  const Payment = (await import('../src/lib/models/Payment')).default;

  // 1. Admin user (User model hashes password in pre-save)
  let adminUser = await User.findOne({ email: ADMIN_EMAIL });
  if (!adminUser) {
    adminUser = await User.create({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      role: 'admin',
      employeeId: undefined,
      isActive: true,
    });
    console.log('✓ Admin user created');
  } else {
    console.log('✓ Admin user already exists');
  }

  // 2. Branches
  let branches = await Branch.find().lean();
  if (branches.length === 0) {
    branches = await Branch.insertMany([
      { name: 'UFF Main Factory', address: '123 Industrial Area, Bangalore', phoneNumber: '+91 9876543210', email: 'main@uff.com' },
      { name: 'UFF North Unit', address: '456 Sector B, Bangalore', phoneNumber: '+91 9876543211', email: 'north@uff.com' },
      { name: 'UFF South Unit', address: '789 Export Zone, Chennai', phoneNumber: '+91 9876543212', email: 'south@uff.com' },
    ]);
    console.log('✓ Branches created (3)');
  } else {
    console.log('✓ Branches already exist');
  }

  const branchIds = branches.map((b) => b._id);

  // 2b. Departments
  let departments = await Department.find().lean();
  if (departments.length === 0) {
    departments = await Department.insertMany([
      { name: 'Production', description: 'Manufacturing and production' },
      { name: 'Quality Control', description: 'QC and inspection' },
      { name: 'Admin', description: 'Administrative and support' },
    ]);
    console.log('✓ Departments created (3)');
  } else {
    console.log('✓ Departments already exist');
  }
  const deptIds = departments.map((d) => d._id);

  // 3. Employees (contractors + full-time)
  let employees = await Employee.find().lean();
  if (employees.length === 0) {
    employees = await Employee.insertMany([
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
        department: deptIds[0],
        pfOpted: true,
        pfNumber: 'KA/BLR/12345',
        monthlyPfAmount: 500,
        esiOpted: true,
        esiNumber: '52-12345-67',
        monthlyEsiAmount: 200,
        otherDeductions: [{ reason: 'Loan recovery', amount: 500 }],
        bankName: 'SBI',
        accountNumber: '123456789012',
        ifscCode: 'SBIN0001234',
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
        department: deptIds[1],
        pfOpted: false,
        esiOpted: false,
        bankName: 'HDFC',
        accountNumber: '987654321098',
        ifscCode: 'HDFC0001234',
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
        department: deptIds[0],
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
        department: deptIds[2],
        monthlySalary: 28000,
        overtimeCostPerHour: 75,
        salaryBreakup: { pf: 1680, esi: 420 },
        otherDeductions: [],
      },
    ]);
    console.log('✓ Employees created (4)');
  } else {
    console.log('✓ Employees already exist');
  }

  const contractorIds = employees.filter((e) => e.employeeType === 'contractor').map((e) => e._id);
  const fullTimeIds = employees.filter((e) => e.employeeType === 'full_time').map((e) => e._id);

  // 4. Rate Master - try RATE LIST.xlsx first, else dummy rates
  let rates = await RateMaster.find().lean();
  if (rates.length === 0) {
    const rateListPath = resolve(process.cwd(), 'public/RATE LIST.xlsx');
    if (existsSync(rateListPath)) {
      try {
        const XLSX = require('xlsx');
        const wb = XLSX.readFile(rateListPath);
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];
        let colDesc = -1;
        let colRate = -1;
        for (let i = 0; i < Math.min(5, rows.length); i++) {
          const row = rows[i] as (string | number)[];
          for (let j = 0; j < row.length; j++) {
            const v = String(row[j] || '').toUpperCase();
            if (v.includes('DESCRIPTION') || v === 'DESC') colDesc = j;
            if (v.includes('RATE')) colRate = j;
          }
          if (colDesc >= 0 && colRate >= 0) break;
        }
        if (colDesc >= 0 && colRate >= 0) {
          const items: { name: string; description: string; rate: number }[] = [];
          for (let i = 1; i < rows.length; i++) {
            const row = rows[i] as (string | number)[];
            const desc = String(row[colDesc] ?? '').trim();
            const r = typeof row[colRate] === 'number' ? row[colRate] : parseFloat(String(row[colRate] || '0'));
            if (!desc || isNaN(r as number) || (r as number) < 0) continue;
            if (desc.toUpperCase() === 'TOTAL') continue;
            items.push({ name: desc.length > 60 ? desc.slice(0, 60) : desc, description: desc, rate: r as number });
          }
          if (items.length > 0) {
            rates = await RateMaster.insertMany(
              items.map((it) => ({
                name: it.name,
                description: it.description,
                unit: 'per piece',
                branchRates: branchIds.map((b) => ({ branch: b, amount: it.rate })),
                isActive: true,
              }))
            );
            console.log(`✓ Rate Master created (${items.length} rates from RATE LIST.xlsx)`);
          }
        }
      } catch (e) {
        console.warn('Could not import RATE LIST.xlsx:', (e as Error).message);
      }
    }
    if (rates.length === 0) {
      rates = await RateMaster.insertMany([
        { name: 'Stitching', description: '', unit: 'per piece', branchRates: branchIds.map((b) => ({ branch: b, amount: 18 })), isActive: true },
        { name: 'Cutting', description: '', unit: 'per piece', branchRates: branchIds.map((b) => ({ branch: b, amount: 12 })), isActive: true },
        { name: 'Finishing', description: '', unit: 'per piece', branchRates: branchIds.map((b) => ({ branch: b, amount: 8 })), isActive: true },
      ]);
      console.log('✓ Rate Master created (3 dummy rates)');
    }
  } else {
    console.log('✓ Rate Master already exists');
  }

  // 5. Work Records (for contractors)
  const workRecordCount = await WorkRecord.countDocuments();
  if (workRecordCount === 0 && contractorIds.length > 0 && rates.length > 0) {
    const rateId = rates[0]._id;
    const rateName = (rates[0] as { name?: string }).name || 'Stitching';
    const workRecords: { employee: unknown; branch: unknown; month: string; workItems: unknown[]; totalAmount: number }[] = [];

    for (let m = 1; m <= 3; m++) {
      const month = `2025-${String(m).padStart(2, '0')}`;
      contractorIds.forEach((empId, i) => {
        const qty = 50 + m * 10 + i * 5;
        const ratePerUnit = 18;
        const amount = qty * ratePerUnit;
        workRecords.push({
          employee: empId,
          branch: branchIds[0],
          month,
          workItems: [{ rateMaster: rateId, rateName, unit: 'per piece', quantity: qty, ratePerUnit, amount }],
          totalAmount: amount,
        });
      });
    }
    await WorkRecord.insertMany(workRecords);
    console.log('✓ Work Records created');
  } else {
    console.log('✓ Work Records already exist or no contractors');
  }

  // 6. Payments
  const paymentCount = await Payment.countDocuments();
  if (paymentCount === 0) {
    const workRecords = await WorkRecord.find().limit(4).lean();
    const adminId = adminUser._id;

    for (const wr of workRecords) {
      const empId = wr.employee as mongoose.Types.ObjectId;
      const totalAmount = wr.totalAmount ?? 0;
      const emp = employees.find((e) => String(e._id) === String(empId));
      const pfDeduct = emp && (emp as { pfOpted?: boolean; monthlyPfAmount?: number }).pfOpted ? (emp as { monthlyPfAmount?: number }).monthlyPfAmount ?? 0 : 0;
      const esiDeduct = emp && (emp as { esiOpted?: boolean; monthlyEsiAmount?: number }).esiOpted ? (emp as { monthlyEsiAmount?: number }).monthlyEsiAmount ?? 0 : 0;
      const otherDeduct = emp && Array.isArray((emp as { otherDeductions?: { amount: number }[] }).otherDeductions)
        ? (emp as { otherDeductions: { amount: number }[] }).otherDeductions.reduce((s, d) => s + (d.amount || 0), 0)
        : 0;
      const netTotal = Math.max(0, totalAmount - pfDeduct - esiDeduct - otherDeduct);
      const paidAmount = Math.floor(netTotal * 0.8);
      const remaining = netTotal - paidAmount;
      const month = (wr as { month?: string }).month || '2025-01';
      await Payment.create({
        employee: empId,
        paymentType: 'contractor',
        month,
        baseAmount: totalAmount,
        addDeductAmount: 0,
        addDeductRemarks: '',
        pfDeducted: pfDeduct,
        esiDeducted: esiDeduct,
        otherDeducted: otherDeduct,
        advanceDeducted: 0,
        totalPayable: netTotal,
        paymentAmount: paidAmount,
        paymentMode: 'upi',
        transactionRef: `TXN${Date.now()}${Math.random().toString(36).slice(2, 8)}`,
        remainingAmount: remaining,
        carriedForward: 0,
        carriedForwardRemarks: '',
        isAdvance: false,
        workRecordRefs: [{ workRecord: wr._id, totalAmount }],
        paidAt: new Date(),
        createdBy: adminId,
      });
    }
    console.log('✓ Payments created');
  } else {
    console.log('✓ Payments already exist');
  }

  console.log('\n' + '='.repeat(50));
  console.log('SEED COMPLETE');
  console.log('='.repeat(50));
  console.log('\nAdmin login credentials:');
  console.log('  Email:    ' + ADMIN_EMAIL);
  console.log('  Password: ' + ADMIN_PASSWORD);
  console.log('\nLogin at: http://localhost:3000/login');
  console.log('Change password after first login.\n');

  process.exit(0);
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
