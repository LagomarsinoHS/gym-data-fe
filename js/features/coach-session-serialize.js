/**
 * Pure helpers for coach training-program / template serialization.
 */
import { sortByOrder } from '../utils/helpers.js';
import { ui } from '../utils/labels.js';
import { getAthleteSessions } from './coach-athletes-store.js';

/** PUT body shape: sessions + items with exerciseId only (no populated exercise). */
export function serializeCoachTrainingProgram(athlete) {
  return getAthleteSessions(athlete).map((session, index) => ({
    id: String(session.id),
    name: String(session.name || '').trim(),
    order: session.order ?? index,
    items: (session.items || []).map((item, itemIndex) => {
      const payload = {
        exerciseId: String(item.exercise?.id || item.exerciseId || ''),
        order: item.order ?? itemIndex,
      };
      if (item.sets != null) payload.sets = item.sets;
      if (item.reps) payload.reps = String(item.reps);
      if (item.rest != null) payload.rest = item.rest;
      if (item.notes != null && String(item.notes).trim() !== '') {
        payload.notes = String(item.notes).trim();
      }
      return payload;
    }),
  }));
}

export function newLocalSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Sum of items[].sets (missing / invalid → 0). Derived — not stored in API. */
export function totalSessionSets(items) {
  return (items || []).reduce((sum, item) => {
    const n = Number(item?.sets);
    return sum + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  }, 0);
}

export function sessionAccordionMeta(items) {
  const list = Array.isArray(items) ? items : [];
  const parts = [ui('sessionExercisesCount', list.length)];
  if (list.length) parts.push(ui('sessionSetsCount', totalSessionSets(list)));
  return parts.join(' · ');
}
