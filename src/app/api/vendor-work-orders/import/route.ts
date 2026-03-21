import { NextRequest, NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import VendorWorkOrder from '@/lib/models/VendorWorkOrder';
import Branch from '@/lib/models/Branch';
import Vendor from '@/lib/models/Vendor';
import StyleOrder from '@/lib/models/StyleOrder';
import RateMaster from '@/lib/models/RateMaster';
import { getAuthUser, hasRole } from '@/lib/auth';
import { logAudit } from '@/lib/audit';
import { VENDOR_WORK_ITEMS } from '@/app/api/vendor-work-items/route';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XLSX = require('xlsx');

function resolveWorkItem(name: string, rates: { _id: mongoose.Types.ObjectId; name: string }[]) {
  const n = name.trim().toLowerCase();
  const rate = rates.find((r) => r.name.trim().toLowerCase() === n);
  if (rate) return { rateMaster: rate._id, workItemKey: null, rateName: rate.name, unit: 'per piece' as const };

  const vi = VENDOR_WORK_ITEMS.find(
    (w) => w.name.toLowerCase() === n || w.name.toLowerCase().replace(/\s*&\s*/g, ' ').includes(n)
  );
  if (vi) return { rateMaster: null, workItemKey: vi.id, rateName: vi.name, unit: vi.unit };

  return null;
}

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
    const vendors = await Vendor.find({ isActive: true }).select('name _id').lean();
    const branches = await Branch.find({ isActive: true }).select('name _id').lean();
    const styleOrders = await StyleOrder.find({ isActive: true }).select('styleCode brand month colour _id').lean();
    const rates = (await RateMaster.find({ isActive: true }).select('name _id').lean()) as { _id: mongoose.Types.ObjectId; name: string }[];

    const vendorByName = new Map(vendors.map((v) => [(v as { name: string }).name.trim().toLowerCase(), v]));
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

    const groups = new Map<
      string,
      {
        vendorId: mongoose.Types.ObjectId;
        branchId: mongoose.Types.ObjectId;
        month: string;
        styleId?: string;
        colour: string;
        extraAmount: number;
        reasons: string;
        items: { rateMaster: mongoose.Types.ObjectId | null; workItemKey: string | null; rateName: string; unit: string; qty: number; ratePerUnit: number }[];
      }
    >();

    const errors: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i] || [];
      const vendorName = String(row[0] ?? '').trim();
      const branchName = String(row[1] ?? '').trim();
      const month = String(row[2] ?? '').trim();
      const styleCodeRaw = String(row[3] ?? '').trim();
      const colour = String(row[4] ?? '').trim();
      const itemName = String(row[5] ?? '').trim();
      const qty = Math.max(0, Number(row[6]) || 0);
      const ratePerUnit = Math.max(0, Number(row[7]) || 0);
      const extraAmount = Math.max(0, Number(row[8]) || 0);
      const reasons = String(row[9] ?? '').trim();

      if (!vendorName || !branchName || !month || !itemName) {
        errors.push(`Row ${i + 1}: Vendor, Branch, Month, Rate/Work Item required`);
        continue;
      }

      const vendor = vendorByName.get(vendorName.toLowerCase());
      const branch = branchByName.get(branchName.toLowerCase());
      if (!vendor || !branch) {
        errors.push(`Row ${i + 1}: Unknown vendor or branch`);
        continue;
      }

      const resolved = resolveWorkItem(itemName, rates);
      if (!resolved) {
        errors.push(`Row ${i + 1}: Unknown rate/work item "${itemName}"`);
        continue;
      }

      const monthVal = /^\d{4}-\d{2}$/.test(month) ? month : '';
      if (!monthVal) {
        errors.push(`Row ${i + 1}: Invalid month (YYYY-MM)`);
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

      const key = `${String((vendor as { _id: unknown })._id)}|${String((branch as { _id: unknown })._id)}|${monthVal}`;
      const existing = groups.get(key);
      const item = {
        rateMaster: resolved.rateMaster,
        workItemKey: resolved.workItemKey,
        rateName: resolved.rateName,
        unit: resolved.unit,
        qty,
        ratePerUnit,
      };

      if (existing) {
        existing.items.push(item);
        existing.extraAmount = Math.max(existing.extraAmount, extraAmount);
        if (reasons) existing.reasons = reasons;
      } else {
        groups.set(key, {
          vendorId: (vendor as { _id: mongoose.Types.ObjectId })._id,
          branchId: (branch as { _id: mongoose.Types.ObjectId })._id,
          month: monthVal,
          styleId,
          colour,
          extraAmount,
          reasons,
          items: [item],
        });
      }
    }

    const created: number[] = [];
    for (const [, rec] of groups) {
      try {
        const workItems = rec.items.map((it) => {
          const amt = it.qty * it.ratePerUnit;
          return {
            rateMaster: it.rateMaster || undefined,
            workItemKey: it.workItemKey || undefined,
            rateName: it.rateName,
            unit: it.unit,
            quantity: it.qty,
            multiplier: 1,
            ratePerUnit: it.ratePerUnit,
            amount: amt,
          };
        });
        const totalAmount = workItems.reduce((s, w) => s + w.amount, 0) + rec.extraAmount;
        await VendorWorkOrder.create({
          vendor: rec.vendorId,
          branch: rec.branchId,
          month: rec.month,
          styleOrder: rec.styleId ?? undefined,
          colour: rec.colour || '',
          workItems,
          extraAmount: rec.extraAmount,
          reasons: rec.reasons || '',
          totalAmount,
        });
        created.push(1);
      } catch (err) {
        errors.push(err instanceof Error ? err.message : 'Error');
      }
    }

    logAudit({
      user,
      action: 'vendor_work_order_import',
      entityType: 'vendor_work_order',
      entityId: null,
      summary: `Vendor work orders imported: ${created.length} created`,
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
