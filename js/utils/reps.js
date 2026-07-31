/** Digits + at most one hyphen; max 2 digits each side (`12` or `12-15`). */
export function cleanReps(raw) {
  const s = String(raw).replace(/[^\d-]/g, '');
  const i = s.indexOf('-');
  if (i === -1) return s.slice(0, 2);
  return `${s.slice(0, i).slice(0, 2)}-${s.slice(i + 1).replace(/-/g, '').slice(0, 2)}`;
}

/** Draft → API value: `6` | `8 - 12` | null if incomplete. */
export function formatReps(raw) {
  const v = cleanReps(raw);
  if (/^\d{1,2}$/.test(v)) return String(Number(v));
  if (/^\d{1,2}-\d{1,2}$/.test(v)) {
    const [a, b] = v.split('-');
    return `${Number(a)} - ${Number(b)}`;
  }
  return null;
}
