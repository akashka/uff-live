import { NextResponse } from 'next/server';
import { getAuthUser, hasRole } from '@/lib/auth';
import ExcelJS from 'exceljs';

/** GET - Download Excel template for branches import */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Branches', { views: [{ showGridLines: true }] });

    const headers = ['Name', 'Address', 'Phone Number', 'Email'];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4E8' } };
    ws.addRow(['Sample Branch', '123 Main St', '9876543210', 'branch@example.com']);

    ws.columns = [{ width: 25 }, { width: 35 }, { width: 18 }, { width: 28 }];

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="branches_import_template.xlsx"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
