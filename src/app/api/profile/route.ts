import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import User from '@/lib/models/User';
import Employee from '@/lib/models/Employee';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const dbUser = await User.findById(user.userId).lean();
    if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    let employee = null;
    if (dbUser.employeeId) {
      employee = await Employee.findById(dbUser.employeeId).populate('branches', 'name').lean();
    }

    return NextResponse.json({
      user: {
        email: dbUser.email,
        role: dbUser.role,
      },
      employee,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

// Editable: name, contactNumber, emergencyNumber (if employee)
export async function PATCH(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();

    await connectDB();
    if (user.employeeId) {
      const employee = await Employee.findById(user.employeeId);
      if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

      if (body.name !== undefined) employee.name = body.name;
      if (body.contactNumber !== undefined) employee.contactNumber = body.contactNumber;
      if (body.emergencyNumber !== undefined) employee.emergencyNumber = body.emergencyNumber;
      if (body.bankName !== undefined) employee.bankName = body.bankName;
      if (body.bankBranch !== undefined) employee.bankBranch = body.bankBranch;
      if (body.ifscCode !== undefined) employee.ifscCode = body.ifscCode;
      if (body.accountNumber !== undefined) employee.accountNumber = body.accountNumber;
      if (body.upiId !== undefined) employee.upiId = body.upiId;
      if (body.photo !== undefined) employee.photo = body.photo;

      await employee.save();
      const updated = await Employee.findById(user.employeeId).populate('branches', 'name').lean();
      return NextResponse.json({ employee: updated });
    }

    return NextResponse.json({ error: 'No employee profile' }, { status: 400 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
