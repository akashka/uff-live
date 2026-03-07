import { NextRequest, NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';
import { getAuthUser } from '@/lib/auth';
import { logAudit } from '@/lib/audit';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
const MAX_SIZE = 5 * 1024 * 1024; // 5MB
const DOCUMENT_TYPES = ['aadhaar', 'pan', 'driving_license', 'passport', 'voter_id', 'other'] as const;

/** POST - Employee uploads a document for their own profile. */
export async function POST(req: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (!user.employeeId) return NextResponse.json({ error: 'No employee profile' }, { status: 400 });

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const type = formData.get('type') as string | null;
    const name = (formData.get('name') as string | null) || '';

    if (!file || !file.size) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!type || !DOCUMENT_TYPES.includes(type as (typeof DOCUMENT_TYPES)[number])) {
      return NextResponse.json({ error: 'Invalid document type' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPEG, PNG, WebP, GIF or PDF.' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File too large. Max 5MB.' }, { status: 400 });
    }

    await connectDB();
    const employee = await Employee.findById(user.employeeId);
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });

    const bytes = await file.arrayBuffer();
    const base64 = Buffer.from(bytes).toString('base64');
    const fileUrl = `data:${file.type};base64,${base64}`;

    const doc = {
      type,
      name: name.trim() || undefined,
      fileUrl,
      uploadedAt: new Date(),
    };

    if (!employee.documents) employee.documents = [];
    employee.documents.push(doc);
    await employee.save();

    logAudit({
      user,
      action: 'profile_document_upload',
      entityType: 'employee',
      entityId: user.employeeId,
      summary: `Document (${type}) uploaded for ${employee.name}`,
      metadata: { documentType: type },
      req,
    }).catch(() => {});

    return NextResponse.json({ document: doc });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
