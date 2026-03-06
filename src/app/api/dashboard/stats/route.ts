import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';
import Branch from '@/lib/models/Branch';
import Payment from '@/lib/models/Payment';
import WorkRecord from '@/lib/models/WorkRecord';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || '30'; // days
    const days = parseInt(range, 10) || 30;

    const isAdmin = hasRole(user, ['admin']);
    const isFinance = hasRole(user, ['admin', 'finance']);
    const isHR = hasRole(user, ['admin', 'finance', 'hr']);
    const isEmployee = user.employeeId;

    const stats: Record<string, unknown> = {};

    if (isHR || isAdmin) {
      const [totalEmployees, activeEmployees, contractors, fullTime, branches] = await Promise.all([
        Employee.countDocuments(),
        Employee.countDocuments({ isActive: true }),
        Employee.countDocuments({ employeeType: 'contractor', isActive: true }),
        Employee.countDocuments({ employeeType: 'full_time', isActive: true }),
        Branch.countDocuments({ isActive: true }),
      ]);

      stats.employees = { total: totalEmployees, active: activeEmployees, contractors, fullTime };
      if (isAdmin) stats.branches = branches;
    }

    if (isFinance || isAdmin) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const payments = await Payment.find({ paidAt: { $gte: startDate } }).lean();
      const totalPaid = payments.reduce((s, p) => s + (p.paymentAmount || 0), 0);
      const totalPayable = payments.reduce((s, p) => s + (p.totalPayable || 0), 0);
      const totalRemaining = payments.reduce((s, p) => s + (p.remainingAmount || 0), 0);

      const byMode = payments.reduce((acc, p) => {
        const m = p.paymentMode || 'other';
        acc[m] = (acc[m] || 0) + (p.paymentAmount || 0);
        return acc;
      }, {} as Record<string, number>);

      const monthlyData: { month: string; paid: number; count: number }[] = [];
      for (let i = days - 1; i >= 0; i -= 7) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const weekStart = new Date(d);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekPayments = payments.filter(
          (p) => new Date(p.paidAt) >= weekStart && new Date(p.paidAt) < weekEnd
        );
        const weekPaid = weekPayments.reduce((s, p) => s + (p.paymentAmount || 0), 0);
        monthlyData.push({
          month: weekStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          paid: weekPaid,
          count: weekPayments.length,
        });
      }

      stats.payments = {
        totalPaid,
        totalPayable,
        totalRemaining,
        count: payments.length,
        byMode,
        trend: monthlyData,
      };
    }

    if (isHR || isAdmin) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);
      const workRecords = await WorkRecord.find({ createdAt: { $gte: startDate } }).lean();
      const workTotal = workRecords.reduce((s, r) => s + (r.totalAmount || 0), 0);
      const workByType = workRecords.reduce((acc, r) => {
        const empId = String(r.employee);
        acc[empId] = (acc[empId] || 0) + (r.totalAmount || 0);
        return acc;
      }, {} as Record<string, number>);

      const workTrend: { month: string; amount: number; count: number }[] = [];
      for (let i = days - 1; i >= 0; i -= 7) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const weekStart = new Date(d);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        const weekRecords = workRecords.filter(
          (r) => new Date(r.createdAt) >= weekStart && new Date(r.createdAt) < weekEnd
        );
        const weekAmount = weekRecords.reduce((s, r) => s + (r.totalAmount || 0), 0);
        workTrend.push({
          month: weekStart.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
          amount: weekAmount,
          count: weekRecords.length,
        });
      }

      stats.workRecords = { total: workTotal, count: workRecords.length, trend: workTrend };
    }

    if (isEmployee && user.employeeId) {
      const employee = await Employee.findById(user.employeeId).lean();
      if (employee) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        const [myWorkRecords, myPayments] = await Promise.all([
          WorkRecord.find({ employee: user.employeeId, createdAt: { $gte: startDate } }).lean(),
          Payment.find({ employee: user.employeeId, paidAt: { $gte: startDate } }).lean(),
        ]);
        const workTotal = myWorkRecords.reduce((s, r) => s + (r.totalAmount || 0), 0);
        const paidTotal = myPayments.reduce((s, p) => s + (p.paymentAmount || 0), 0);
        const paidTotalPayable = myPayments.reduce((s, p) => s + (p.totalPayable || 0), 0);
        const dueTotal = myPayments.reduce((s, p) => s + (p.remainingAmount || 0), 0);

        stats.myStats = {
          employeeType: employee.employeeType,
          workRecords: myWorkRecords.length,
          workTotal,
          payments: myPayments.length,
          paidTotal,
          paidTotalPayable,
          dueTotal,
        };
      }
    }

    return NextResponse.json(stats);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
