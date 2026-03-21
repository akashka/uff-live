import { NextResponse } from 'next/server';
import { getAuthUser, hasRole } from '@/lib/auth';
import connectDB from '@/lib/db';
import Branch from '@/lib/models/Branch';
import Employee from '@/lib/models/Employee';
import StyleOrder from '@/lib/models/StyleOrder';
import RateMaster from '@/lib/models/RateMaster';
import ExcelJS from 'exceljs';
import { addListValidation } from '@/lib/excel-utils';

/** GET - Download Excel template for work records import. One row = one work item. Rows with same Employee+Branch+Month are grouped. */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const employees = await Employee.find({ isActive: true, employeeType: 'contractor' }).select('name employeeId').lean();
    const branches = await Branch.find({ isActive: true }).select('name').lean();
    const styleOrders = await StyleOrder.find({ isActive: true }).select('styleCode brand').lean();
    const rates = await RateMaster.find({ isActive: true }).populate('branchRates.branch').lean();

    const empNames = employees.map((e) => (e as { name: string }).name);
    const branchNames = branches.map((b) => (b as { name: string }).name);
    const styleCodes = styleOrders.map((s) => `${(s as { styleCode: string }).styleCode} - ${(s as { brand?: string }).brand || ''}`);
    const rateNames = [...new Set(rates.map((r) => (r as { name: string }).name))];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Work Records', { views: [{ showGridLines: true }] });

    const headers = [
      'Employee Name', 'Branch', 'Month (YYYY-MM)', 'Style Code (optional)', 'Colour (optional)',
      'Rate Name', 'Quantity', 'Rate Per Unit', 'OT Hours', 'OT Amount', 'Notes',
    ];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4E8' } };

    const now = new Date();
    const sampleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sampleEmp = empNames[0] || 'Employee 1';
    const sampleBranch = branchNames[0] || 'Main';
    const sampleRate = rateNames[0] || 'Stitching';
    ws.addRow([sampleEmp, sampleBranch, sampleMonth, '', '', sampleRate, 10, 15, 0, 0, '']);

    ws.columns = headers.map(() => ({ width: 16 }));

    if (empNames.length > 0) addListValidation(ws, 'A2:A1000', empNames, false);
    if (branchNames.length > 0) addListValidation(ws, 'B2:B1000', branchNames, false);
    if (styleCodes.length > 0) addListValidation(ws, 'D2:D1000', styleCodes, true);
    if (rateNames.length > 0) addListValidation(ws, 'F2:F1000', rateNames, false);

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="work_records_import_template.xlsx"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
