/**
 * Coach — Mis alumnos: list, search, invite.
 * Markup: #students-view, #add-student-overlay
 * Download / export → students-download-ui.js
 * Sessions / editor / save → coach-sessions-ui.js
 * Shared state → coach-athletes-store.js
 */
import { getCoachAthletes, getCoachInvites, inviteCoachAthlete } from '../api/users.js';
import { ui } from '../utils/labels.js';
import { ApiErrorCode, mapApiError } from '../utils/api-errors.js';
import { openProgressPhotos } from './progress-photos-ui.js';
import {
  canInviteAthlete,
  getUser,
  onUserSynced,
  refreshUser,
} from './session-ui.js';
import {
  store,
  athleteDisplayName,
  findAthlete,
  resetCoachAthletesStore,
} from './coach-athletes-store.js';
import {
  initCoachSessionsUi,
  syncCoachSessionsLabels,
  resetCoachSessionsUi,
  createAthletePlan,
  collapseOpenSessionsIn,
} from './coach-sessions-ui.js';
import {
  initStudentsDownloadUi,
  syncDownloadAllState,
  createAthleteDownloadMenu,
} from './students-download-ui.js';

const SUCCESS_CLOSE_MS = 1200;
const ATHLETE_PAGE_SIZE = 5;
const SEARCH_DEBOUNCE_MS = 500;
/** Highlight athletes who accepted an invite within this window. */
const NEW_ACCEPT_MS = 48 * 60 * 60 * 1000;
const SEEN_NEW_ATHLETES_KEY = 'FLEX_SEEN_NEW_ATHLETES';

let overlay;
let form;
let emailInput;
let statusEl;
let submitBtn;
let submitLabel;
let submitFill;
let loadMoreBtn;
let searchInput;
let searchClearBtn;
let sortWrap;
let sortBtn;
let sortMenu;
let closeTimer = 0;
let searchTimer = 0;
/** @type {'default' | 'without-plan' | 'with-plan'} */
let studentsSort = 'default';
/** Athlete ids with a recent accepted invite (not yet dismissed this session). */
let recentAcceptedIds = new Set();

// ── Init / labels ─────────────────────────────────────────────────────
export function initStudentsUi({ navigateTo: nav, openExercise: openEx } = {}) {
  if (typeof nav === 'function') store.navigateTo = nav;
  if (typeof openEx === 'function') store.openExercise = openEx;
  store.refreshList = () => {
    if (store.athletesLoaded) renderStudentsList();
  };

  overlay = document.getElementById('add-student-overlay');
  form = document.getElementById('add-student-form');
  emailInput = document.getElementById('add-student-email');
  statusEl = document.getElementById('add-student-status');
  submitBtn = document.getElementById('add-student-submit');
  submitLabel = submitBtn?.querySelector('.recommend-submit-label');
  submitFill = document.getElementById('add-student-submit-fill');
  loadMoreBtn = document.getElementById('students-load-more');
  searchInput = document.getElementById('students-search');
  searchClearBtn = document.getElementById('students-search-clear');
  sortWrap = document.getElementById('students-sort');
  sortBtn = document.getElementById('students-sort-btn');
  sortMenu = document.getElementById('students-sort-menu');
  if (!overlay || !form) return;

  initCoachSessionsUi();
  initStudentsDownloadUi();

  document.getElementById('students-add-btn')?.addEventListener('click', openAddStudentModal);
  document.getElementById('students-empty-add-btn')?.addEventListener('click', openAddStudentModal);
  document.getElementById('students-invite-quota-badge')?.addEventListener('click', e => {
    e.stopPropagation();
    toggleInviteQuotaTip();
  });
  document.getElementById('add-student-close')?.addEventListener('click', closeAddStudentModal);
  loadMoreBtn?.addEventListener('click', () => void loadMoreAthletes());
  searchInput?.addEventListener('input', onSearchInput);
  searchClearBtn?.addEventListener('click', clearStudentsSearch);
  sortBtn?.addEventListener('click', e => {
    e.stopPropagation();
    toggleStudentsSortMenu();
  });
  sortMenu?.querySelectorAll('[data-sort]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      onStudentsSortPick(btn.dataset.sort);
    });
  });
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeAddStudentModal();
  });
  form.addEventListener('submit', onSubmit);

  document.addEventListener('click', e => {
    const inviteWrap = document.getElementById('students-invite-wrap');
    if (inviteWrap?.classList.contains('is-tip-open') && !inviteWrap.contains(e.target)) {
      closeInviteQuotaTip();
    }
    if (!sortWrap?.classList.contains('is-open')) return;
    if (sortWrap.contains(e.target)) return;
    closeStudentsSortMenu();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (overlay.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeAddStudentModal();
      return;
    }
    if (document.getElementById('students-invite-wrap')?.classList.contains('is-tip-open')) {
      e.stopImmediatePropagation();
      closeInviteQuotaTip();
      return;
    }
    if (sortWrap?.classList.contains('is-open')) {
      e.stopImmediatePropagation();
      closeStudentsSortMenu();
    }
  });

  onUserSynced(() => syncInviteStudentButtons());
  syncStudentsLabels();
}

