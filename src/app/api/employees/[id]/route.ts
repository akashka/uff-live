import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';
import User from '@/lib/models/User';
import { getAuthUser, hasRole } from '@/lib/auth';
import { areBranchesAllowed, getUserBranchScope } from '@/lib/branchAccess';
import { notifyAdminsIfNeeded } from '@/lib/notifications';
import { logAudit } from '@/lib/audit';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const { id } = await params;
    const canAccessAny = hasRole(user, ['admin', 'finance', 'accountancy', 'hr']);
    const isOwnProfile = user.employeeId && String(user.employeeId) === String(id);
    if (!canAccessAny && !isOwnProfile) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const employee = await Employee.findById(id).populate('branches', 'name').populate('department', 'name').lean();
    if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const scope = await getUserBranchScope(user);
    if (scope.isRestricted) {
      const employeeBranchIds = ((employee as { branches?: unknown[] }).branches || []).map((b) =>
        b && typeof b === 'object' && '_id' in (b as Record<string, unknown>) ? String((b as { _id: unknown })._id) : String(b)
      );
      const canAccessEmployee = employeeBranchIds.some((bid) => scope.allowedBranchIds.includes(bid));
      if (!canAccessEmployee) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return NextResponse.json(employee);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); // accountancy is read-only

    const { id } = await params;
    const body = await req.json();

    await connectDB();
    const employee = await Employee.findById(id);
    if (!employee) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const scope = await getUserBranchScope(user);
    if (scope.isRestricted) {
      const employeeBranchIds = ((employee.branches || []) as unknown[]).map((b) => String(b));
      const canAccessEmployee = employeeBranchIds.some((bid) => scope.allowedBranchIds.includes(bid));
      if (!canAccessEmployee) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Email, contactNumber, employeeId are immutable - ignore if sent (never update)
    // Only reject when values are actually being changed
    if (body.email !== undefined && String(body.email).trim() !== String(employee.email).trim()) {
      return NextResponse.json({ error: 'Email cannot be changed' }, { status: 400 });
    }
    if (body.contactNumber !== undefined && String(body.contactNumber).trim() !== String(employee.contactNumber).trim()) {
      return NextResponse.json({ error: 'Phone number cannot be changed' }, { status: 400 });
    }
    if (body.employeeId !== undefined && String(body.employeeId).trim() !== String(employee.employeeId).trim()) {
      return NextResponse.json({ error: 'Employee ID cannot be changed' }, { status: 400 });
    }

    if (body.name !== undefined) employee.name = body.name;
    if (body.emergencyNumber !== undefined) employee.emergencyNumber = body.emergencyNumber;
    if (body.dateOfBirth !== undefined) employee.dateOfBirth = body.dateOfBirth;
    if (body.gender !== undefined) employee.gender = body.gender;
    if (body.maritalStatus !== undefined) employee.maritalStatus = body.maritalStatus || undefined;
    if (body.anniversaryDate !== undefined) employee.anniversaryDate = body.anniversaryDate ? new Date(body.anniversaryDate) : undefined;
    if (body.aadhaarNumber !== undefined) employee.aadhaarNumber = body.aadhaarNumber;
    if (body.pfNumber !== undefined) employee.pfNumber = body.pfNumber;
    if (body.esiNumber !== undefined) employee.esiNumber = body.esiNumber;
    if (body.panNumber !== undefined) employee.panNumber = body.panNumber;
    if (body.bankName !== undefined) employee.bankName = body.bankName;
    if (body.bankBranch !== undefined) employee.bankBranch = body.bankBranch;
    if (body.ifscCode !== undefined) employee.ifscCode = body.ifscCode;
    if (body.accountNumber !== undefined) employee.accountNumber = body.accountNumber;
    if (body.upiId !== undefined) employee.upiId = body.upiId;
    if (body.photo !== undefined) employee.photo = body.photo;
    if (body.employeeType !== undefined) employee.employeeType = body.employeeType;
    if (body.branches !== undefined) {
      const updatedBranchIds = Array.isArray(body.branches) ? body.branches.map((id: unknown) => String(id)) : [];
      if (!areBranchesAllowed(scope, updatedBranchIds)) {
        return NextResponse.json({ error: 'Forbidden: branch access denied' }, { status: 403 });
      }
      employee.branches = updatedBranchIds;
    }
    if (body.department !== undefined) employee.department = body.department || undefined;
    if (body.pfOpted !== undefined) employee.pfOpted = body.pfOpted;
    if (body.monthlyPfAmount !== undefined) employee.monthlyPfAmount = body.monthlyPfAmount;
    if (body.esiOpted !== undefined) employee.esiOpted = body.esiOpted;
    if (body.monthlyEsiAmount !== undefined) employee.monthlyEsiAmount = body.monthlyEsiAmount;
    if (body.monthlySalary !== undefined) employee.monthlySalary = body.monthlySalary;
    if (body.dailySalary !== undefined) employee.dailySalary = body.dailySalary;
    if (body.overtimeCostPerHour !== undefined) employee.overtimeCostPerHour = body.overtimeCostPerHour;
    if (body.salaryBreakup !== undefined) employee.salaryBreakup = body.salaryBreakup;
    if (body.otherDeductions !== undefined) employee.otherDeductions = Array.isArray(body.otherDeductions) ? body.otherDeductions.filter((d: { reason?: string; amount?: number }) => d && (d.reason || d.amount)) : [];
    if (body.isActive !== undefined) employee.isActive = body.isActive;

    // Role update - admin only
    if (body.role !== undefined && user.role === 'admin') {
      await User.findOneAndUpdate({ employeeId: id }, { role: body.role });
    }

    // When disabled, deactivate user login
    if (body.isActive === false) {
      await User.findOneAndUpdate({ employeeId: id }, { isActive: false });
    }
    if (body.isActive === true) {
      await User.findOneAndUpdate({ employeeId: id }, { isActive: true });
    }

    await employee.save();
    revalidateTag('employees', 'default');
    const updated = await Employee.findById(id).populate('branches', 'name').populate('department', 'name').lean();

    notifyAdminsIfNeeded(user, {
      type: 'employee_updated',
      title: 'Employee updated',
      message: `${user.role} updated employee "${employee.name}".`,
      link: `/employees/${id}`,
      metadata: { entityId: id, entityType: 'employee', actorId: user.userId, actorRole: user.role, employeeId: id, employeeName: employee.name },
    }).catch(() => {});

    logAudit({
      user,
      action: 'employee_update',
      entityType: 'employee',
      entityId: id,
      summary: `Employee "${employee.name}" updated`,
      metadata: { employeeName: employee.name },
      req,
    }).catch(() => {});

    return NextResponse.json(updated);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
