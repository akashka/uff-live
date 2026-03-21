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
  let branchIds: string[] = [];

  let employeeType: 'contractor' | 'full_time' | undefined;
  if (user.employeeId) {
    try {
      await connectDB();
      const emp = await Employee.findById(user.employeeId).select('name photo employeeType branches').lean();
      if (emp) {
        displayName = emp.name;
        photo = emp.photo || undefined;
        employeeType = (emp as { employeeType?: string }).employeeType as 'contractor' | 'full_time' | undefined;
        branchIds = (((emp as { branches?: unknown[] }).branches || []) as unknown[]).map((b) =>
          b && typeof b === 'object' && '_id' in (b as Record<string, unknown>) ? String((b as { _id: unknown })._id) : String(b)
        );
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
      branchIds,
    },
  });
}
