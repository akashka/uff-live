import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Employee from '@/lib/models/Employee';
import Vendor from '@/lib/models/Vendor';
import StyleOrder from '@/lib/models/StyleOrder';
import Branch from '@/lib/models/Branch';

// ── helpers ────────────────────────────────────────────────────────────────────

function ok(message: string, actionUrl: string) {
  return NextResponse.json({ status: 'COMPLETE', message, actionUrl, state: null });
}
function ask(message: string, state: object) {
  return NextResponse.json({ status: 'INCOMPLETE', message, state });
}
function ambiguous(message: string, options: any[], state: object) {
  return NextResponse.json({ status: 'AMBIGUOUS', message, options, state });
}

/** Resolve an employee or vendor name from the message. Returns null if 0 matches, array if ambiguous. */
async function resolvePersonFromMsg(lowerMsg: string) {
  const employees = await Employee.find({ isActive: true }).lean();
  const vendors = await Vendor.find({ isActive: true }).lean();
  const matches: { id: string; name: string; type: string; empType: string }[] = [];
  for (const e of employees as any[]) {
    if (lowerMsg.includes(e.name.toLowerCase())) {
      matches.push({ id: e._id.toString(), name: e.name, type: 'employee', empType: e.employeeType });
    }
  }
  for (const v of vendors as any[]) {
    if (lowerMsg.includes(v.name.toLowerCase())) {
      matches.push({ id: v._id.toString(), name: v.name, type: 'vendor', empType: 'vendor' });
    }
  }
  return matches;
}

