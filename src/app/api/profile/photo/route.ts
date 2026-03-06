import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';
import { getAuthUser } from '@/lib/auth';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE = 2 * 1024 * 1024; // 2MB

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.employeeId) return NextResponse.json({ error: 'No employee profile' }, { status: 400 });

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
    const employee = await Employee.findById(user.employeeId);
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const id = String(employee._id);
    const ext = file.name.split('.').pop() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext.toLowerCase()) ? ext.toLowerCase() : 'jpg';
    const filename = `${id}.${safeExt}`;
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'employees');
    const filepath = path.join(uploadDir, filename);

    await mkdir(uploadDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(filepath, Buffer.from(bytes));

    const photoUrl = `/uploads/employees/${filename}`;
    employee.photo = photoUrl;
    await employee.save();

    return NextResponse.json({ photo: photoUrl });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
