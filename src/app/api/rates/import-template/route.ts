import { NextResponse } from 'next/server';
import { getAuthUser, hasRole } from '@/lib/auth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');

/** GET - Download Excel template for rate import (SL NO, DESCRIPTION, RATE) */
export async function GET() {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const headers = ['SL NO', 'DESCRIPTION', 'RATE'];
    const sampleRows = [
      [1, 'Stitching - Jeans', 15],
      [2, 'Cutting - Shirt', 8],
      [3, 'Finishing - Button', 2],
    ];
    const data = [headers, ...sampleRows];

    const ws = XLSX.utils.aoa_to_sheet(data);
    ws['!cols'] = [{ wch: 8 }, { wch: 30 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rate List');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="rate_import_template.xlsx"',
      },
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Failed to generate template' }, { status: 500 });
  }
}
