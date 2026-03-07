import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import { getAuthUser, hasRole } from '@/lib/auth';
import { createPaymentSummaryPdf } from '@/lib/pdf';
import { formatMonth } from '@/lib/utils';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const month = req.nextUrl.searchParams.get('month') || '';
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Valid month (YYYY-MM) required' }, { status: 400 });
    }

    const monthStr = month.slice(0, 7);

    await connectDB();

    const payments = await Payment.find({
      month: monthStr,
      isAdvance: false,
    })
      .populate('employee', 'name')
      .sort({ paidAt: 1 })
      .lean();

    const byEmployee = new Map<
      string,
      { employeeName: string; totalPayable: number; paymentAmount: number; paymentMode: string }
    >();

    for (const p of payments || []) {
      const empId = String(p.employee);
      const emp = p.employee as { name?: string } | null;
      const existing = byEmployee.get(empId);
      const amount = (p as { paymentAmount?: number }).paymentAmount ?? 0;
      const payable = (p as { totalPayable?: number }).totalPayable ?? 0;
      const mode = (p as { paymentMode?: string }).paymentMode || '';

      if (existing) {
        existing.paymentAmount += amount;
        existing.totalPayable += payable;
      } else {
        byEmployee.set(empId, {
          employeeName: emp?.name || 'Unknown',
          totalPayable: payable,
          paymentAmount: amount,
          paymentMode: mode,
        });
      }
    }

    const rows = Array.from(byEmployee.values());
    const total = rows.reduce((s, r) => s + r.paymentAmount, 0);

    const pdfBuffer = createPaymentSummaryPdf({
      month: monthStr,
      monthLabel: formatMonth(monthStr) || monthStr,
      rows,
      total,
    });

    const filename = `payment_summary_${monthStr}.pdf`;
    const buf = Buffer.from(pdfBuffer);
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate payment summary' }, { status: 500 });
  }
}