/** Extract YYYY-MM month from natural language. */
function extractMonth(lowerMsg: string): string | null {
  const monthMatch = lowerMsg.match(/(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})/i);
  if (monthMatch) {
    const m = new Date(`${monthMatch[1]} 1, ${monthMatch[2]}`).getMonth() + 1;
    return `${monthMatch[2]}-${String(m).padStart(2, '0')}`;
  }
  if (lowerMsg.includes('last month')) {
    const d = new Date(); d.setMonth(d.getMonth() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (lowerMsg.includes('this month') || lowerMsg.includes('current month')) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  return null;
}

// ── main handler ───────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const { message, state } = await req.json();
    await connectDB();

    const lowerMsg = (message || '').toLowerCase();
    let intent: string | null = state?.intent ?? null;
    const entities: any = state?.entities ?? {};

    // ── 1. DETECT INTENT ──────────────────────────────────────────────────────
    if (!intent) {

      // EMPLOYEE intents (must check before generic branch/list checks)
      if (lowerMsg.match(/create\s*employee|add\s*employee|new\s*employee|register\s*employee/)) {
        intent = 'CREATE_EMPLOYEE';
      } else if (lowerMsg.match(/edit\s*employee|update\s*employee|modify\s*employee|change\s*.*employee/)) {
        intent = 'EDIT_EMPLOYEE';
      } else if (lowerMsg.match(/view\s*employee|show\s*employee|open\s*employee|see\s*employee|employee\s*detail/)) {
        intent = 'VIEW_EMPLOYEE';
      } else if (lowerMsg.match(/make\s*.*employee.*inactive|inactivate\s*employee|deactivate\s*employee|disable\s*employee|inactive.*employee/)) {
        intent = 'TOGGLE_EMPLOYEE';
        entities.makeActive = false;
      } else if (lowerMsg.match(/make\s*.*employee.*active|activate\s*employee|enable\s*employee|reactivate\s*employee/)) {
        intent = 'TOGGLE_EMPLOYEE';
        entities.makeActive = true;
      } else if (lowerMsg.match(/list\s*employees|all\s*employees|show\s*employees|view\s*employees|employees/)) {
        return ok('Opening employees list...', '/employees');

      // PASSBOOK
      } else if (lowerMsg.match(/pass\s*book|pass-book|passbook/)) {
        intent = 'VIEW_PASSBOOK';

      // WORK ORDER
      } else if (lowerMsg.match(/work\s*order|create\s*work/)) {
        intent = 'CREATE_WORK_ORDER';

      // PAYMENT
      } else if (lowerMsg.match(/payment|pay\s*vendor|pay\s*employee/)) {
        intent = 'CREATE_PAYMENT';

      // BRANCH intents
      } else if (lowerMsg.match(/create\s*branch|add\s*branch|new\s*branch/)) {
        intent = 'CREATE_BRANCH';
      } else if (lowerMsg.match(/inactive\s*branch|deactivate\s*branch|disable\s*branch|make\s*.*branch.*inactive|inactivate\s*branch/)) {
        intent = 'TOGGLE_BRANCH';
        entities.makeActive = false;
        return handleBranchToggle(lowerMsg, { intent, entities });
      } else if (lowerMsg.match(/activate\s*branch|enable\s*branch|make\s*.*branch.*active/)) {
        intent = 'TOGGLE_BRANCH';
        entities.makeActive = true;
        return handleBranchToggle(lowerMsg, { intent, entities });
      } else if (lowerMsg.match(/view\s*branch|show\s*branch|list\s*branch|open\s*branch|see\s*branch|branch(es)?/)) {
        return ok('Opening branches...', '/branches');

      } else if (lowerMsg.match(/hi|hello|hey|help/)) {
        return ask(
          'Hi! I can help you:\n• Employees — view list, view/edit profile, create, activate/inactivate\n• Branches — view, create, activate/inactivate\n• Work orders — create\n• Payments — record\n• Passbook — view by month\n\nWhat would you like to do?',
          { intent: null, entities: {} }
        );
      } else {
        return ask(
          'I didn\'t understand that. Try:\n• "Show employees"\n• "Edit employee Ravi"\n• "Create a branch"\n• "Work order for Priya"\n• "Show passbook for March 2026"',
          { intent: null, entities: {} }
        );
      }
    }

    // ── 2. BRANCH INTENTS ─────────────────────────────────────────────────────
    if (intent === 'CREATE_BRANCH') return handleCreateBranch(message, { intent, entities, lastAsked: state?.lastAsked });
    if (intent === 'TOGGLE_BRANCH') return handleBranchToggle(lowerMsg, { intent, entities });

    // ── 3. EMPLOYEE INTENTS ───────────────────────────────────────────────────
    if (intent === 'CREATE_EMPLOYEE') {
      return ok('Opening employee creation form...', '/employees?action=create');
    }

    if (intent === 'VIEW_EMPLOYEE' || intent === 'EDIT_EMPLOYEE') {
      // Resolve employee
      if (!entities.employeeId) {
        const matches = await resolvePersonFromMsg(lowerMsg);
        const empMatches = matches.filter(m => m.type === 'employee');
        if (empMatches.length === 0) {
          return ask('Which employee would you like to ' + (intent === 'EDIT_EMPLOYEE' ? 'edit' : 'view') + '? (Enter name)', { intent, entities });
        }
        if (empMatches.length > 1) {
          return ambiguous('I found multiple employees. Which one?',
            empMatches.map(m => ({ id: m.id, name: m.name, type: 'employee', empType: m.empType })),
            { intent, entities }
          );
        }
        entities.employeeId = empMatches[0].id;
        entities.employeeName = empMatches[0].name;
      }
      const url = intent === 'EDIT_EMPLOYEE'
        ? `/employees?edit=${entities.employeeId}`
        : `/employees?view=${entities.employeeId}`;
      return ok(`Opening ${entities.employeeName}'s profile...`, url);
    }

    if (intent === 'TOGGLE_EMPLOYEE') {
      if (!entities.employeeId) {
        const matches = await resolvePersonFromMsg(lowerMsg);
        const empMatches = matches.filter(m => m.type === 'employee');
        if (empMatches.length === 0) {
          return ask('Which employee would you like to change status for? (Enter name)', { intent, entities });
        }
        if (empMatches.length > 1) {
          return ambiguous('I found multiple employees. Which one?',
            empMatches.map(m => ({ id: m.id, name: m.name, type: 'employee', empType: m.empType })),
            { intent, entities }
          );
        }
        entities.employeeId = empMatches[0].id;
        entities.employeeName = empMatches[0].name;
      }
      const emp = await Employee.findById(entities.employeeId);
      if (!emp) return ask('Employee not found.', { intent: null, entities: {} });
      const newStatus = entities.makeActive !== undefined ? entities.makeActive : !emp.isActive;
      emp.isActive = newStatus;
      await emp.save();
      return ok(
        `${entities.employeeName} is now ${newStatus ? 'active ✓' : 'inactive ✗'}. Opening employees list...`,
        '/employees'
      );
    }

    // ── 4. RESOLVE EMPLOYEE/VENDOR (shared) ───────────────────────────────────
    if (!entities.employeeId && !entities.vendorId) {
      const matches = await resolvePersonFromMsg(lowerMsg);
      if (matches.length === 1) {
        if (matches[0].type === 'employee') {
          entities.employeeId = matches[0].id;
          entities.employeeName = matches[0].name;
          entities.type = matches[0].empType;
        } else {
          entities.vendorId = matches[0].id;
          entities.vendorName = matches[0].name;
          entities.type = 'vendor';
        }
      } else if (matches.length > 1) {
        return ambiguous('I found multiple people. Which one?',
          matches.map(m => ({ id: m.id, name: m.name, type: m.type, empType: m.empType })),
          { intent, entities }
        );
      }
    }

    // ── 5. EXTRACT MONTH ──────────────────────────────────────────────────────
    if (!entities.month) {
      const m = extractMonth(lowerMsg);
      if (m) entities.month = m;
    }

    // ── 6. EXTRACT STYLE CODE ─────────────────────────────────────────────────
    if (intent === 'CREATE_WORK_ORDER' && !entities.styleCode) {
      const foundStyles = await StyleOrder.find({ isActive: true }).lean();
      for (const s of foundStyles as any[]) {
        if (lowerMsg.includes(s.styleCode.toLowerCase())) {
          entities.styleCode = s.styleCode;
          break;
        }
      }
    }

    // ── 7. PASSBOOK ───────────────────────────────────────────────────────────
    if (intent === 'VIEW_PASSBOOK') {
      if (!entities.employeeId) return ask('Whose passbook? (Enter employee name)', { intent, entities });
      if (!entities.month) return ask('Which month? (e.g., March 2026)', { intent, entities });
      return ok('Opening passbook...', `/employees/${entities.employeeId}/passbook?month=${entities.month}`);
    }

    // ── 8. WORK ORDER ─────────────────────────────────────────────────────────
    if (intent === 'CREATE_WORK_ORDER') {
      if (!entities.employeeId && !entities.vendorId) return ask('Who is this work order for? (Enter employee or vendor name)', { intent, entities });
      let params = `action=create_work_order&type=${entities.type}`;
      if (entities.employeeId) params += `&employeeId=${entities.employeeId}&employeeName=${encodeURIComponent(entities.employeeName)}`;
      if (entities.vendorId) params += `&vendorId=${entities.vendorId}&vendorName=${encodeURIComponent(entities.vendorName)}`;
      if (entities.month) params += `&month=${entities.month}`;
      if (entities.styleCode) params += `&styleCode=${encodeURIComponent(entities.styleCode)}`;
      return ok('Opening work order form...', `/work-orders?${params}`);
    }

    // ── 9. PAYMENT ────────────────────────────────────────────────────────────
    if (intent === 'CREATE_PAYMENT') {
      if (!entities.employeeId && !entities.vendorId) return ask('Who is this payment for? (Enter employee or vendor name)', { intent, entities });
      let params = `action=create_payment&type=${entities.type}`;
      if (entities.employeeId) params += `&employeeId=${entities.employeeId}&employeeName=${encodeURIComponent(entities.employeeName)}`;
      if (entities.vendorId) params += `&vendorId=${entities.vendorId}&vendorName=${encodeURIComponent(entities.vendorName)}`;
      return ok('Opening payment form...', `/payments?${params}`);
    }

    return ask('I didn\'t fully understand. Please try again.', { intent: null, entities: {} });

  } catch (error) {
    console.error('Quick Action error:', error);
    return NextResponse.json({ status: 'ERROR', message: 'Something went wrong.' }, { status: 500 });
  }
}

