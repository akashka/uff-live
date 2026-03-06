import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Branch from '@/lib/models/Branch';
import { getAuthUser, hasRole } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await connectDB();
    const { searchParams } = new URL(req.url);
    const includeInactive = searchParams.get('includeInactive') === 'true';
    const filter = includeInactive ? {} : { isActive: true };
    const branches = await Branch.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json(branches);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await req.json();
    const { name, address, phoneNumber, email } = body;
    if (!name || !address || !phoneNumber) {
      return NextResponse.json({ error: 'Name, address and phone required' }, { status: 400 });
    }

    await connectDB();
    const branch = await Branch.create({ name, address, phoneNumber, email: email || '' });
    return NextResponse.json(branch);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
