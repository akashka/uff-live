import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import Employee from '@/lib/models/Employee';
import Branch from '@/lib/models/Branch';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get('employeeId') || '';
    const branchId = searchParams.get('branchId') || '';
    const monthFrom = searchParams.get('monthFrom') || '';
    const monthTo = searchParams.get('monthTo') || '';

    await connectDB();

    const filter: Record<string, unknown> = {};
    if (employeeId) filter.employee = employeeId;
    if (branchId) filter.branch = branchId;

    if (monthFrom || monthTo) {
      filter.month = {};
      if (monthFrom) (filter.month as Record<string, string>).$gte = monthFrom.slice(0, 7);
      if (monthTo) (filter.month as Record<string, string>).$lte = monthTo.slice(0, 7);
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = now.getMonth() + 1;
      filter.month = { $gte: `${y - 1}-01`, $lte: `${y}-${String(m).padStart(2, '0')}` };
    }

    const byEmployeeMonth = await WorkRecord.aggregate([
      { $match: filter },
      { $group: { _id: { employee: '$employee', month: '$month' }, totalAmount: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
      { $sort: { '_id.month': 1 } },
    ]);

    const empIds = [...new Set((byEmployeeMonth || []).map((x) => String(x._id.employee)))];

    const employees = empIds.length > 0 ? await Employee.find({ _id: { $in: empIds } }).select('name employeeType').lean() : [];

    const empMap = new Map<string, { name: string; employeeType: string }>();
    for (const e of employees || []) {
      empMap.set(String((e as { _id?: unknown })._id), {
        name: (e as { name?: string }).name || '',
        employeeType: (e as { employeeType?: string }).employeeType || 'contractor',
      });
    }

    const byEmployee: Record<
      string,
      { employeeName: string; employeeType: string; months: { month: string; amount: number; count: number }[]; total: number }
    > = {};

    for (const row of byEmployeeMonth || []) {
      const empId = String(row._id.employee);
      const month = row._id.month;
      const amount = row.totalAmount ?? 0;
      const count = row.count ?? 0;

      if (!byEmployee[empId]) {
        const emp = empMap.get(empId);
        byEmployee[empId] = {
          employeeName: emp?.name || empId,
          employeeType: emp?.employeeType || 'contractor',
          months: [],
          total: 0,
        };
      }
      byEmployee[empId].months.push({ month, amount, count });
      byEmployee[empId].total += amount;
    }

    const data = Object.entries(byEmployee)
      .map(([id, v]) => ({ employeeId: id, ...v }))
      .sort((a, b) => b.total - a.total);

    const branches = branchId ? [] : await Branch.find({ isActive: true }).select('name _id').lean();
    return NextResponse.json({
      data,
      employees: Array.from(empMap.entries()).map(([id, v]) => ({ id, ...v })),
      branches: (branches || []).map((b) => ({ id: (b as { _id?: unknown })._id, name: (b as { name?: string }).name })),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to fetch employee productivity' }, { status: 500 });
  }
}
