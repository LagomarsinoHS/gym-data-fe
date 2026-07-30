import { UI_LABELS, VALUE_LABELS_ES } from '../constants.js';

let currentLang = 'es';

export function setLang(lang) {
  currentLang = lang === 'en' ? 'en' : 'es';
}

export function getLang() {
  return currentLang;
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

/** Resolve bilingual fields like { en, es }. */
export function localized(value, lang = currentLang) {
  if (!value) return '';
  return value[lang] || value.en || value.es || '';
}

export function exerciseName(ex, lang = currentLang) {
  return localized(ex.name, lang);
}
