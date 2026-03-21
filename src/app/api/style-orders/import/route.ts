import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import StyleOrder from '@/lib/models/StyleOrder';
import Branch from '@/lib/models/Branch';
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
    const branches = await Branch.find({ isActive: true }).lean();
    const branchByName = new Map(branches.map((b) => [(b as { name: string }).name, b]));

    const created: string[] = [];
    const errors: string[] = [];

    // Skip header row (row 0)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const styleCodeRaw = String(row[0] ?? '').trim();
      const brand = String(row[1] ?? '').trim();
      const colourStr = String(row[2] ?? '').trim();
      const month = String(row[3] ?? '').trim();
      const totalQty = Math.max(0, Number(row[4]) || 0);
      const costPerPiece = Math.max(0, Number(row[5]) || 0);
      const costTotal = Math.max(0, Number(row[6]) || 0);
      const branchNamesStr = String(row[7] ?? '').trim();

      if (!styleCodeRaw || !brand) continue;

      const digits = styleCodeRaw.replace(/\D/g, '').slice(0, 4);
      const styleCode = digits.length >= 1 ? digits.padStart(4, '0') : null;
      if (!styleCode) {
        errors.push(`Row ${i + 1}: Invalid style code`);
        continue;
      }

      const monthVal = /^\d{4}-\d{2}$/.test(month) ? month : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
      const colour = colourStr || '';
      const branchNames = branchNamesStr ? branchNamesStr.split(/[,;]/).map((b) => b.trim()).filter(Boolean) : [];
      const branchIds = branchNames
        .map((n) => branchByName.get(n)?._id)
        .filter((id): id is mongoose.Types.ObjectId => id != null);

      if (branchIds.length === 0 && branchNames.length > 0) {
        errors.push(`Row ${i + 1}: Unknown branches: ${branchNames.join(', ')}`);
        continue;
      }
      let finalBranchIds = branchIds;
      if (finalBranchIds.length === 0) {
        finalBranchIds = branches.map((b) => (b as { _id: mongoose.Types.ObjectId })._id);
      }

      const existing = await StyleOrder.findOne({ styleCode: styleCode!, brand, month: monthVal, colour }).lean();
      if (existing) {
        errors.push(`Row ${i + 1}: Duplicate - ${styleCode} / ${brand} / ${monthVal} / ${colour || '(none)'} already exists`);
        continue;
      }

      try {
        await StyleOrder.create({
          styleCode,
          brand,
          colour,
          month: monthVal,
          totalOrderQuantity: totalQty,
          clientCostPerPiece: costTotal > 0 && totalQty > 0 ? costTotal / totalQty : costPerPiece,
          clientCostTotalAmount: costTotal > 0 ? costTotal : totalQty * costPerPiece,
          branches: finalBranchIds,
          isActive: true,
        });
        created.push(`${styleCode} - ${brand}`);
      } catch (err) {
        errors.push(`Row ${i + 1}: ${err instanceof Error ? err.message : 'Duplicate or invalid'}`);
      }
    }

    logAudit({
      user,
      action: 'style_order_import',
      entityType: 'style_order',
      entityId: null,
      summary: `Style orders imported: ${created.length} created, ${errors.length} errors`,
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
