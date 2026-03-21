import { NextResponse } from 'next/server';
import { getAuthUser, hasRole } from '@/lib/auth';
import connectDB from '@/lib/db';
import Branch from '@/lib/models/Branch';
import Department from '@/lib/models/Department';
import ExcelJS from 'exceljs';
import { addListValidation } from '@/lib/excel-utils';

/** GET - Download Excel template for employees import with validation */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const branches = await Branch.find({ isActive: true }).select('name').lean();
    const departments = await Department.find({ isActive: true }).select('name').lean();
    const branchNames = branches.map((b) => (b as { name: string }).name);
    const deptNames = departments.map((d) => (d as { name: string }).name);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Employees', { views: [{ showGridLines: true }] });

    const headers = [
      'Employee ID', 'Name', 'Contact Number', 'Email', 'Emergency Number',
      'Date of Birth (YYYY-MM-DD)', 'Gender', 'Marital Status', 'Employee Type',
      'Branch', 'Department', 'Monthly Salary', 'PF Opted (Y/N)', 'ESI Opted (Y/N)',
      'Aadhaar', 'PAN', 'Bank Name', 'Account Number', 'IFSC Code',
    ];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4E8' } };

    const sampleBranch = branchNames[0] || 'Main';
    const sampleDept = deptNames[0] || 'Production';
    ws.addRow([
      'EMP001', 'Sample Employee', '9876543210', 'emp@example.com', '9876543211',
      '1990-01-15', 'male', 'single', 'contractor',
      sampleBranch, sampleDept, 15000, 'Y', 'N',
      '', '', 'HDFC', '1234567890', 'HDFC0001234',
    ]);

    ws.columns = headers.map(() => ({ width: 16 }));

    addListValidation(ws, 'G2:G1000', ['male', 'female', 'other'], false);
    addListValidation(ws, 'H2:H1000', ['single', 'married', 'other'], true);
    addListValidation(ws, 'I2:I1000', ['full_time', 'contractor'], false);
    if (branchNames.length > 0) addListValidation(ws, 'J2:J1000', branchNames, false);
    if (deptNames.length > 0) addListValidation(ws, 'K2:K1000', deptNames, true);
    addListValidation(ws, 'M2:M1000', ['Y', 'N'], false);
    addListValidation(ws, 'N2:N1000', ['Y', 'N'], false);

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="employees_import_template.xlsx"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
