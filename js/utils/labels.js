import { UI_LABELS, VALUE_LABELS_ES } from '../i18n/index.js';

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
  if (currentLang === 'es') return VALUE_LABELS_ES[value] ?? titleCase(value);
  return titleCase(value);
}

/** "upper legs" / "vertical_pull" → "Upper Legs" / "Vertical Pull" */
export function titleCase(value) {
  return String(value)
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, ch => ch.toUpperCase());
}

/** Resolve bilingual fields like { en, es }, or a plain string. */
export function localized(value, lang = currentLang) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  return value[lang] || value.en || value.es || '';
}

export function exerciseName(ex, lang = currentLang) {
  return localized(ex.name, lang);
}
