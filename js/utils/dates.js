import { getLang } from './labels.js';

const esParts = new Intl.DateTimeFormat('es-ES', {
  year: 'numeric',
  month: 'long',
  day: '2-digit',
});

const enLong = new Intl.DateTimeFormat('en-US', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
});

/** YYYY-MM-DD calendar date (no timezone) → local Date at noon. */
function parseCalendarDate(value) {
  const match = String(value || '')
    .trim()
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  // Noon local avoids DST edge cases flipping the calendar day.
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}

/**
 * Format a date for UI chrome by app language.
 * - es → 2026-agosto-02
 * - en → August 2, 2026
 *
 * Plain YYYY-MM-DD values are treated as calendar dates (no UTC shift).
 */
export function formatDate(value) {
  if (!value) return '—';

  let date;
  if (value instanceof Date) {
    date = value;
  } else {
    const raw = String(value).trim();
    date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
      ? parseCalendarDate(raw)
      : new Date(value);
  }

  if (!date || Number.isNaN(date.getTime())) return '—';

  if (getLang() === 'es') {
    const parts = Object.fromEntries(
      esParts
        .formatToParts(date)
        .filter((part) => part.type !== 'literal')
        .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  return enLong.format(date);
}

/**
 * Full years from a YYYY-MM-DD birth date, or null if invalid / out of range.
 * @returns {number | null}
 */
export function ageFromBirthDate(birthDate) {
  const date = parseCalendarDate(String(birthDate || '').slice(0, 10));
  if (!date) return null;
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }
  return age >= 0 && age < 130 ? age : null;
}
