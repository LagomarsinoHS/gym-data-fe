/**
 * Mobile hamburger drawer for .sidebar.
 * Desktop: no-op (sidebar always visible).
 */
const MQ = '(max-width: 768px)';
const CLOSE_MS = 420;

let toggleBtn;
let closeBtn;
let backdrop;
let sidebar;
let closeTimer = 0;

function isMobile() {
  return window.matchMedia(MQ).matches;
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function openNavDrawer() {
  if (!isMobile()) return;
  window.clearTimeout(closeTimer);
  if (backdrop) {
    backdrop.hidden = false;
    // Force reflow so opacity transition runs from 0 → 1
    void backdrop.offsetWidth;
  }
  document.body.classList.add('nav-drawer-open');
  toggleBtn?.setAttribute('aria-expanded', 'true');
  toggleBtn?.setAttribute('aria-label', 'Cerrar menú');
}

export function closeNavDrawer() {
  if (!document.body.classList.contains('nav-drawer-open')) return;

  document.body.classList.remove('nav-drawer-open');
  toggleBtn?.setAttribute('aria-expanded', 'false');
  toggleBtn?.setAttribute('aria-label', 'Abrir menú');

  window.clearTimeout(closeTimer);
  const delay = prefersReducedMotion() ? 0 : CLOSE_MS;
  closeTimer = window.setTimeout(() => {
    if (backdrop && !document.body.classList.contains('nav-drawer-open')) {
      backdrop.hidden = true;
    }
  }, delay);
}

export function initNavDrawer() {
  toggleBtn = document.getElementById('nav-drawer-toggle');
  closeBtn = document.getElementById('nav-drawer-close');
  backdrop = document.getElementById('nav-drawer-backdrop');
  sidebar = document.getElementById('app-sidebar');
  if (!toggleBtn || !sidebar) return;

  toggleBtn.addEventListener('click', () => {
    if (document.body.classList.contains('nav-drawer-open')) closeNavDrawer();
    else openNavDrawer();
  });

  closeBtn?.addEventListener('click', closeNavDrawer);
  backdrop?.addEventListener('click', closeNavDrawer);

  sidebar.querySelectorAll('[data-view]').forEach(btn => {
    btn.addEventListener('click', () => closeNavDrawer());
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('nav-drawer-open')) {
      closeNavDrawer();
    }
  });

  window.matchMedia(MQ).addEventListener('change', e => {
    if (!e.matches) {
      window.clearTimeout(closeTimer);
      document.body.classList.remove('nav-drawer-open');
      toggleBtn?.setAttribute('aria-expanded', 'false');
      if (backdrop) backdrop.hidden = true;
    }
  });
}
