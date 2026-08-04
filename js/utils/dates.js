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

/**
 * Format a date for UI chrome by app language.
 * - es → 2026-agosto-02
 * - en → August 2, 2026
 */
export function formatDate(value) {
  if (!value) return '—';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

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