export function syncStudentsLabels() {
  document.querySelectorAll(
    '#students-view [data-ui], #add-student-overlay [data-ui]',
  ).forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });

  if (emailInput) emailInput.placeholder = ui('inviteEmailPlaceholder');
  if (searchInput) searchInput.placeholder = ui('studentsSearch');
  if (submitBtn && !submitBtn.classList.contains('is-sent') && submitLabel) {
    submitLabel.textContent = ui('addStudentSubmit');
  }

  syncSearchClear();
  syncStudentsSortMenuState();
  syncInviteStudentButtons();
  if (store.athletesLoaded) renderStudentsList();
  syncCoachSessionsLabels();
  syncDownloadAllState();
}

export function clearCoachAthletesCache() {
  resetCoachAthletesStore();
  resetCoachSessionsUi();
  resetStudentsSearch({ keepInput: false });
  studentsSort = 'default';
  recentAcceptedIds = new Set();
  closeStudentsSortMenu();
  syncStudentsSortMenuState();
}

// ── Athletes fetch / search / cache ───────────────────────────────────
/**
 * Fetch linked athletes for the authenticated coach (page 1, limit 5).
 * Cached in memory until force refresh, logout, search change, or session restore.
 * @param {{ force?: boolean }} [opts]
 */
export async function loadCoachAthletes({ force = false } = {}) {
  if (force) resetStudentsSearch({ keepInput: false });

  const shouldFetch = force || !store.athletesLoaded;

  if (!shouldFetch) {
    store.refreshList();
    return store.athletes;
  }

  return fetchAthletesPage(1, { replace: true });
}

async function loadMoreAthletes() {
  if (store.loadingAthletes || !hasMoreAthletes()) return;
  return fetchAthletesPage(store.page + 1, { replace: false });
}

async function fetchAthletesPage(nextPage, { replace }) {
  if (store.loadingAthletes) return store.athletes;

  const seq = ++store.loadSeq;
  store.loadingAthletes = true;
  const showBootLoading = replace && (!store.athletesLoaded || store.athletes.length === 0);
  if (showBootLoading) setStudentsLoading(true);
  syncLoadMoreBtn();

  try {
    const athletesPromise = getCoachAthletes({
      page: nextPage,
      limit: ATHLETE_PAGE_SIZE,
      search: store.searchQuery || undefined,
    });
    const recentPromise = replace
      ? refreshRecentAcceptedAthleteIds()
      : Promise.resolve();

    const [payload] = await Promise.all([athletesPromise, recentPromise]);
    if (seq !== store.loadSeq) return store.athletes;

    const items = normalizeAthletes(payload);
    store.page = Number(payload?.page) || nextPage;
    store.pages = Number(payload?.pages) || 0;
    store.total = Number(payload?.total) || 0;
    const merged = mergeLocalSessions(items);
    store.athletes = replace ? merged : store.athletes.concat(merged);
    store.athletesLoaded = true;
  } catch (err) {
    console.error(err);
    if (seq === store.loadSeq && replace) {
      store.athletes = [];
      store.athletesLoaded = true;
      store.page = 0;
      store.pages = 0;
      store.total = 0;
    }
  } finally {
    if (seq === store.loadSeq) {
      store.loadingAthletes = false;
      setStudentsLoading(false);
      store.refreshList();
    }
  }

  return store.athletes;
}

