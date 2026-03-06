import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import { getAuthUser, hasRole } from '@/lib/auth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(req.url);
    const format = searchParams.get('format') || 'csv'; // csv | excel
    const includeZero = searchParams.get('includeZero') === 'true';
    const paymentRun = searchParams.get('paymentRun') || '';
    const startDate = searchParams.get('startDate') || '';
    const endDate = searchParams.get('endDate') || '';

    await connectDB();

    const filter: Record<string, unknown> = {};
    if (paymentRun) filter.paymentRun = paymentRun;
    if (startDate) filter.paidAt = { ...(filter.paidAt as object), $gte: new Date(startDate) };
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      filter.paidAt = { ...(filter.paidAt as object), $lte: end };
    }
    if (!includeZero) filter.paymentAmount = { $gt: 0 };

    const payments = await Payment.find(filter)
      .populate('employee', 'name ifscCode accountNumber bankBranch')
      .sort({ paidAt: -1 })
      .lean();

    const rows: { Amount: number; Beneficiary_Name: string; 'Beneficiary_Branch / IFSC Code': string; Beneficiary_Acc_No: string }[] = (payments || []).map((p) => {
      const emp = p.employee as { name?: string; ifscCode?: string; accountNumber?: string; bankBranch?: string } | null;
      const ifsc = emp?.ifscCode || '';
      const acc = emp?.accountNumber || '';
      return {
        Amount: p.paymentAmount ?? 0,
        Beneficiary_Name: emp?.name || '',
        'Beneficiary_Branch / IFSC Code': ifsc,
        Beneficiary_Acc_No: acc,
      };
    });

    if (format === 'excel') {
      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      const sheetName = paymentRun || `Payments_${new Date().toISOString().slice(0, 10)}`;
      XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
      const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
      return new NextResponse(buf, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="payment_export_${new Date().toISOString().slice(0, 10)}.xlsx"`,
        },
      });
    }

    const header = 'Amount,Beneficiary_Name,Beneficiary_Branch / IFSC Code,Beneficiary_Acc_No';
    const csvRows = rows.map((r) =>
      [r.Amount, `"${(r.Beneficiary_Name || '').replace(/"/g, '""')}"`, r['Beneficiary_Branch / IFSC Code'], r.Beneficiary_Acc_No].join(',')
    );
    const csv = [header, ...csvRows].join('\n');

    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payment_export_${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
