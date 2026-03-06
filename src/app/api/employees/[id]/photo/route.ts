import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';
import { getAuthUser, hasRole } from '@/lib/auth';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!hasRole(user, ['admin', 'finance', 'hr'])) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get('photo') as File | null;

    if (!file || !file.size) {
      return NextResponse.json({ error: 'No photo provided' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP or GIF.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 2MB.' }, { status: 400 });
    }

    await connectDB();
    const employee = await Employee.findById(id);
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const photoUrl = `data:${file.type};base64,${base64}`;
    employee.photo = photoUrl;
    await employee.save();

    return NextResponse.json({ photo: photoUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