function setStudentsLoading(show) {
  const loading = document.getElementById('students-loading');
  const empty = document.getElementById('students-empty');
  const list = document.getElementById('students-list');
  if (loading) loading.hidden = !show;
  if (show) {
    if (empty) empty.hidden = true;
    if (list) list.hidden = true;
  }
}

function normalizeAthletes(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function hasMoreAthletes() {
  return store.page > 0 && store.page < store.pages;
}

function onSearchInput() {
  syncSearchClear();
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    const next = searchInput?.value.trim() ?? '';
    if (next === store.searchQuery) return;
    store.searchQuery = next;
    store.openAthleteId = null;
    store.athletesLoaded = false;
    void fetchAthletesPage(1, { replace: true });
  }, SEARCH_DEBOUNCE_MS);
}

function clearStudentsSearch() {
  if (!searchInput) return;
  searchInput.value = '';
  syncSearchClear();
  if (!store.searchQuery) return;
  store.searchQuery = '';
  store.openAthleteId = null;
  store.athletesLoaded = false;
  void fetchAthletesPage(1, { replace: true });
}

function resetStudentsSearch({ keepInput = false } = {}) {
  window.clearTimeout(searchTimer);
  searchTimer = 0;
  store.searchQuery = '';
  if (!keepInput && searchInput) searchInput.value = '';
  syncSearchClear();
}

function syncSearchClear() {
  searchClearBtn?.classList.toggle('visible', Boolean(searchInput?.value));
}

function mergeLocalSessions(nextItems) {
  const prev = new Map(store.athletes.map(a => [String(a?.id), a]));
  return nextItems.map(a => {
    const id = String(a?.id || '');
    const old = prev.get(id);
    const apiSessions = Array.isArray(a?.coachTrainingProgram) ? a.coachTrainingProgram : [];
    const oldSessions = Array.isArray(old?.coachTrainingProgram) ? old.coachTrainingProgram : [];
    // Prefer API when it has sessions; otherwise keep local (e.g. unsaved dirty plan).
    if (apiSessions.length) return { ...a, coachTrainingProgram: apiSessions };
    if (oldSessions.length) return { ...a, coachTrainingProgram: oldSessions };
    return { ...a, coachTrainingProgram: [] };
  });
}

export function getStudents() {
  return store.athletes;
}

// ── Invite student modal ──────────────────────────────────────────────
function syncInviteStudentButtons() {
  const allowed = canInviteAthlete(getUser());
  const badge = document.getElementById('students-invite-quota-badge');
  const tip = document.getElementById('students-invite-quota-tip');
  const tipText = tip?.querySelector('[data-ui="inviteQuotaHint"]');

  for (const id of ['students-add-btn', 'students-empty-add-btn']) {
    const btn = document.getElementById(id);
    if (!btn) continue;
    btn.disabled = !allowed;
    btn.removeAttribute('title');
    btn.setAttribute('aria-disabled', allowed ? 'false' : 'true');
  }

  if (badge) {
    badge.hidden = allowed;
    badge.setAttribute('aria-label', ui('inviteQuotaBadgeAria'));
  }
  if (tipText) tipText.textContent = ui('inviteQuotaHint');
  if (allowed) closeInviteQuotaTip();
}

function toggleInviteQuotaTip() {
  const wrap = document.getElementById('students-invite-wrap');
  const badge = document.getElementById('students-invite-quota-badge');
  if (!wrap || badge?.hidden) return;
  if (wrap.classList.contains('is-tip-open')) closeInviteQuotaTip();
  else openInviteQuotaTip();
}

function openInviteQuotaTip() {
  const wrap = document.getElementById('students-invite-wrap');
  const badge = document.getElementById('students-invite-quota-badge');
  const tip = document.getElementById('students-invite-quota-tip');
  if (!wrap || !badge || !tip || badge.hidden) return;
  wrap.classList.add('is-tip-open');
  tip.hidden = false;
  badge.setAttribute('aria-expanded', 'true');
}

function closeInviteQuotaTip() {
  const wrap = document.getElementById('students-invite-wrap');
  const badge = document.getElementById('students-invite-quota-badge');
  const tip = document.getElementById('students-invite-quota-tip');
  wrap?.classList.remove('is-tip-open');
  if (tip) tip.hidden = true;
  badge?.setAttribute('aria-expanded', 'false');
}

