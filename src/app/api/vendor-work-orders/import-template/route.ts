import { NextResponse } from 'next/server';
import { getAuthUser, hasRole } from '@/lib/auth';
import connectDB from '@/lib/db';
import Branch from '@/lib/models/Branch';
import Vendor from '@/lib/models/Vendor';
import StyleOrder from '@/lib/models/StyleOrder';
import RateMaster from '@/lib/models/RateMaster';
import { VENDOR_WORK_ITEMS } from '@/app/api/vendor-work-items/route';
import ExcelJS from 'exceljs';
import { addListValidation } from '@/lib/excel-utils';

/** GET - Download Excel template for vendor work orders import */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const vendors = await Vendor.find({ isActive: true }).select('name').lean();
    const branches = await Branch.find({ isActive: true }).select('name').lean();
    const styleOrders = await StyleOrder.find({ isActive: true }).select('styleCode brand colour').lean();
    const rates = await RateMaster.find({ isActive: true }).select('name').lean();

    const vendorNames = vendors.map((v) => (v as { name: string }).name);
    const branchNames = branches.map((b) => (b as { name: string }).name);
    const styleCodes = styleOrders.map((s) => {
      const code = (s as { styleCode: string }).styleCode;
      const brand = (s as { brand?: string }).brand || '';
      const colour = (s as { colour?: string }).colour || '';
      return colour ? `${code} - ${brand} (${colour})` : `${code} - ${brand}`;
    });
    const rateNames = rates.map((r) => (r as { name: string }).name);
    const workItemNames = VENDOR_WORK_ITEMS.map((w) => w.name);
    const allItemNames = [...new Set([...rateNames, ...workItemNames])];

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Vendor Work Orders', { views: [{ showGridLines: true }] });

    const headers = [
      'Vendor Name', 'Branch', 'Month (YYYY-MM)', 'Style Code (optional)', 'Colour (optional)',
      'Rate/Work Item Name', 'Quantity', 'Rate Per Unit', 'Extra Amount', 'Reasons',
    ];
    ws.addRow(headers);
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F4E8' } };

    const now = new Date();
    const sampleMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const sampleVendor = vendorNames[0] || 'Vendor 1';
    const sampleBranch = branchNames[0] || 'Main';
    const sampleItem = allItemNames[0] || 'Stitching';
    ws.addRow([sampleVendor, sampleBranch, sampleMonth, '', '', sampleItem, 100, 12, 0, '']);

    ws.columns = headers.map(() => ({ width: 18 }));

    if (vendorNames.length > 0) addListValidation(ws, 'A2:A1000', vendorNames, false);
    if (branchNames.length > 0) addListValidation(ws, 'B2:B1000', branchNames, false);
    if (styleCodes.length > 0) addListValidation(ws, 'D2:D1000', styleCodes, true);
    if (allItemNames.length > 0) addListValidation(ws, 'F2:F1000', allItemNames, false);

    const buf = await wb.xlsx.writeBuffer();
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="vendor_work_orders_import_template.xlsx"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
