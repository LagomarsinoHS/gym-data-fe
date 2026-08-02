/**
 * Shared prescription (sets / reps / rest / notes) helpers for plan cards.
 * Kept out of training-ui / coach-sessions-ui to avoid circular imports via session-ui.
 */
import { ui } from './labels.js';

export function prescriptionLines(item) {
  const lines = [];
  if (item?.sets != null) {
    lines.push({ ico: '🏋️', text: `${item.sets} ${ui('prescriptionSets')}` });
  }
  if (item?.reps) {
    lines.push({ ico: '🔁', text: `${item.reps} ${ui('prescriptionReps')}` });
  }
  if (item?.rest != null) {
    lines.push({ ico: '⏱️', text: `${item.rest}s` });
  }
  return lines;
}

export function prescriptionNote(item) {
  return String(item?.notes || '').trim();
}