export function openAddStudentModal() {
  if (!overlay) return;
  if (!canInviteAthlete(getUser())) {
    syncInviteStudentButtons();
    return;
  }
  clearCloseTimer();
  setStatus('');
  form?.reset();
  resetSubmitBtn();
  overlay.classList.add('open');
  emailInput?.focus();
}

export function closeAddStudentModal() {
  clearCloseTimer();
  overlay?.classList.remove('open');
  setStatus('');
  resetSubmitBtn();
}

async function onSubmit(e) {
  e.preventDefault();
  const email = emailInput?.value.trim() ?? '';
  if (!email) return;

  clearCloseTimer();
  setStatus('');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await inviteCoachAthlete(email);
    void loadCoachAthletes({ force: true });
    void refreshUser().then(() => syncInviteStudentButtons());
    if (submitBtn) {
      submitBtn.classList.add('is-sent');
      submitBtn.disabled = true;
    }
    if (submitLabel) {
      submitLabel.dataset.ui = 'inviteSent';
      submitLabel.textContent = ui('inviteSent');
    }
    startSubmitFill();
    closeTimer = window.setTimeout(() => {
      closeTimer = 0;
      closeAddStudentModal();
    }, SUCCESS_CLOSE_MS);
  } catch (err) {
    console.error(err);
    setStatus(inviteErrorMessage(err), 'error');
    resetSubmitBtn();
  }
}

function inviteErrorMessage(err) {
  return mapApiError(err, {
    byCode: {
      [ApiErrorCode.CoachAthleteQuotaFull]: 'inviteQuotaFull',
      [ApiErrorCode.AthleteNotFoundByEmail]: 'inviteNotFound',
      [ApiErrorCode.AthleteHasPendingInvite]: 'invitePending',
    },
    fallback: 'inviteFail',
  });
}

