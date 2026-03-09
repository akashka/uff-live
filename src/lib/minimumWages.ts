/**
 * Minimum wages per day (₹) for accountancy compliance.
 */
export function getMinimumWages(): number {
  const val = process.env.MINIMUM_WAGES;
  const n = val ? parseFloat(val) : NaN;
  return Number.isFinite(n) && n > 0 ? n : 500; // default 500
}

/**
 * Compute virtual days attended for full-time salary payment (accountancy compliance).
 * - If per-day salary (paymentAmount / daysWorked) >= minimum wages: return actual daysWorked (no change).
 * - If per-day salary < minimum wages: return paymentAmount / minimumWages (equivalent days at min wage).
 */
export function computeVirtualDaysAttended(
  paymentAmount: number,
  daysWorked: number
): number | null {
  const minWages = getMinimumWages();
  if (minWages <= 0 || paymentAmount <= 0) return null;
  if (daysWorked <= 0) return null;
  const perDaySalary = paymentAmount / daysWorked;
  if (perDaySalary >= minWages) {
    return daysWorked; // Already compliant; show actual days
  }
  const v = paymentAmount / minWages;
  return Number.isFinite(v) ? Math.round(v) : null;
}
