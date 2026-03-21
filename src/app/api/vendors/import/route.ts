import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Vendor from '@/lib/models/Vendor';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number)[][];

    await connectDB();

    const created: string[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const vendorId = String(row[0] ?? '').trim();
      const name = String(row[1] ?? '').trim();
      const contactNumber = String(row[2] ?? '').trim();
      const email = String(row[3] ?? '').trim();
      const address = String(row[4] ?? '').trim();
      const bankName = String(row[5] ?? '').trim();
      const accountNumber = String(row[6] ?? '').trim();
      const ifscCode = String(row[7] ?? '').trim();
      const notes = String(row[8] ?? '').trim();

      if (!vendorId || !name || !contactNumber) {
        errors.push(`Row ${i + 1}: Vendor ID, Name and Contact Number are required`);
        continue;
      }

      try {
        const existing = await Vendor.findOne({ $or: [{ vendorId }, { contactNumber }] }).lean();
        if (existing) {
          errors.push(`Row ${i + 1}: Vendor ID or Contact already exists`);
          continue;
        }
        await Vendor.create({
          vendorId,
          name,
          contactNumber,
          email: email || '',
          address: address || '',
          bankName: bankName || '',
          accountNumber: accountNumber || '',
          ifscCode: ifscCode || '',
          notes: notes || '',
          isActive: true,
        });
        created.push(name);
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Error'}`);
      }
    }

    logAudit({
      user,
      action: 'vendor_import',
      entityType: 'vendor',
      entityId: null,
      summary: `Vendors imported: ${created.length} created`,
      metadata: { createdCount: created.length, errorCount: errors.length },
      req,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      created: created.length,
      createdNames: created,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Import failed' }, { status: 500 });
  }
}
