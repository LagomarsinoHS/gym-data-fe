/**
 * Session shell: guest vs logged-in sidebar; role-based nav (athlete | coach).
 * Markup: #sidebar-guest, #sidebar-auth, #nav-athlete, #nav-coach,
 * views: catalog | training | recommend | coach-plan | coach-panel | coach-templates | students | session-editor
 * Training grid rendering is driven by main.js (filters live there).
 */
import { getMe } from '../api/users.js';
import { clearToken, isLoggedIn } from '../api/token.js';
import { ui } from '../utils/labels.js';
import { clearRecommendPlan } from './recommend-ui.js';
import { clearCoachAthletesCache } from './students-ui.js';
import {
  clearSessionAssignTarget,
  syncSessionEditorView,
} from './coach-sessions-ui.js';

const VIEWS = new Set([
  'catalog',
  'training',
  'recommend',
  'coach-plan',
  'coach-panel',
  'coach-templates',
  'students',
  'session-editor',
]);
const ATHLETE_VIEWS = new Set(['training', 'recommend', 'coach-plan']);
const COACH_VIEWS = new Set(['coach-panel', 'coach-templates', 'students', 'session-editor']);

let view = 'catalog';
let user = null;
let onViewChange = () => {};
const chromeListeners = new Set();
/** After GET /users/me (or cleared session) — e.g. pending invite. */
const userSyncedListeners = new Set();

/** Run after session chrome re-renders (banner, extras). */
export function onSessionChrome(fn) {
  if (typeof fn === 'function') chromeListeners.add(fn);
}

/** Run after restoreSession / refreshUser finish (user set or cleared). */
export function onUserSynced(fn) {
  if (typeof fn === 'function') userSyncedListeners.add(fn);
}

async function notifyUserSynced() {
  await Promise.all(
    [...userSyncedListeners].map((fn) => Promise.resolve().then(() => fn())),
  );
}

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
  document.getElementById('nav-coach-panel')?.addEventListener('click', () => {
    if (!isCoach()) return;
    setView('coach-panel');
  });
  document.getElementById('nav-coach-templates')?.addEventListener('click', () => {
    if (!isCoach()) return;
    setView('coach-templates');
  });
  document.getElementById('nav-students')?.addEventListener('click', () => {
    if (!isCoach()) return;
    clearSessionAssignTarget();
    setView('students');
  });
  document.getElementById('nav-catalog')?.addEventListener('click', () => {
    if (isCoach()) clearSessionAssignTarget();
    setView('catalog');
  });
  document.getElementById('coach-plan-catalog-btn')?.addEventListener('click', () => setView('catalog'));
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  syncSessionLabels();
  renderSessionChrome();
}

export async function restoreSession() {
  if (!isLoggedIn()) {
    user = null;
    clearCoachAthletesCache();
    renderSessionChrome();
    await notifyUserSynced();
    return null;
  }

  try {
    user = await getMe();
    clearCoachAthletesCache();
    renderSessionChrome();
    await notifyUserSynced();
    return user;
  } catch (err) {
    console.error(err);
    clearToken();
    user = null;
    clearCoachAthletesCache();
    renderSessionChrome();
    await notifyUserSynced();
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

/** Refetch GET /users/me into session (then notify user-synced listeners). */
export async function refreshUser() {
  if (!isLoggedIn()) {
    user = null;
    renderSessionChrome();
    await notifyUserSynced();
    return null;
  }
  user = await getMe();
  renderSessionChrome();
  await notifyUserSynced();
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
  if (ATHLETE_VIEWS.has(next) && !isAthlete()) return;
  if (COACH_VIEWS.has(next) && !isCoach()) return;
  if (next !== 'catalog') clearSessionAssignTarget();
  view = next;
  renderSessionChrome();
  onViewChange(view);
}

export function logout() {
  clearToken();
  user = null;
  view = 'catalog';
  clearRecommendPlan();
  clearCoachAthletesCache();
  renderSessionChrome();
  void notifyUserSynced();
  onViewChange(view);
}

export function syncSessionLabels() {
  document.querySelectorAll(
    '#sidebar-guest [data-ui], #sidebar-auth [data-ui], #recommend-view [data-ui], #coach-plan-view [data-ui], #coach-panel-view [data-ui], #coach-templates-view [data-ui], #students-view [data-ui], #session-editor-view [data-ui], #session-assign-banner [data-ui]',
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
  const emptyPanel = document.getElementById('coach-plan-empty');
  const results = document.getElementById('coach-plan-results');
  if (!titleEl || !leadEl) return;

  const linked = hasCoach();
  const hasProgram = hasCoachTrainingProgram();

  // Empty panel: no coach, or coach but still no sessions/plan
  if (emptyPanel) emptyPanel.hidden = linked && hasProgram;
  if (results) results.hidden = !(linked && hasProgram);

  if (!linked) {
    titleEl.dataset.ui = 'coachPlanEmpty';
    leadEl.dataset.ui = 'coachPlanEmptyLead';
  } else if (!hasProgram) {
    titleEl.dataset.ui = 'coachPlan';
    leadEl.dataset.ui = 'coachPlanProgramEmpty';
  } else {
    titleEl.dataset.ui = 'coachPlan';
    leadEl.dataset.ui = 'coachPlanLead';
  }

  titleEl.textContent = ui(titleEl.dataset.ui);
  leadEl.textContent = ui(leadEl.dataset.ui);
  if (ctaBtn) ctaBtn.hidden = linked;
}

function hasCoachTrainingProgram(u = user) {
  return Array.isArray(u?.coachTrainingProgram) && u.coachTrainingProgram.length > 0;
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
  const coachPanel = document.getElementById('nav-coach-panel');
  const coachTemplates = document.getElementById('nav-coach-templates');
  const students = document.getElementById('nav-students');
  const catalog = document.getElementById('nav-catalog');

  const pairs = [
    [training, view === 'training'],
    [recommend, view === 'recommend'],
    [coachPlan, view === 'coach-plan'],
    [coachPanel, view === 'coach-panel'],
    [coachTemplates, view === 'coach-templates'],
    [students, view === 'students' || view === 'session-editor'],
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
  const coachPanelView = document.getElementById('coach-panel-view');
  const coachTemplatesView = document.getElementById('coach-templates-view');
  const studentsView = document.getElementById('students-view');
  const sessionEditorView = document.getElementById('session-editor-view');
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
  const showCoachPanel = loggedIn && view === 'coach-panel';
  const showCoachTemplates = loggedIn && view === 'coach-templates';
  const showStudents = loggedIn && view === 'students';
  const showSessionEditor = loggedIn && view === 'session-editor';
  const hideCatalogChrome = showTraining
    || showRecommend
    || showCoachPlan
    || showCoachPanel
    || showCoachTemplates
    || showStudents
    || showSessionEditor;
  const hideSearch = showRecommend
    || showCoachPlan
    || showCoachPanel
    || showCoachTemplates
    || showStudents
    || showSessionEditor;

  if (catalogView) catalogView.hidden = hideCatalogChrome;
  if (trainingView) trainingView.hidden = !showTraining;
  if (recommendView) recommendView.hidden = !showRecommend;
  if (coachPlanView) coachPlanView.hidden = !showCoachPlan;
  if (coachPanelView) coachPanelView.hidden = !showCoachPanel;
  if (coachTemplatesView) coachTemplatesView.hidden = !showCoachTemplates;
  if (studentsView) studentsView.hidden = !showStudents;
  if (sessionEditorView) sessionEditorView.hidden = !showSessionEditor;
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
  syncSessionEditorView();

  for (const fn of chromeListeners) fn();
}
