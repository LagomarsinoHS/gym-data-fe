import { getStoredTheme, setStoredTheme } from '../utils/prefs.js';

const THEME_ANIM_MS = 280;

function syncToggleUi(theme) {
  const emoji = document.getElementById('theme-toggle-emoji');
  const btn = document.getElementById('theme-toggle-btn');
  if (emoji) emoji.textContent = theme === 'dark' ? '🌙' : '☀️';
  if (btn) {
    btn.dataset.theme = theme;
    btn.setAttribute('aria-label', theme === 'dark' ? 'Tema oscuro' : 'Tema claro');
  }
}

function runThemeTransition() {
  const root = document.documentElement;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  root.classList.add('theme-animating');
  window.clearTimeout(runThemeTransition._timer);
  runThemeTransition._timer = window.setTimeout(() => {
    root.classList.remove('theme-animating');
  }, THEME_ANIM_MS);
}

/** @param {'light'|'dark'} theme @param {{ animate?: boolean }} [opts] */
export function applyTheme(theme, opts = {}) {
  const next = theme === 'dark' ? 'dark' : 'light';
  if (opts.animate) runThemeTransition();
  document.documentElement.setAttribute('data-theme', next);
  setStoredTheme(next);
  syncToggleUi(next);
  return next;
}

export function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export function toggleTheme() {
  return applyTheme(getTheme() === 'dark' ? 'light' : 'dark', { animate: true });
}

/** Restaura tema guardado y cablea el botón ☀️/🌙. */
export function initThemeUi() {
  applyTheme(getStoredTheme());
  document.getElementById('theme-toggle-btn')?.addEventListener('click', () => {
    toggleTheme();
  });
}
