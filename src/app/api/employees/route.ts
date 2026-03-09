import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache, revalidateTag } from 'next/cache';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import { getAuthUser, hasRole } from '@/lib/auth';
import { generatePassword } from '@/lib/utils';
import bcrypt from 'bcryptjs';
import { notifyAdminsIfNeeded } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 200;

async function fetchEmployees(includeInactive: boolean, page: number, limit: number, search?: string, departmentId?: string, branchId?: string) {
  await connectDB();
  const filter: Record<string, unknown> = includeInactive ? {} : { isActive: true };
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [
      { name: regex },
      { email: regex },
      { contactNumber: { $regex: q } },
      { employeeId: { $regex: q } },
    ];
  }
  if (departmentId) filter.department = departmentId;
  if (branchId) filter.branches = branchId;
  const skip = (page - 1) * limit;
  const [employees, total] = await Promise.all([
    Employee.find(filter).populate('branches', 'name').populate('department', 'name').sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Employee.countDocuments(filter),
  ]);
  return { employees, total, page, limit };
}

function getCachedEmployees(includeInactive: boolean, page: number, limit: number, search?: string, departmentId?: string, branchId?: string) {
  return unstable_cache(
    () => fetchEmployees(includeInactive, page, limit, search, departmentId, branchId),
    ['employees', String(includeInactive), String(page), String(limit), search ?? '', departmentId ?? '', branchId ?? ''],
    { revalidate: 60, tags: ['employees'] }
  )();
}

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limitParam = searchParams.get('limit');
    const limit = limitParam === '0' || limitParam === 'all' ? 10000 : Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(limitParam || String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
    const search = searchParams.get('search') || undefined;
    const departmentId = searchParams.get('departmentId') || undefined;
    const branchId = searchParams.get('branchId') || undefined;

    const result = await getCachedEmployees(includeInactive, page, limit, search, departmentId, branchId);
    const { employees, total, page: p, limit: l } = result;
    const hasMore = limit < 10000 && p * l < total;
    return NextResponse.json({
      data: employees,
      total,
      page: p,
      limit: l,
      hasMore,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); // accountancy is read-only

    const body = await req.json();
    const {
      name,
      contactNumber,
      email,
      emergencyNumber,
      dateOfBirth,
      gender,
      maritalStatus,
      anniversaryDate,
      aadhaarNumber,
      pfNumber,
      esiNumber,
      panNumber,
      bankName,
      bankBranch,
      ifscCode,
      accountNumber,
      upiId,
      employeeType,
      branches,
      department,
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

    const existingByEmail = await Employee.findOne({ email });
    if (existingByEmail) {
      return NextResponse.json({ error: 'An employee with this email already exists' }, { status: 400 });
    }
    const existingByPhone = await Employee.findOne({ contactNumber });
    if (existingByPhone) {
      return NextResponse.json({ error: 'An employee with this phone number already exists' }, { status: 400 });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: 'User with this email already exists' }, { status: 400 });
    }

    // Generate next employeeId (REC001, REC002, ...)
    const allWithId = await Employee.find({ employeeId: /^REC\d+$/i }).select('employeeId').lean();
    let maxNum = 0;
    for (const e of allWithId) {
      const match = String(e.employeeId).match(/^REC(\d+)$/i);
      if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
    }
    const employeeId = `REC${String(maxNum + 1).padStart(3, '0')}`;

    const employee = await Employee.create({
      employeeId,
      name,
      contactNumber,
      email,
      emergencyNumber,
      dateOfBirth,
      gender,
      maritalStatus: maritalStatus || undefined,
      anniversaryDate: anniversaryDate ? new Date(anniversaryDate) : undefined,
      aadhaarNumber: aadhaarNumber || '',
      pfNumber: pfNumber || '',
      esiNumber: esiNumber || '',
      panNumber: panNumber || '',
      bankName: bankName || '',
      bankBranch: bankBranch || '',
      ifscCode: ifscCode || '',
      accountNumber: accountNumber || '',
      upiId: upiId || '',
      employeeType: employeeType || 'full_time',
      branches: branches || [],
      department: department || undefined,
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

    const emp = await Employee.findById(employee._id).populate('branches', 'name').populate('department', 'name').lean();
    revalidateTag('employees', 'default');

    notifyAdminsIfNeeded(user, {
      type: 'employee_created',
      title: 'Employee created',
      message: `${user.role} created employee "${name}".`,
      link: '/employees',
      metadata: { entityId: String(employee._id), entityType: 'employee', actorId: user.userId, actorRole: user.role, employeeName: name },
    }).catch(() => {});

    logAudit({
      user,
      action: 'employee_create',
      entityType: 'employee',
      entityId: String(employee._id),
      summary: `Employee "${name}" created`,
      metadata: { employeeName: name, employeeType: employeeType || 'full_time' },
      req,
    }).catch(() => {});

    return NextResponse.json({
      employee: emp,
      generatedPassword: password,
      email,
      contactNumber,
      employeeId,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
