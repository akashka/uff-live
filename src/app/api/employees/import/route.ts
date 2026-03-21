import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';
import Branch from '@/lib/models/Branch';
import Department from '@/lib/models/Department';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');

function parseDate(val: unknown): Date | null {
  if (val instanceof Date && !isNaN(val.getTime())) return val;
  const s = String(val || '').trim();
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number)[][];

    await connectDB();
    const branches = await Branch.find({ isActive: true }).lean();
    const departments = await Department.find({ isActive: true }).lean();
    const branchByName = new Map(branches.map((b) => [(b as { name: string }).name, b]));
    const deptByName = new Map(departments.map((d) => [(d as { name: string }).name, d]));

    const created: string[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const employeeId = String(row[0] ?? '').trim();
      const name = String(row[1] ?? '').trim();
      const contactNumber = String(row[2] ?? '').trim();
      const email = String(row[3] ?? '').trim();
      const emergencyNumber = String(row[4] ?? '').trim();
      const dobRaw = row[5];
      const gender = String(row[6] ?? '').toLowerCase().trim() as 'male' | 'female' | 'other';
      const maritalStatus = String(row[7] ?? '').toLowerCase().trim() as 'single' | 'married' | 'other' | '';
      const employeeType = String(row[8] ?? '').toLowerCase().trim() as 'full_time' | 'contractor';
      const branchName = String(row[9] ?? '').trim();
      const deptName = String(row[10] ?? '').trim();
      const monthlySalary = Math.max(0, Number(row[11]) || 0);
      const pfOpted = /^y$/i.test(String(row[12] ?? '').trim());
      const esiOpted = /^y$/i.test(String(row[13] ?? '').trim());
      const aadhaar = String(row[14] ?? '').trim();
      const panNumber = String(row[15] ?? '').trim();
      const bankName = String(row[16] ?? '').trim();
      const accountNumber = String(row[17] ?? '').trim();
      const ifscCode = String(row[18] ?? '').trim();

      if (!employeeId || !name || !contactNumber || !email || !emergencyNumber) {
        errors.push(`Row ${i + 1}: Employee ID, Name, Contact, Email, Emergency Number required`);
        continue;
      }

      const dateOfBirth = parseDate(dobRaw);
      if (!dateOfBirth) {
        errors.push(`Row ${i + 1}: Invalid Date of Birth`);
        continue;
      }

      if (!['male', 'female', 'other'].includes(gender)) {
        errors.push(`Row ${i + 1}: Gender must be male/female/other`);
        continue;
      }

      if (!['full_time', 'contractor'].includes(employeeType)) {
        errors.push(`Row ${i + 1}: Employee Type must be full_time/contractor`);
        continue;
      }

      const branch = branchByName.get(branchName);
      if (!branch) {
        errors.push(`Row ${i + 1}: Unknown branch "${branchName}"`);
        continue;
      }

      const department = deptName ? deptByName.get(deptName) : null;

      try {
        const existing = await Employee.findOne({
          $or: [{ employeeId }, { contactNumber }, { email }],
        }).lean();
        if (existing) {
          errors.push(`Row ${i + 1}: Employee ID, Contact or Email already exists`);
          continue;
        }

        await Employee.create({
          employeeId,
          name,
          contactNumber,
          email,
          emergencyNumber,
          dateOfBirth,
          gender,
          maritalStatus: maritalStatus || undefined,
          employeeType,
          branches: [branch._id],
          department: department?._id,
          monthlySalary,
          pfOpted,
          esiOpted,
          aadhaarNumber: aadhaar || '',
          panNumber: panNumber || '',
          bankName: bankName || '',
          accountNumber: accountNumber || '',
          ifscCode: ifscCode || '',
          isActive: true,
        });
        created.push(name);
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Error'}`);
      }
    }

    logAudit({
      user,
      action: 'employee_import',
      entityType: 'employee',
      entityId: null,
      summary: `Employees imported: ${created.length} created`,
      metadata: { createdCount: created.length, errorCount: errors.length },
      req,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      created: created.length,
      createdNames: created,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Import failed' }, { status: 500 });
  }
}
