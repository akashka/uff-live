import type { JWTPayload } from '@/lib/auth';
import Employee from '@/lib/models/Employee';

export interface BranchScope {
  isRestricted: boolean;
  allowedBranchIds: string[];
}

function normalizeBranchIds(branches: unknown[] | undefined): string[] {
  if (!Array.isArray(branches)) return [];
  return branches
    .map((branch) => {
      if (branch && typeof branch === 'object' && '_id' in (branch as Record<string, unknown>)) {
        return String((branch as { _id: unknown })._id);
      }
      return String(branch);
    })
    .filter((id) => id && id !== 'undefined' && id !== 'null');
}

export async function getUserBranchScope(user: JWTPayload): Promise<BranchScope> {
  if (user.role === 'admin') {
    return { isRestricted: false, allowedBranchIds: [] };
  }

  if (!user.employeeId) {
    return { isRestricted: true, allowedBranchIds: [] };
  }

  const employee = await Employee.findById(user.employeeId).select('branches').lean();
  const allowedBranchIds = normalizeBranchIds((employee as { branches?: unknown[] } | null)?.branches);
  return { isRestricted: true, allowedBranchIds };
}

export function canAccessBranch(scope: BranchScope, branchId?: string | null): boolean {
  if (!branchId) return true;
  if (!scope.isRestricted) return true;
  return scope.allowedBranchIds.includes(String(branchId));
}

export function areBranchesAllowed(scope: BranchScope, branchIds: string[]): boolean {
  if (!scope.isRestricted) return true;
  return branchIds.every((id) => scope.allowedBranchIds.includes(String(id)));
}

export function applySingleBranchScope(
  filter: Record<string, unknown>,
  field: string,
  scope: BranchScope,
  selectedBranchId?: string | null
): { filter: Record<string, unknown>; forbidden: boolean } {
  if (!scope.isRestricted) {
    if (selectedBranchId) filter[field] = selectedBranchId;
    return { filter, forbidden: false };
  }

  if (selectedBranchId) {
    if (!scope.allowedBranchIds.includes(String(selectedBranchId))) {
      return { filter, forbidden: true };
    }
    filter[field] = selectedBranchId;
    return { filter, forbidden: false };
  }

  filter[field] = { $in: scope.allowedBranchIds };
  return { filter, forbidden: false };
}

export function applyMultiBranchScope(
  filter: Record<string, unknown>,
  field: string,
  scope: BranchScope,
  selectedBranchId?: string | null
): { filter: Record<string, unknown>; forbidden: boolean } {
  if (!scope.isRestricted) {
    if (selectedBranchId) filter[field] = selectedBranchId;
    return { filter, forbidden: false };
  }

  if (selectedBranchId) {
    if (!scope.allowedBranchIds.includes(String(selectedBranchId))) {
      return { filter, forbidden: true };
    }
    filter[field] = selectedBranchId;
    return { filter, forbidden: false };
  }

  filter[field] = { $in: scope.allowedBranchIds };
  return { filter, forbidden: false };
}