function setStatus(message, kind = '') {
  if (!statusEl) return;
  if (!message) {
    statusEl.hidden = true;
    statusEl.textContent = '';
    statusEl.classList.remove('is-error', 'is-ok');
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle('is-error', kind === 'error');
  statusEl.classList.toggle('is-ok', kind === 'ok');
}

function resetSubmitBtn() {
  if (!submitBtn) return;
  submitBtn.disabled = false;
  submitBtn.classList.remove('is-sent');
  if (submitLabel) {
    submitLabel.dataset.ui = 'addStudentSubmit';
    submitLabel.textContent = ui('addStudentSubmit');
  }
  stopSubmitFill();
}

function startSubmitFill() {
  if (!submitFill) return;
  submitFill.hidden = false;
  submitFill.style.width = '';
  submitFill.style.animation = 'none';
  void submitFill.offsetWidth;
  submitFill.style.animation = '';
}

function stopSubmitFill() {
  if (!submitFill) return;
  submitFill.hidden = true;
  submitFill.style.animation = 'none';
  submitFill.style.width = '0%';
}

function clearCloseTimer() {
  if (!closeTimer) return;
  window.clearTimeout(closeTimer);
  closeTimer = 0;
}

// ── Students list UI ──────────────────────────────────────────────────
function renderStudentsList() {
  const loading = document.getElementById('students-loading');
  const empty = document.getElementById('students-empty');
  const list = document.getElementById('students-list');
  const emptyTitle = empty?.querySelector('.students-empty-title');
  const emptyLead = empty?.querySelector('.students-empty-lead');
  const emptyAdd = document.getElementById('students-empty-add-btn');
  if (!empty || !list) return;

  if (store.loadingAthletes && !store.athletesLoaded) {
    setStudentsLoading(true);
    syncDownloadAllState();
    return;
  }

  if (loading) loading.hidden = true;

  const has = store.athletes.length > 0;
  const searching = Boolean(store.searchQuery);
  empty.hidden = has;
  list.hidden = !has;
  list.replaceChildren();

  if (!has) {
    store.openAthleteId = null;
    if (emptyTitle) {
      emptyTitle.dataset.ui = searching ? 'studentsSearchEmptyTitle' : 'studentsEmptyTitle';
      emptyTitle.textContent = ui(emptyTitle.dataset.ui);
    }
    if (emptyLead) {
      emptyLead.dataset.ui = searching ? 'studentsSearchEmptyLead' : 'studentsEmptyLead';
      emptyLead.textContent = ui(emptyLead.dataset.ui);
    }
    if (emptyAdd) emptyAdd.hidden = searching;
    syncLoadMoreBtn();
    syncDownloadAllState();
    return;
  }

  if (emptyAdd) emptyAdd.hidden = false;

  const frag = document.createDocumentFragment();
  for (const athlete of sortedAthletes(store.athletes)) {
    frag.appendChild(createStudentRow(athlete));
  }
  list.appendChild(frag);
  syncLoadMoreBtn();
  syncDownloadAllState();
}

function onStudentsSortPick(next) {
  const value = next === 'without-plan' || next === 'with-plan' ? next : 'default';
  // Re-clicking the active option clears the sort.
  studentsSort = studentsSort === value ? 'default' : value;
  closeStudentsSortMenu();
  syncStudentsSortMenuState();
  if (store.athletesLoaded) renderStudentsList();
}

function toggleStudentsSortMenu() {
  if (sortWrap?.classList.contains('is-open')) closeStudentsSortMenu();
  else openStudentsSortMenu();
}

function openStudentsSortMenu() {
  if (!sortWrap || !sortBtn || !sortMenu) return;
  sortWrap.classList.add('is-open');
  sortMenu.hidden = false;
  sortBtn.setAttribute('aria-expanded', 'true');
}

function closeStudentsSortMenu() {
  if (!sortWrap || !sortBtn || !sortMenu) return;
  sortWrap.classList.remove('is-open');
  sortMenu.hidden = true;
  sortBtn.setAttribute('aria-expanded', 'false');
}

function syncStudentsSortMenuState() {
  sortMenu?.querySelectorAll('[data-sort]').forEach(btn => {
    const active = btn.dataset.sort === studentsSort;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-checked', active ? 'true' : 'false');
  });
  sortWrap?.classList.toggle('has-active-sort', studentsSort !== 'default');
}

function athleteHasPlan(athlete) {
  const prog = athlete?.coachTrainingProgram;
  if (!Array.isArray(prog) || prog.length === 0) return false;
  return prog.some(session => Array.isArray(session?.items) && session.items.length > 0);
}

/** Client-side sort over the currently loaded athletes page(s). */
function sortedAthletes(athletes) {
  if (studentsSort === 'default') return athletes;
  const preferWithout = studentsSort === 'without-plan';
  return [...athletes].sort((a, b) => {
    const aHas = athleteHasPlan(a);
    const bHas = athleteHasPlan(b);
    if (aHas === bHas) return 0;
    if (preferWithout) return aHas ? 1 : -1;
    return aHas ? -1 : 1;
  });
}

function syncLoadMoreBtn() {
  if (!loadMoreBtn) loadMoreBtn = document.getElementById('students-load-more');
  if (!loadMoreBtn) return;

  const show = store.athletes.length > 0 && hasMoreAthletes();
  loadMoreBtn.hidden = !show;
  loadMoreBtn.disabled = store.loadingAthletes;
  const label = loadMoreBtn.querySelector('[data-ui="studentsLoadMore"]');
  if (label) label.textContent = ui('studentsLoadMore');
}

function createDetail(label, value) {
  const row = document.createElement('div');
  row.className = 'student-row-detail';

  const labelEl = document.createElement('span');
  labelEl.className = 'student-row-detail-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'student-row-detail-value';
  valueEl.textContent = value;

  row.append(labelEl, valueEl);
  return row;
}

function toggleStudentRow(row) {
  const opening = !row.classList.contains('is-open');
  document.querySelectorAll('#students-list .student-row.is-open').forEach(other => {
    if (other !== row) closeStudentRow(other);
  });
  if (opening) openStudentRow(row);
  else closeStudentRow(row);
}

function openStudentRow(row) {
  const nextId = row.dataset.id || null;
  // Switching athletes (or re-opening): start with sessions collapsed
  if (store.openAthleteId !== nextId) store.openSessionId = null;

  const header = row.querySelector('.student-row-header');
  row.classList.add('is-open');
  if (header) header.setAttribute('aria-expanded', 'true');
  store.openAthleteId = nextId;

  if (nextId) markNewAthleteSeen(nextId, row);
}

function createStudentRow(athlete) {
  const id = String(athlete?.id || '');
  const first = String(athlete?.firstName || '').trim();
  const last = String(athlete?.lastName || '').trim();
  const email = String(athlete?.email || '').trim();
  const full = athleteDisplayName(athlete);
  const isNew = Boolean(id && recentAcceptedIds.has(id));

  const row = document.createElement('div');
  row.className = 'student-row';
  if (isNew) row.classList.add('is-new');
  if (id) row.dataset.id = id;

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'student-row-header';
  header.setAttribute('aria-expanded', 'false');

  const avatar = document.createElement('span');
  avatar.className = 'student-row-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    || email.charAt(0).toUpperCase()
    || '?';

  const meta = document.createElement('span');
  meta.className = 'student-row-meta';

  const nameRow = document.createElement('span');
  nameRow.className = 'student-row-name-row';

  const nameEl = document.createElement('span');
  nameEl.className = 'student-row-name';
  nameEl.textContent = full;
  nameRow.append(nameEl);

  if (isNew) {
    const badge = document.createElement('span');
    badge.className = 'student-row-new-badge';

    const dot = document.createElement('span');
    dot.className = 'student-row-new-dot';
    dot.setAttribute('aria-hidden', 'true');

    const label = document.createElement('span');
    label.className = 'student-row-new-label';
    label.textContent = ui('studentsNewBadge');

    badge.append(dot, label);
    nameRow.append(badge);
  }

  meta.append(nameRow);

  const chevron = document.createElement('span');
  chevron.className = 'student-row-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  header.append(avatar, meta, chevron);

  const body = document.createElement('div');
  body.className = 'student-row-body';

  const emailLine = document.createElement('div');
  emailLine.className = 'student-row-detail-line';

  emailLine.append(
    createDetail(ui('email'), email || '—'),
    createAthleteProgressButton(id),
    createAthleteDownloadMenu(id),
  );

  body.append(
    createDetail(ui('firstName'), first || '—'),
    createDetail(ui('lastName'), last || '—'),
    emailLine,
    createAthletePlan(athlete),
  );

  header.addEventListener('click', () => toggleStudentRow(row));
  row.append(header, body);

  if (store.openAthleteId && store.openAthleteId === id) openStudentRow(row);

  return row;
}

function createAthleteProgressButton(athleteId) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'student-row-progress-btn';
  btn.textContent = ui('studentsProgress');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    openProgressPhotos(athleteId, {
      returnTo: 'students',
      athlete: findAthlete(athleteId),
    });
  });
  return btn;
}

