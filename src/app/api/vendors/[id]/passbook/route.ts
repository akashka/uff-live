import { NextRequest, NextResponse } from 'next/server';
import { formatMonth, formatDate } from '@/lib/utils';
import mongoose from 'mongoose';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');
import connectDB from '@/lib/db';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import VendorPayment from '@/lib/models/VendorPayment';
import Vendor from '@/lib/models/Vendor';
import Branch from '@/lib/models/Branch';
import { getAuthUser, hasRole } from '@/lib/auth';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;
const MAX_FETCH = 5000;

/** Branch ref may be missing; String(null) is "null" and must not be queried as ObjectId */
function validBranchObjectIdString(branch: unknown): string | null {
  if (branch == null) return null;
  const s = typeof branch === 'string' ? branch.trim() : String(branch);
  if (!s || s === 'null' || s === 'undefined') return null;
  if (!mongoose.Types.ObjectId.isValid(s)) return null;
  return s;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id: vendorId } = await params;
    if (!vendorId) return NextResponse.json({ error: 'Vendor required' }, { status: 400 });

    await connectDB();

    const vendor = await Vendor.findById(vendorId).select('name').lean();
    if (!vendor) return NextResponse.json({ error: 'Vendor not found' }, { status: 404 });

    const format = req.nextUrl.searchParams.get('format');
    const page = Math.max(1, parseInt(req.nextUrl.searchParams.get('page') || '1', 10));
    const limit = format === 'excel' ? MAX_FETCH : Math.min(MAX_LIMIT, Math.max(1, parseInt(req.nextUrl.searchParams.get('limit') || String(DEFAULT_LIMIT), 10) || DEFAULT_LIMIT));
    const skip = format === 'excel' ? 0 : (page - 1) * limit;

    const vendorObjId = new mongoose.Types.ObjectId(vendorId);

    const [workOrders, payments] = await Promise.all([
      VendorWorkOrder.find({ vendor: vendorObjId })
        .select('_id month totalAmount branch')
        .sort({ month: 1, createdAt: 1 })
        .limit(MAX_FETCH)
        .lean(),
      VendorPayment.find({ vendor: vendorObjId })
        .select('_id paidAt paymentAmount paymentMode month totalPayable paymentType baseAmount addDeductAmount advanceDeducted')
        .sort({ paidAt: 1 })
        .limit(MAX_FETCH)
        .lean(),
    ]);

    const branchIds = [
      ...new Set(
        (workOrders || [])
          .map((r) => validBranchObjectIdString((r as { branch?: unknown }).branch))
          .filter((id): id is string => id != null)
      ),
    ];
    const branchMap = new Map<string, string>();
    if (branchIds.length > 0) {
      const branches = await Branch.find({ _id: { $in: branchIds.map((id) => new mongoose.Types.ObjectId(id)) } })
        .select('name')
        .lean();
      for (const b of branches || []) {
        branchMap.set(String(b._id), (b as { name?: string }).name || '');
      }
    }

    const workEntries = (workOrders || []).map((r) => {
      const branchKey = validBranchObjectIdString((r as { branch?: unknown }).branch);
      const branchName = (branchKey ? branchMap.get(branchKey) : undefined) || 'Branch';
      const month = (r as { month?: string }).month;
      const [y, m] = (month || '').split('-').map(Number);
      const d = y && m ? new Date(y, m - 1, 1) : new Date();
      return {
        type: 'work',
        id: `w-${(r as { _id?: unknown })._id}`,
        date: d.toISOString(),
        particulars: `Work Order – ${branchName} (${formatMonth(month) || '–'})`,
        credit: (r as { totalAmount?: number }).totalAmount ?? 0,
        debit: 0,
      };
    });

    const paymentEntries = (payments || []).map((p) => {
      const month = (p as { month?: string }).month || '';
      const [y, m] = (month || '').split('-').map(Number);
      const d = y && m ? new Date(y, m - 1, 1) : new Date();
      const isAdv = (p as { paymentType?: string }).paymentType === 'advance';
      const paidAt = (p as { paidAt?: Date }).paidAt;
      const paymentMode = (p as { paymentMode?: string }).paymentMode || '';
      const monthStr = formatMonth(month) || '–';
      const paymentAmount = (p as { paymentAmount?: number }).paymentAmount ?? 0;
      const baseAmount = (p as { baseAmount?: number }).baseAmount ?? 0;
      const addDeductAmount = (p as { addDeductAmount?: number }).addDeductAmount ?? 0;
      const advanceDeducted = (p as { advanceDeducted?: number }).advanceDeducted ?? 0;
      const debitAmount = isAdv ? paymentAmount : baseAmount + addDeductAmount;
      return {
        type: isAdv ? 'advance' : 'payment',
        id: `p-${(p as { _id?: unknown })._id}`,
        date: paidAt ? new Date(paidAt).toISOString() : d.toISOString(),
        particulars: isAdv ? `Advance – ${monthStr}` : `Payment – ${monthStr} (${paymentMode})`,
        credit: 0,
        debit: debitAmount,
      };
    });

    const merged = [...workEntries, ...paymentEntries].sort((a, b) => {
      const da = new Date(a.date).getTime();
      const db = new Date(b.date).getTime();
      return da - db;
    });

    const total = merged.length;
    const exportAll = format === 'excel';
    const entries = exportAll ? merged : merged.slice(skip, skip + limit);

    let runningBalance = 0;
    if (!exportAll) {
      for (let i = 0; i < skip; i++) {
        runningBalance += merged[i].credit - merged[i].debit;
      }
    }
    const rowsWithBalance = entries.map((e) => {
      runningBalance += e.credit - e.debit;
      return { ...e, balance: runningBalance };
    });

    const outstanding = merged.reduce((s, e) => s + e.credit - e.debit, 0);

    if (format === 'excel') {
      const excelRows = rowsWithBalance.map((r) => ({
        Date: r.date ? formatDate(r.date) : '–',
        Particulars: r.particulars,
        Credit: r.credit > 0 ? r.credit : '',
        Debit: r.debit > 0 ? r.debit : '',
        Balance: r.balance ?? 0,
      }));
      const ws = XLSX.utils.json_to_sheet(excelRows);
      const wb = XLSX.utils.book_new();
      const vendorName = (vendor as { name?: string }).name || 'Passbook';
      const sheetName = `Passbook_${vendorName}`.slice(0, 31).replace(/[/\\?*\[\]]/g, '_');
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      const filename = `vendor_passbook_${vendorName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename}"`,
        },
      });
    }

    return NextResponse.json({
      vendor,
      data: rowsWithBalance,
      total,
      page,
      limit,
      hasMore: page * limit < total,
      outstanding,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
