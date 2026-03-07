import { NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';

export async function GET() {
  const user = await getAuthUser();
  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  let displayName: string | undefined;
  let photo: string | undefined;

  let employeeType: 'contractor' | 'full_time' | undefined;
  if (user.employeeId) {
    try {
      await connectDB();
      const emp = await Employee.findById(user.employeeId).select('name photo employeeType').lean();
      if (emp) {
        displayName = emp.name;
        photo = emp.photo || undefined;
        employeeType = (emp as { employeeType?: string }).employeeType as 'contractor' | 'full_time' | undefined;
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.json({
    user: {
      userId: user.userId,
      email: user.email,
      role: user.role,
      employeeId: user.employeeId,
      employeeType,
      displayName,
      photo,
    },
  });
}
