import { NextResponse } from 'next/server';
import { getAuthUser, hasRole } from '@/lib/auth';
import ExcelJS from 'exceljs';
/** GET - Download Excel template for vendors import */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Vendors', { views: [{ showGridLines: true }] });

    const headers = ['Vendor ID', 'Name', 'Contact Number', 'Email', 'Address', 'Bank Name', 'Account Number', 'IFSC Code', 'Notes'];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4E8' } };
    ws.addRow(['VEN001', 'Sample Vendor', '9876543210', 'vendor@example.com', '123 Address', 'HDFC', '1234567890', 'HDFC0001234', '']);

    ws.columns = [
      { width: 12 },
      { width: 20 },
      { width: 16 },
      { width: 24 },
      { width: 24 },
      { width: 14 },
      { width: 16 },
      { width: 14 },
      { width: 20 },
    ];

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="vendors_import_template.xlsx"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