// ── BRANCH HELPERS ────────────────────────────────────────────────────────────

async function handleCreateBranch(message: string, { intent, entities, lastAsked }: { intent: string; entities: any; lastAsked?: string }) {
  if (!entities.name) {
    if (lastAsked === 'name') { entities.name = message.trim(); }
    else return ask('What is the branch name?', { intent, entities, lastAsked: 'name' });
  }
  if (!entities.address) {
    if (lastAsked === 'address') { entities.address = message.trim(); }
    else return ask(`Got it — "${entities.name}". What is the branch address?`, { intent, entities, lastAsked: 'address' });
  }
  if (!entities.phoneNumber) {
    if (lastAsked === 'phoneNumber') { entities.phoneNumber = message.trim(); }
    else return ask('What is the phone number for this branch?', { intent, entities, lastAsked: 'phoneNumber' });
  }
  try {
    const existing = await Branch.findOne({ name: new RegExp(`^${entities.name}$`, 'i') });
    if (existing) {
      return ask(`A branch named "${entities.name}" already exists. Please provide a different name.`, { intent, entities: { ...entities, name: undefined }, lastAsked: 'name' });
    }
    const branch = await Branch.create({ name: entities.name, address: entities.address, phoneNumber: entities.phoneNumber, email: entities.email || '' });
    return NextResponse.json({ status: 'COMPLETE', message: `Branch "${branch.name}" created! Opening branches...`, actionUrl: '/branches', state: null });
  } catch (err: any) {
    return NextResponse.json({ status: 'ERROR', message: `Failed to create branch: ${err?.message}`, state: null });
  }
}

async function handleBranchToggle(lowerMsg: string, { intent, entities }: { intent: string; entities: any }) {
  if (!entities.branchId) {
    const branches = await Branch.find({}).lean();
    const matches = (branches as any[]).filter(b => lowerMsg.includes(b.name.toLowerCase()));
    if (matches.length === 0) return ask('Which branch would you like to change the status of?', { intent, entities, lastAsked: 'branchName' });
    if (matches.length > 1) {
      return NextResponse.json({
        status: 'AMBIGUOUS',
        message: 'I found multiple branches. Which one?',
        options: matches.map(b => ({ id: b._id.toString(), name: b.name, type: 'branch', empType: b.isActive ? 'Active' : 'Inactive' })),
        state: { intent, entities }
      });
    }
    entities.branchId = matches[0]._id.toString();
    entities.branchName = matches[0].name;
  }
  const branch = await Branch.findById(entities.branchId);
  if (!branch) return NextResponse.json({ status: 'ERROR', message: 'Branch not found.', state: null });
  const newStatus = entities.makeActive !== undefined ? entities.makeActive : !branch.isActive;
  branch.isActive = newStatus;
  await branch.save();
  return NextResponse.json({ status: 'COMPLETE', message: `Branch "${branch.name}" is now ${newStatus ? 'active ✓' : 'inactive ✗'}. Opening branches...`, actionUrl: '/branches', state: null });
}
