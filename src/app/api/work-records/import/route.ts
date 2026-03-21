import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import WorkRecord from '@/lib/models/WorkRecord';
import Branch from '@/lib/models/Branch';
import Employee from '@/lib/models/Employee';
import StyleOrder from '@/lib/models/StyleOrder';
import RateMaster from '@/lib/models/RateMaster';
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
    if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as (string | number)[][];

    await connectDB();
    const employees = await Employee.find({ isActive: true }).select('name _id').lean();
    const branches = await Branch.find({ isActive: true }).select('name _id').lean();
    const styleOrders = await StyleOrder.find({ isActive: true }).select('styleCode brand month colour _id').lean();
    const rates = await RateMaster.find({ isActive: true }).select('name _id').lean();

    const empByName = new Map(employees.map((e) => [(e as { name: string }).name.trim().toLowerCase(), e]));
    const branchByName = new Map(branches.map((b) => [(b as { name: string }).name.trim().toLowerCase(), b]));
    const styleByCode = new Map(
      styleOrders.map((s) => {
        const sc = (s as { styleCode: string }).styleCode;
        const br = (s as { brand?: string }).brand || '';
        const mo = (s as { month?: string }).month || '';
        const col = (s as { colour?: string }).colour ?? (Array.isArray((s as { colours?: string[] }).colours) ? (s as { colours?: string[] }).colours?.[0] : '') ?? '';
        return [`${sc}-${br}-${mo}-${col}`.toLowerCase(), s];
      })
    );
    const rateByName = new Map(rates.map((r) => [(r as { name: string }).name.trim().toLowerCase(), r]));

    const groups = new Map<string, { empId: mongoose.Types.ObjectId; branchId: mongoose.Types.ObjectId; month: string; styleId?: string; colour: string; notes: string; items: { rateId: mongoose.Types.ObjectId; rateName: string; qty: number; ratePerUnit: number }[]; otHours: number; otAmount: number }>();

    const created: number[] = [];
    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const empName = String(row[0] ?? '').trim();
      const branchName = String(row[1] ?? '').trim();
      const month = String(row[2] ?? '').trim();
      const styleCodeRaw = String(row[3] ?? '').trim();
      const colour = String(row[4] ?? '').trim();
      const rateName = String(row[5] ?? '').trim();
      const qty = Math.max(0, Number(row[6]) || 0);
      const ratePerUnit = Math.max(0, Number(row[7]) || 0);
      const otHours = Math.max(0, Number(row[8]) || 0);
      const otAmount = Math.max(0, Number(row[9]) || 0);
      const notes = String(row[10] ?? '').trim();

      if (!empName || !branchName || !month || !rateName) {
        errors.push(`Row ${i + 1}: Employee, Branch, Month, Rate Name required`);
        continue;
      }

      const emp = empByName.get(empName.toLowerCase());
      const branch = branchByName.get(branchName.toLowerCase());
      if (!emp || !branch) {
        errors.push(`Row ${i + 1}: Unknown employee or branch`);
        continue;
      }

      const rate = rateByName.get(rateName.toLowerCase());
      if (!rate) {
        errors.push(`Row ${i + 1}: Unknown rate "${rateName}"`);
        continue;
      }

      const monthVal = /^\d{4}-\d{2}$/.test(month) ? month : '';
      if (!monthVal) {
        errors.push(`Row ${i + 1}: Invalid month format (YYYY-MM)`);
        continue;
      }

      let styleId: string | undefined;
      if (styleCodeRaw) {
        const parts = styleCodeRaw.split('-').map((p) => p.trim());
        const sc = parts[0] || '';
        const br = parts.slice(1).join('-') || '';
        const lookupKey = `${sc}-${br}-${monthVal}-${colour}`.toLowerCase();
        styleId = (styleByCode.get(lookupKey) as { _id: string } | undefined)?._id;
      }

      const key = `${String((emp as { _id: unknown })._id)}|${String((branch as { _id: unknown })._id)}|${monthVal}`;
      const existing = groups.get(key);
      const item = { rateId: (rate as { _id: mongoose.Types.ObjectId })._id, rateName, qty, ratePerUnit };
      const amount = qty * (ratePerUnit || 0);

      if (existing) {
        existing.items.push(item);
        existing.otHours = Math.max(existing.otHours, otHours);
        existing.otAmount = Math.max(existing.otAmount, otAmount);
        if (notes) existing.notes = notes;
      } else {
        groups.set(key, {
          empId: (emp as { _id: mongoose.Types.ObjectId })._id,
          branchId: (branch as { _id: mongoose.Types.ObjectId })._id,
          month: monthVal,
          styleId,
          colour,
          notes,
          items: [item],
          otHours,
          otAmount,
        });
      }
    }

    for (const [, rec] of groups) {
      try {
        const workItems = rec.items.map((it) => {
          const amt = it.qty * it.ratePerUnit;
          return {
            rateMaster: it.rateId,
            rateName: it.rateName,
            unit: 'per piece',
            quantity: it.qty,
            multiplier: 1,
            ratePerUnit: it.ratePerUnit,
            amount: amt,
          };
        });
        const totalAmount = workItems.reduce((s, w) => s + w.amount, 0) + rec.otAmount;
        await WorkRecord.create({
          employee: rec.empId,
          branch: rec.branchId,
          month: rec.month,
          styleOrder: rec.styleId ?? undefined,
          colour: rec.colour || '',
          workItems,
          otHours: rec.otHours,
          otAmount: rec.otAmount,
          totalAmount,
          notes: rec.notes || '',
        });
        created.push(1);
      } catch (err) {
        errors.push(`${err instanceof Error ? err.message : 'Error'}`);
      }
    }

    logAudit({
      user,
      action: 'work_record_import',
      entityType: 'work_record',
      entityId: null,
      summary: `Work records imported: ${created.length} created`,
      metadata: { createdCount: created.length, errorCount: errors.length },
      req,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      created: created.length,
      errors: errors.slice(0, 20),
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Import failed' }, { status: 500 });
  }
}
