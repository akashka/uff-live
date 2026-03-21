import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import FullTimeWorkRecord from '@/lib/models/FullTimeWorkRecord';
import Employee from '@/lib/models/Employee';
import { getAuthUser, hasRole } from '@/lib/auth';

export type WorkOrderType = 'contractor' | 'full_time' | 'vendor';

/** Unified work orders API - fetches contractor, full-time, and vendor work orders with type filter */
export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const canAccessAll = hasRole(user, ['admin', 'finance', 'accountancy', 'hr']);
    const isContractorEmployee = !!user.employeeId && user.employeeType === 'contractor';

    if (!canAccessAll && !isContractorEmployee) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await connectDB();
    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as WorkOrderType | null; // contractor | full_time | vendor
    const employeeId = searchParams.get('employeeId');
    const vendorId = searchParams.get('vendorId');
    const branchId = searchParams.get('branchId');
    const departmentId = searchParams.get('departmentId');
    const month = searchParams.get('month');

    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
    const skip = (page - 1) * limit;

    const results: Array<{
      _id: string;
      type: WorkOrderType;
      month: string;
      totalAmount: number;
      subjectName: string;
      branchName?: string;
      styleCode?: string;
      raw: Record<string, unknown>;
    }> = [];

    const monthStr = month ? String(month).slice(0, 7) : undefined;
    const fetchLimit = type ? limit * page + 10 : 80; // When single type: fetch enough for pagination. When all: fetch 80 per type.

    // Contractor work records
    if ((!type || type === 'contractor') && (canAccessAll || isContractorEmployee)) {
      let wrFilter: Record<string, unknown> = {};
      if (isContractorEmployee && !canAccessAll) {
        wrFilter = { employee: user.employeeId };
      } else {
        if (employeeId) wrFilter = { ...wrFilter, employee: employeeId };
        if (branchId) wrFilter = { ...wrFilter, branch: branchId };
        if (monthStr) wrFilter = { ...wrFilter, month: monthStr };
        if (departmentId && !employeeId) {
          const employeesInDept = await Employee.find({ department: departmentId }).select('_id').lean();
          wrFilter = { ...wrFilter, employee: { $in: employeesInDept.map((e) => e._id) } };
        }
      }

      const workRecords = await WorkRecord.find(wrFilter)
        .populate({ path: 'employee', select: 'name _id' })
        .populate('branch', 'name _id')
        .populate('styleOrder', 'styleCode brand _id')
        .sort({ month: -1, createdAt: -1 })
        .limit(fetchLimit)
        .lean();

      const wrRecords = workRecords.map((r: Record<string, unknown>) => {
        const emp = r.employee as { name?: string } | null;
        const br = r.branch as { name?: string } | null;
        const so = r.styleOrder as { styleCode?: string; brand?: string } | null;
        const styleStr = so ? (so.brand ? `${so.styleCode || ''} - ${so.brand}` : so.styleCode || '') : '';
        return {
          _id: String(r._id),
          type: 'contractor' as const,
          month: r.month as string,
          totalAmount: (r.totalAmount as number) ?? 0,
          subjectName: emp?.name || '',
          branchName: br?.name || '',
          styleCode: styleStr,
          raw: r,
        };
      });

      if (!type || type === 'contractor') {
        results.push(...wrRecords);
      }
    }

    // Full-time work records
    if ((!type || type === 'full_time') && canAccessAll) {
      let ftFilter: Record<string, unknown> = {};
      if (employeeId) ftFilter = { ...ftFilter, employee: employeeId };
      if (branchId) ftFilter = { ...ftFilter, branch: branchId };
      if (monthStr) ftFilter = { ...ftFilter, month: monthStr };
      if (departmentId && !employeeId) {
        const employeesInDept = await Employee.find({ department: departmentId, employeeType: 'full_time' }).select('_id').lean();
        ftFilter = { ...ftFilter, employee: { $in: employeesInDept.map((e) => e._id) } };
      }

      const ftRecords = await FullTimeWorkRecord.find(ftFilter)
        .populate({ path: 'employee', select: 'name _id' })
        .populate('branch', 'name _id')
        .sort({ month: -1, createdAt: -1 })
        .limit(fetchLimit)
        .lean();

      const ftMapped = ftRecords.map((r: Record<string, unknown>) => {
        const emp = r.employee as { name?: string } | null;
        const br = r.branch as { name?: string } | null;
        return {
          _id: String(r._id),
          type: 'full_time' as const,
          month: r.month as string,
          totalAmount: (r.totalAmount as number) ?? 0,
          subjectName: emp?.name || '',
          branchName: br?.name || '',
          styleCode: '',
          raw: r,
        };
      });

      if (!type || type === 'full_time') {
        results.push(...ftMapped);
      }
    }

    // Vendor work orders
    if ((!type || type === 'vendor') && canAccessAll) {
      let vwoFilter: Record<string, unknown> = {};
      if (vendorId) vwoFilter = { ...vwoFilter, vendor: vendorId };
      if (branchId) vwoFilter = { ...vwoFilter, branch: branchId };
      if (monthStr) vwoFilter = { ...vwoFilter, month: monthStr };

      const vendorOrders = await VendorWorkOrder.find(vwoFilter)
        .populate('vendor', 'name _id')
        .populate('branch', 'name _id')
        .populate('styleOrder', 'styleCode brand _id')
        .sort({ month: -1, createdAt: -1 })
        .limit(fetchLimit)
        .lean();

      const vwoMapped = vendorOrders.map((r: Record<string, unknown>) => {
        const ven = r.vendor as { name?: string } | null;
        const br = r.branch as { name?: string } | null;
        const so = r.styleOrder as { styleCode?: string; brand?: string } | null;
        const styleStr = so ? (so.brand ? `${so.styleCode || ''} - ${so.brand}` : so.styleCode || '') : '';
        return {
          _id: String(r._id),
          type: 'vendor' as const,
          month: r.month as string,
          totalAmount: (r.totalAmount as number) ?? 0,
          subjectName: ven?.name || '',
          branchName: br?.name || '',
          styleCode: styleStr,
          raw: r,
        };
      });

      if (!type || type === 'vendor') {
        results.push(...vwoMapped);
      }
    }

    // Sort combined by month desc, then by createdAt
    results.sort((a, b) => {
      const monthCmp = (b.month || '').localeCompare(a.month || '');
      if (monthCmp !== 0) return monthCmp;
      const aCreated = (a.raw as { createdAt?: string }).createdAt;
      const bCreated = (b.raw as { createdAt?: string }).createdAt;
      return new Date(bCreated || 0).getTime() - new Date(aCreated || 0).getTime();
    });

    // Apply pagination to combined results
    const total = results.length;
    const paginated = results.slice(skip, skip + limit);

    return NextResponse.json({
      data: paginated,
      total,
      page,
      limit,
      hasMore: skip + limit < total,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
