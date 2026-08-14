/** YYYY-MM helpers aligned with BE year-month rules. */

const YEAR_MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/;

/** Current calendar month in UTC as `YYYY-MM`. */
export function currentYearMonthUtc(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/** True if value is a valid `YYYY-MM` and not after the current UTC month. */
export function isValidYearMonth(value, { allowFuture = false } = {}) {
  const raw = String(value || '').trim();
  if (!YEAR_MONTH_RE.test(raw)) return false;
  if (!allowFuture && raw > currentYearMonthUtc()) return false;
  return true;
}

/**
 * Normalize to a valid non-future `YYYY-MM`, or `fallback` (default: current).
 */
export function normalizeYearMonth(value, fallback = currentYearMonthUtc()) {
  const raw = String(value || '').trim();
  return isValidYearMonth(raw) ? raw : fallback;
}

export function parseYearMonth(value) {
  const match = String(value || '').trim().match(YEAR_MONTH_RE);
  if (!match) return null;
  return { year: Number(match[1]), month: Number(match[2]) };
}
