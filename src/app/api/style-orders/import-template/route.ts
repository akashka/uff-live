import { NextResponse } from 'next/server';
import { getAuthUser, hasRole } from '@/lib/auth';
import connectDB from '@/lib/db';
import Branch from '@/lib/models/Branch';
import ExcelJS from 'exceljs';

/** GET - Download Excel template for style orders import with validation */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const branches = await Branch.find({ isActive: true }).select('name').lean();
    const branchNames = branches.map((b) => (b as { name: string }).name);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Style Orders', { views: [{ showGridLines: true }] });

    const headers = ['Style Code (4 digits)', 'Brand', 'Colour (single)', 'Month (YYYY-MM)', 'Total Pieces', 'Client Cost/Piece', 'Client Cost Total', 'Branches (comma-separated)'];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4E8' } };

    // Sample row
    const now = new Date();
    const sampleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    ws.addRow(['0001', 'Sample Brand', 'Red', sampleMonth, 100, 50, 5000, branchNames[0] || 'Branch1']);

    // Column widths
    ws.columns = [
      { width: 18 },
      { width: 20 },
      { width: 28 },
      { width: 14 },
      { width: 14 },
      { width: 18 },
      { width: 18 },
      { width: 30 },
    ];

    // Instructions sheet with valid branch names
    const instSheet = wb.addWorksheet('Valid Values');
    instSheet.addRow(['Branches (use exact names, comma-separated for multiple)']);
    branchNames.forEach((n) => instSheet.addRow([n]));
    instSheet.getColumn(1).width = 40;

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="style_orders_import_template.xlsx"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
