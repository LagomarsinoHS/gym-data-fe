/**
 * Session shell: guest vs logged-in sidebar, catalog | training | recommend views.
 * Markup: #sidebar-guest, #sidebar-auth, #catalog-view, #training-view, #recommend-view
 * Training grid rendering is driven by main.js (filters live there).
 */
import { getMe } from '../api/users.js';
import { clearToken, isLoggedIn } from '../api/token.js';
import { ui } from '../utils/labels.js';

const VIEWS = new Set(['catalog', 'training', 'recommend']);

let view = 'catalog'; // 'catalog' | 'training' | 'recommend'
let user = null;
let onViewChange = () => {};

/**
 * Acceso a “Recomendar Entrenamiento”.
 * Gate: user.isPremium (GET /users/me).
 */
export function canAccessRecommendPlan(u = user) {
  if (!u) return false;
  return u.isPremium === true;
}

export function initSessionUi({ onViewChange: cb } = {}) {
  if (cb) onViewChange = cb;

  document.getElementById('nav-training')?.addEventListener('click', () => setView('training'));
  document.getElementById('nav-recommend')?.addEventListener('click', () => {
    if (!canAccessRecommendPlan()) return;
    setView('recommend');
  });
  document.getElementById('nav-catalog')?.addEventListener('click', () => setView('catalog'));
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  syncSessionLabels();
  renderSessionChrome();
}

export async function restoreSession() {
  if (!isLoggedIn()) {
    user = null;
    renderSessionChrome();
    return null;
  }

  try {
    user = await getMe();
    renderSessionChrome();
    return user;
  } catch (err) {
    console.error(err);
    clearToken();
    user = null;
    renderSessionChrome();
    return null;
  }
}

export function getUser() {
  return user;
}

/** Replace in-memory user (e.g. after program update). */
export function setUser(next) {
  user = next;
  renderSessionChrome();
  return user;
}

/** Refetch GET /users/me into session. */
export async function refreshUser() {
  if (!isLoggedIn()) {
    user = null;
    renderSessionChrome();
    return null;
  }
  user = await getMe();
  renderSessionChrome();
  return user;
}

/** Exercise ids currently in the user's trainingProgram. */
export function getProgramExerciseIds(u = user) {
  return (u?.trainingProgram || [])
    .map(item => String(item.exercise?.id || item.exerciseId || ''))
    .filter(Boolean);
}

export function getView() {
  return view;
}

export function setView(next) {
  if (!VIEWS.has(next)) return;
  if (next === 'recommend' && !canAccessRecommendPlan()) return;
  view = next;
  renderSessionChrome();
  onViewChange(view);
}

export function logout() {
  clearToken();
  user = null;
  view = 'catalog';
  renderSessionChrome();
  onViewChange(view);
}

export function syncSessionLabels() {
  document.querySelectorAll('#sidebar-guest [data-ui], #sidebar-auth [data-ui], #recommend-view [data-ui]')
    .forEach(el => {
      el.textContent = ui(el.dataset.ui);
    });

  const myPlanBtn = document.getElementById('my-plan-btn');
  if (myPlanBtn) myPlanBtn.title = ui('myPlan');

  renderUserName();
  syncNavActive();
  syncRecommendAccess();
}

function renderUserName() {
  const nameEl = document.getElementById('sidebar-user-name');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  if (!user) return;

  const first = String(user.firstName || '').trim();
  const last = String(user.lastName || '').trim();
  const full = [first, last].filter(Boolean).join(' ');

  if (nameEl) {
    nameEl.textContent = full;
    nameEl.title = full;
  }

  if (avatarEl) {
    const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || '?';
    avatarEl.textContent = initials;
  }
}

function syncRecommendAccess() {
  const btn = document.getElementById('nav-recommend');
  if (!btn) return;

  const allowed = canAccessRecommendPlan();
  btn.disabled = !allowed;
  btn.classList.toggle('is-locked', !allowed);
  btn.title = allowed ? '' : ui('recommendPlanLocked');
}

function syncNavActive() {
  const training = document.getElementById('nav-training');
  const recommend = document.getElementById('nav-recommend');
  const catalog = document.getElementById('nav-catalog');

  const onTraining = view === 'training';
  const onRecommend = view === 'recommend';
  const onCatalog = view === 'catalog';

  training?.classList.toggle('is-active', onTraining);
  recommend?.classList.toggle('is-active', onRecommend);
  catalog?.classList.toggle('is-active', onCatalog);

  if (onTraining) training?.setAttribute('aria-current', 'page');
  else training?.removeAttribute('aria-current');

  if (onRecommend) recommend?.setAttribute('aria-current', 'page');
  else recommend?.removeAttribute('aria-current');

  if (onCatalog) catalog?.setAttribute('aria-current', 'page');
  else catalog?.removeAttribute('aria-current');
}

function renderSessionChrome() {
  const guest = document.getElementById('sidebar-guest');
  const auth = document.getElementById('sidebar-auth');
  const catalogView = document.getElementById('catalog-view');
  const trainingView = document.getElementById('training-view');
  const recommendView = document.getElementById('recommend-view');
  const catalogBar = document.getElementById('catalog-bar-extras');
  const catalogFilters = document.getElementById('sidebar-catalog-filters');
  const wodBtn = document.getElementById('wod-btn');
  const searchEl = document.getElementById('search');
  const searchWrap = searchEl?.closest('.results-search');
  const loggedIn = Boolean(user);

  if (guest) guest.hidden = loggedIn;
  if (auth) auth.hidden = !loggedIn;

  if (view === 'recommend' && !canAccessRecommendPlan()) {
    view = 'catalog';
  }

  const showTraining = loggedIn && view === 'training';
  const showRecommend = loggedIn && view === 'recommend';
  const hideCatalogChrome = showTraining || showRecommend;

  if (catalogView) catalogView.hidden = showTraining || showRecommend;
  if (trainingView) trainingView.hidden = !showTraining;
  if (recommendView) recommendView.hidden = !showRecommend;
  if (catalogBar) catalogBar.hidden = hideCatalogChrome;
  if (wodBtn) wodBtn.hidden = hideCatalogChrome;
  if (catalogFilters) catalogFilters.hidden = hideCatalogChrome;
  if (searchWrap) searchWrap.hidden = showRecommend;

  if (searchEl) {
    searchEl.placeholder = showTraining ? ui('searchTraining') : ui('search');
  }

  renderUserName();
  syncNavActive();
  syncRecommendAccess();
}
