import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Payment from '@/lib/models/Payment';
import Employee from '@/lib/models/Employee';
import { getAuthUser, hasRole } from '@/lib/auth';
import { createPayslipPdf } from '@/lib/pdf';
import { formatMonth } from '@/lib/utils';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ employeeId: string }> }
) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { employeeId } = await params;
    const month = req.nextUrl.searchParams.get('month') || '';

    const canAccessAny = hasRole(user, ['admin', 'finance', 'accountancy', 'hr']);
    const isOwn = String(user.employeeId) === String(employeeId);
    if (!canAccessAny && !isOwn) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'Valid month (YYYY-MM) required' }, { status: 400 });
    }

    await connectDB();

    const employee = await Employee.findById(employeeId).lean();
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const empType = (employee as { employeeType?: string }).employeeType || 'contractor';
    const payment = await Payment.findOne({
      employee: employeeId,
      month: month.slice(0, 7),
      paymentType: empType,
      isAdvance: false,
    }).lean();

    if (!payment) {
      return NextResponse.json({ error: 'No payment found for this month' }, { status: 404 });
    }

    const p = payment as {
      baseAmount?: number;
      addDeductAmount?: number;
      addDeductRemarks?: string;
      pfDeducted?: number;
      esiDeducted?: number;
      advanceDeducted?: number;
      totalPayable?: number;
      paymentAmount?: number;
      paymentMode?: string;
    };

    const emp = employee as {
      name?: string;
      bankName?: string;
      accountNumber?: string;
    };

    const pdfBuffer = createPayslipPdf({
      employeeName: emp.name || 'Employee',
      employeeType: empType,
      month,
      monthLabel: formatMonth(month) || month,
      baseAmount: p.baseAmount ?? 0,
      addDeductAmount: p.addDeductAmount ?? 0,
      addDeductRemarks: p.addDeductRemarks || '',
      pfDeducted: p.pfDeducted ?? 0,
      esiDeducted: p.esiDeducted ?? 0,
      advanceDeducted: p.advanceDeducted ?? 0,
      totalPayable: p.totalPayable ?? 0,
      paymentAmount: p.paymentAmount ?? 0,
      paymentMode: p.paymentMode || '',
      bankName: emp.bankName,
      accountNumber: emp.accountNumber,
    });

    const filename = `payslip_${(emp.name || 'employee').replace(/\s+/g, '_')}_${month}.pdf`;
    const buf = Buffer.from(pdfBuffer);
    return new Response(buf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate payslip' }, { status: 500 });
  }
}
