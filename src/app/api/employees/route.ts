import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache, revalidateTag } from 'next/cache';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import { getAuthUser, hasRole } from '@/lib/auth';
import { generatePassword } from '@/lib/utils';
import bcrypt from 'bcryptjs';

async function fetchEmployees(includeInactive: boolean) {
  await connectDB();
  const filter = includeInactive ? {} : { isActive: true };
  return Employee.find(filter).populate('branches', 'name').sort({ createdAt: -1 }).lean();
}

const getCachedEmployees = unstable_cache(
  fetchEmployees,
  ['employees'],
  { revalidate: 60, tags: ['employees'] }
);

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const employees = await getCachedEmployees(includeInactive);
    return NextResponse.json(employees);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const {
      name,
      contactNumber,
      email,
      emergencyNumber,
      dateOfBirth,
      gender,
      aadhaarNumber,
      pfNumber,
      panNumber,
      bankName,
      bankBranch,
      ifscCode,
      accountNumber,
      upiId,
      employeeType,
      branches,
      pfOpted,
      monthlyPfAmount,
      esiOpted,
      monthlyEsiAmount,
      monthlySalary,
      salaryBreakup,
      role: empRole,
    } = body;

    if (!name || !contactNumber || !email || !emergencyNumber || !dateOfBirth || !gender) {
      return NextResponse.json({ error: 'Required fields missing' }, { status: 400 });
    }

    // Admin can create any role; Finance/HR can only create employees
    const role = empRole || 'employee';
    if (user.role === 'finance' || user.role === 'hr') {
      if (role !== 'employee') {
        return NextResponse.json({ error: 'Finance and HR can only create employee role' }, { status: 403 });
      }
    }

    await connectDB();

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    const employee = await Employee.create({
      name,
      contactNumber,
      email,
      emergencyNumber,
      dateOfBirth,
      gender,
      aadhaarNumber: aadhaarNumber || '',
      pfNumber: pfNumber || '',
      panNumber: panNumber || '',
      bankName: bankName || '',
      bankBranch: bankBranch || '',
      ifscCode: ifscCode || '',
      accountNumber: accountNumber || '',
      upiId: upiId || '',
      employeeType: employeeType || 'full_time',
      branches: branches || [],
      pfOpted: pfOpted ?? false,
      monthlyPfAmount: monthlyPfAmount || 0,
      esiOpted: esiOpted ?? false,
      monthlyEsiAmount: monthlyEsiAmount || 0,
      monthlySalary: monthlySalary || 0,
      salaryBreakup: salaryBreakup || { pf: 0, esi: 0, other: 0 },
    });

    const password = generatePassword(12);
    const hashedPassword = await bcrypt.hash(password, 12);
    await User.create({
      email,
      password: hashedPassword,
      role,
      employeeId: employee._id,
      isActive: true,
    });

    const emp = await Employee.findById(employee._id).populate('branches', 'name').lean();
    revalidateTag('employees', 'default');
    return NextResponse.json({ employee: emp, generatedPassword: password });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