// ── Recent accepted invites → “Nuevo” badge ───────────────────────────

async function refreshRecentAcceptedAthleteIds() {
  try {
    const payload = await getCoachInvites({
      status: 'accepted',
      page: 1,
      limit: 50,
    });
    const items = Array.isArray(payload?.data) ? payload.data : [];
    const cutoff = Date.now() - NEW_ACCEPT_MS;
    const seen = readSeenNewAthletes();

    recentAcceptedIds = new Set(
      items
        .filter((invite) => {
          const raw = invite?.respondedAt || invite?.invitedAt;
          const t = raw ? new Date(raw).getTime() : NaN;
          return Number.isFinite(t) && t >= cutoff;
        })
        .map((invite) => String(invite?.athleteId || ''))
        .filter((athleteId) => athleteId && !seen.has(athleteId)),
    );
  } catch (err) {
    console.error(err);
    recentAcceptedIds = new Set();
  }
}

function markNewAthleteSeen(athleteId, row) {
  const id = String(athleteId || '');
  if (!id) return;

  recentAcceptedIds.delete(id);
  const seen = readSeenNewAthletes();
  seen.add(id);
  writeSeenNewAthletes(seen);

  row?.classList.remove('is-new');
  row?.querySelector('.student-row-new-badge')?.remove();
}

function readSeenNewAthletes() {
  try {
    const raw = localStorage.getItem(SEEN_NEW_ATHLETES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeSeenNewAthletes(ids) {
  try {
    localStorage.setItem(SEEN_NEW_ATHLETES_KEY, JSON.stringify([...ids]));
  } catch {
    /* ignore quota / private mode */
  }
}

function closeStudentRow(row) {
  const header = row.querySelector('.student-row-header');
  row.classList.remove('is-open');
  if (header) header.setAttribute('aria-expanded', 'false');
  collapseOpenSessionsIn(row);
  if (store.openAthleteId && row.dataset.id === store.openAthleteId) {
    store.openAthleteId = null;
    store.openSessionId = null;
  }
}
