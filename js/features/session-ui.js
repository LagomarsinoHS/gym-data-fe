/**
 * Session shell: guest vs logged-in sidebar; role-based nav (athlete | coach).
 * Markup: #sidebar-guest, #sidebar-auth, #nav-athlete, #nav-coach,
 * views: catalog | training | recommend | coach-plan | students
 * Training grid rendering is driven by main.js (filters live there).
 */
import { getMe } from '../api/users.js';
import { clearToken, isLoggedIn } from '../api/token.js';
import { ui } from '../utils/labels.js';
import { clearRecommendPlan } from './recommend-ui.js';

const VIEWS = new Set(['catalog', 'training', 'recommend', 'coach-plan', 'students']);
const ATHLETE_VIEWS = new Set(['training', 'recommend', 'coach-plan']);
const COACH_VIEWS = new Set(['students']);

let view = 'catalog'; // 'catalog' | 'training' | 'recommend' | 'coach-plan' | 'students'
let user = null;
let onViewChange = () => {};

export function isCoach(u = user) {
  if (!u) return false;
  return u.role === 'coach' || u.role === 'admin';
}

export function isAthlete(u = user) {
  if (!u) return false;
  return !isCoach(u);
}

export function hasCoach(u = user) {
  return Boolean(u?.coachId);
}

/**
 * Acceso a “Recomendar Entrenamiento”.
 * Gate: athlete + user.isPremium (GET /users/me).
 */
export function canAccessRecommendPlan(u = user) {
  if (!u || !isAthlete(u)) return false;
  return u.isPremium === true;
}

export function initSessionUi({ onViewChange: cb } = {}) {
  if (cb) onViewChange = cb;

  document.getElementById('nav-training')?.addEventListener('click', () => setView('training'));
  document.getElementById('nav-recommend')?.addEventListener('click', () => {
    if (!canAccessRecommendPlan()) return;
    setView('recommend');
  });
  document.getElementById('nav-coach-plan')?.addEventListener('click', () => {
    if (!isAthlete()) return;
    setView('coach-plan');
  });
  document.getElementById('nav-students')?.addEventListener('click', () => {
    if (!isCoach()) return;
    setView('students');
  });
  document.getElementById('nav-catalog')?.addEventListener('click', () => setView('catalog'));
  document.getElementById('coach-plan-catalog-btn')?.addEventListener('click', () => setView('catalog'));
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
  if (next === 'coach-plan' && !isAthlete()) return;
  if (next === 'students' && !isCoach()) return;
  if (ATHLETE_VIEWS.has(next) && !isAthlete()) return;
  if (COACH_VIEWS.has(next) && !isCoach()) return;
  view = next;
  renderSessionChrome();
  onViewChange(view);
}

export function logout() {
  clearToken();
  user = null;
  view = 'catalog';
  clearRecommendPlan();
  renderSessionChrome();
  onViewChange(view);
}

export function syncSessionLabels() {
  document.querySelectorAll(
    '#sidebar-guest [data-ui], #sidebar-auth [data-ui], #recommend-view [data-ui], #coach-plan-view [data-ui], #students-view [data-ui]',
  ).forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });

  const myPlanBtn = document.getElementById('my-plan-btn');
  if (myPlanBtn) myPlanBtn.title = ui('myPlan');

  renderUserName();
  syncNavActive();
  syncRecommendAccess();
  syncCoachPlanPanel();
  syncRoleNav();
}

