import { UI_LABELS, VALUE_LABELS_ES } from '../constants.js';

let currentLang = 'es';

export function setLang(lang) {
  currentLang = lang;
}

/** UI chrome text (buttons, titles, placeholders) */
export function ui(key, ...args) {
  const entry = UI_LABELS[currentLang][key];
  return typeof entry === 'function' ? entry(...args) : entry;
}

/** Translate a data value (category, equipment, muscle, …) */
export function label(value) {
  if (!value) return '';
  if (currentLang === 'es') return VALUE_LABELS_ES[value] ?? value;
  return value;
}
