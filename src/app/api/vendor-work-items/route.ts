import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, hasRole } from '@/lib/auth';

/** Hardcoded vendor work items - no rate master, user enters pricing each time */
export const VENDOR_WORK_ITEMS = [
  { id: 'stitching', name: 'Stitching', unit: 'per piece' },
  { id: 'cutting', name: 'Cutting', unit: 'per piece' },
  { id: 'finishing-packing', name: 'Finishing & Packing', unit: 'per piece' },
];

export async function GET(_req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'accountancy', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    return NextResponse.json(VENDOR_WORK_ITEMS);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
