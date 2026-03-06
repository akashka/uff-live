import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import RateMaster from '@/lib/models/RateMaster';
import Branch from '@/lib/models/Branch';
import { getAuthUser, hasRole } from '@/lib/auth';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const mode = (formData.get('mode') as string) || 'add'; // 'add' | 'replace'

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as unknown[][];

    // Find header row (SL NO or similar) and data columns
    let headerRow = -1;
    let colSl = -1;
    let colDesc = -1;
    let colRate = -1;

    for (let i = 0; i < Math.min(5, rows.length); i++) {
      const row = rows[i] as (string | number)[];
      for (let j = 0; j < row.length; j++) {
        const val = String(row[j] || '').toUpperCase();
        if (val.includes('SL') && (val.includes('NO') || val === 'SL.NO')) colSl = j;
        if (val.includes('DESCRIPTION') || val === 'DESC') colDesc = j;
        if (val.includes('RATE')) colRate = j;
      }
      if (colDesc >= 0 && colRate >= 0) {
        headerRow = i;
        if (colSl < 0) colSl = 0;
        break;
      }
    }

    if (colDesc < 0 || colRate < 0) {
      return NextResponse.json({ error: 'Could not find DESCRIPTION and RATE columns in Excel' }, { status: 400 });
    }

    const items: { name: string; description: string; rate: number }[] = [];
    for (let i = (headerRow >= 0 ? headerRow + 1 : 1); i < rows.length; i++) {
      const row = rows[i] as (string | number)[];
      const desc = String(row[colDesc] ?? '').trim();
      const rateVal = row[colRate];
      const rate = typeof rateVal === 'number' ? rateVal : parseFloat(String(rateVal || '0'));
      if (!desc || isNaN(rate) || rate < 0) continue;
      // Skip "TOTAL" or empty rows
      if (desc.toUpperCase() === 'TOTAL' || desc === '') continue;
      const name = desc.length > 60 ? desc.slice(0, 60) : desc;
      items.push({ name, description: desc, rate });
    }

    if (items.length === 0) {
      return NextResponse.json({ error: 'No valid rate rows found in Excel' }, { status: 400 });
    }

    await connectDB();
    const branches = await Branch.find({ isActive: true }).lean();
    if (branches.length === 0) {
      return NextResponse.json({ error: 'Add at least one branch before importing rates' }, { status: 400 });
    }

    if (mode === 'replace') {
      await RateMaster.deleteMany({});
    }

    const created: string[] = [];
    const skipped: string[] = [];

    for (const item of items) {
      if (mode === 'add') {
        const existing = await RateMaster.findOne({ name: item.name }).lean();
        if (existing) {
          skipped.push(item.name);
          continue;
        }
      }
      const branchRates = (branches || []).map((b) => ({ branch: b._id, amount: item.rate }));
      await RateMaster.create({
        name: item.name,
        description: item.description,
        unit: 'per piece',
        branchRates,
        isActive: true,
      });
      created.push(item.name);
    }

    return NextResponse.json({
      success: true,
      created: created.length,
      skipped: skipped.length,
      createdNames: created,
      skippedNames: skipped,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Import failed' }, { status: 500 });
  }
}