function renderUserName() {
  const nameEl = document.getElementById('sidebar-user-name');
  const avatarEl = document.getElementById('sidebar-user-avatar');
  const roleEl = document.getElementById('sidebar-user-role');
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

  if (roleEl) {
    const roleKey = user.role === 'admin'
      ? 'roleAdmin'
      : user.role === 'coach'
        ? 'roleCoach'
        : 'roleAthlete';
    roleEl.hidden = false;
    roleEl.dataset.ui = roleKey;
    roleEl.textContent = ui(roleKey);
    roleEl.dataset.role = user.role || 'athlete';
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

function syncCoachPlanPanel() {
  const titleEl = document.getElementById('coach-plan-title');
  const leadEl = document.getElementById('coach-plan-lead');
  const ctaBtn = document.getElementById('coach-plan-catalog-btn');
  if (!titleEl || !leadEl) return;

  const linked = hasCoach();
  titleEl.dataset.ui = linked ? 'coachPlan' : 'coachPlanEmpty';
  leadEl.dataset.ui = linked ? 'coachPlanLead' : 'coachPlanEmptyLead';
  titleEl.textContent = ui(titleEl.dataset.ui);
  leadEl.textContent = ui(leadEl.dataset.ui);
  if (ctaBtn) ctaBtn.hidden = linked;
}

function syncRoleNav() {
  const athleteNav = document.getElementById('nav-athlete');
  const coachNav = document.getElementById('nav-coach');
  const loggedIn = Boolean(user);

  if (athleteNav) athleteNav.hidden = !(loggedIn && isAthlete());
  if (coachNav) coachNav.hidden = !(loggedIn && isCoach());
}

function syncNavActive() {
  const training = document.getElementById('nav-training');
  const recommend = document.getElementById('nav-recommend');
  const coachPlan = document.getElementById('nav-coach-plan');
  const students = document.getElementById('nav-students');
  const catalog = document.getElementById('nav-catalog');

  const pairs = [
    [training, view === 'training'],
    [recommend, view === 'recommend'],
    [coachPlan, view === 'coach-plan'],
    [students, view === 'students'],
    [catalog, view === 'catalog'],
  ];

  for (const [el, on] of pairs) {
    el?.classList.toggle('is-active', on);
    if (on) el?.setAttribute('aria-current', 'page');
    else el?.removeAttribute('aria-current');
  }
}

function normalizeViewForRole() {
  if (!user) {
    view = 'catalog';
    return;
  }

  if (view === 'recommend' && !canAccessRecommendPlan()) {
    view = 'catalog';
    return;
  }

  if (view === 'coach-plan' && !isAthlete()) {
    view = 'catalog';
    return;
  }

  if (ATHLETE_VIEWS.has(view) && !isAthlete()) {
    view = 'catalog';
    return;
  }

  if (COACH_VIEWS.has(view) && !isCoach()) {
    view = 'catalog';
  }
}

function renderSessionChrome() {
  const guest = document.getElementById('sidebar-guest');
  const auth = document.getElementById('sidebar-auth');
  const catalogView = document.getElementById('catalog-view');
  const trainingView = document.getElementById('training-view');
  const recommendView = document.getElementById('recommend-view');
  const coachPlanView = document.getElementById('coach-plan-view');
  const studentsView = document.getElementById('students-view');
  const catalogBar = document.getElementById('catalog-bar-extras');
  const catalogFilters = document.getElementById('sidebar-catalog-filters');
  const wodBtn = document.getElementById('wod-btn');
  const searchEl = document.getElementById('search');
  const searchWrap = searchEl?.closest('.results-search');
  const loggedIn = Boolean(user);

  if (guest) guest.hidden = loggedIn;
  if (auth) auth.hidden = !loggedIn;

  normalizeViewForRole();

  const showTraining = loggedIn && view === 'training';
  const showRecommend = loggedIn && view === 'recommend';
  const showCoachPlan = loggedIn && view === 'coach-plan';
  const showStudents = loggedIn && view === 'students';
  const hideCatalogChrome = showTraining || showRecommend || showCoachPlan || showStudents;
  const hideSearch = showRecommend || showCoachPlan || showStudents;

  if (catalogView) catalogView.hidden = hideCatalogChrome;
  if (trainingView) trainingView.hidden = !showTraining;
  if (recommendView) recommendView.hidden = !showRecommend;
  if (coachPlanView) coachPlanView.hidden = !showCoachPlan;
  if (studentsView) studentsView.hidden = !showStudents;
  if (catalogBar) catalogBar.hidden = hideCatalogChrome;
  if (wodBtn) wodBtn.hidden = hideCatalogChrome;
  if (catalogFilters) catalogFilters.hidden = hideCatalogChrome;
  if (searchWrap) searchWrap.hidden = hideSearch;

  if (searchEl) {
    searchEl.placeholder = showTraining ? ui('searchTraining') : ui('search');
  }

  renderUserName();
  syncNavActive();
  syncRecommendAccess();
  syncCoachPlanPanel();
  syncRoleNav();
}
