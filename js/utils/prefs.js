/**
 * UI preferences in localStorage (tema + idioma).
 * Auth token stays in api/token.js.
 * theme-boot.js mirrors THEME_KEY on purpose (sync head, no modules / no FOUC).
 */

export const THEME_KEY = 'steelPulse.theme';
export const LANG_KEY = 'steelPulse.lang';

function read(key) {
  try {
    return localStorage.getItem(key);
  } catch (_) {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (_) { /* private mode / quota */ }
}

/** @returns {'light'|'dark'} */
export function getStoredTheme() {
  const theme = read(THEME_KEY);
  return theme === 'dark' || theme === 'light' ? theme : 'light';
}

/** @param {'light'|'dark'} theme */
export function setStoredTheme(theme) {
  if (theme === 'dark' || theme === 'light') write(THEME_KEY, theme);
}

/** @returns {'es'|'en'} */
export function getStoredLang() {
  const lang = read(LANG_KEY);
  return lang === 'en' || lang === 'es' ? lang : 'es';
}

/** @param {'es'|'en'} lang */
export function setStoredLang(lang) {
  if (lang === 'en' || lang === 'es') write(LANG_KEY, lang);
}
