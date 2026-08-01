/**
 * Coach — Mis alumnos: list + invite + sessions shell + session editor.
 * Markup: #students-view, #session-editor-view, #add-student-overlay, #add-session-overlay
 * API: POST /users/coach/invites · GET /users/coach/athletes
 * Sessions: local shell until BE persists coachTrainingProgram sessions.
 */
import { getCoachAthletes, inviteCoachAthlete } from '../api/users.js';
import { assetUrl } from '../utils/assets.js';
import { exerciseName, ui } from '../utils/labels.js';
import { prescriptionLines, prescriptionNote } from './training-ui.js';

const SUCCESS_CLOSE_MS = 1200;
const ATHLETE_PAGE_SIZE = 5;
const SEARCH_DEBOUNCE_MS = 500;

let overlay;
let form;
let emailInput;
let statusEl;
let submitBtn;
let submitLabel;
let submitFill;
let sessionOverlay;
let sessionForm;
let sessionNameInput;
let sessionStatusEl;
let sessionSubmitBtn;
let sessionAthleteId = null;
let loadMoreBtn;
let searchInput;
let searchClearBtn;
let downloadWrap;
let downloadBtn;
let downloadMenu;
let downloadAllBtn;
let closeTimer = 0;
let searchTimer = 0;
let athletes = [];
let athletesLoaded = false;
let loadingAthletes = false;
let page = 0;
let pages = 0;
let total = 0;
let loadSeq = 0;
let openAthleteId = null;
let openSessionId = null;
let searchQuery = '';
let editorAthleteId = null;
let editorSessionId = null;
let sessionAssignTarget = null;
let navigateTo = () => {};
let openExercise = () => {};

export function initStudentsUi({ navigateTo: nav, openExercise: openEx } = {}) {
  if (typeof nav === 'function') navigateTo = nav;
  if (typeof openEx === 'function') openExercise = openEx;

  overlay = document.getElementById('add-student-overlay');
  form = document.getElementById('add-student-form');
  emailInput = document.getElementById('add-student-email');
  statusEl = document.getElementById('add-student-status');
  submitBtn = document.getElementById('add-student-submit');
  submitLabel = submitBtn?.querySelector('.recommend-submit-label');
  submitFill = document.getElementById('add-student-submit-fill');
  sessionOverlay = document.getElementById('add-session-overlay');
  sessionForm = document.getElementById('add-session-form');
  sessionNameInput = document.getElementById('add-session-name');
  sessionStatusEl = document.getElementById('add-session-status');
  sessionSubmitBtn = document.getElementById('add-session-submit');
  loadMoreBtn = document.getElementById('students-load-more');
  searchInput = document.getElementById('students-search');
  searchClearBtn = document.getElementById('students-search-clear');
  downloadWrap = document.getElementById('students-download');
  downloadBtn = document.getElementById('students-download-btn');
  downloadMenu = document.getElementById('students-download-menu');
  downloadAllBtn = document.getElementById('students-download-all');
  if (!overlay || !form) return;

  document.getElementById('students-add-btn')?.addEventListener('click', openAddStudentModal);
  document.getElementById('students-empty-add-btn')?.addEventListener('click', openAddStudentModal);
  document.getElementById('add-student-close')?.addEventListener('click', closeAddStudentModal);
  document.getElementById('add-session-close')?.addEventListener('click', closeAddSessionModal);
  document.getElementById('session-editor-back')?.addEventListener('click', () => {
    editorAthleteId = null;
    editorSessionId = null;
    navigateTo('students');
  });
  document.getElementById('session-editor-add')?.addEventListener('click', () => {
    if (editorAthleteId && editorSessionId) beginSessionAssign(editorAthleteId, editorSessionId);
  });
  document.getElementById('session-assign-done')?.addEventListener('click', () => {
    clearSessionAssignTarget();
    if (editorAthleteId && editorSessionId) navigateTo('session-editor');
    else navigateTo('students');
  });
  loadMoreBtn?.addEventListener('click', () => void loadMoreAthletes());
  searchInput?.addEventListener('input', onSearchInput);
  searchClearBtn?.addEventListener('click', clearStudentsSearch);
  downloadBtn?.addEventListener('click', e => {
    e.stopPropagation();
    toggleDownloadMenu();
  });
  downloadAllBtn?.addEventListener('click', onDownloadAll);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeAddStudentModal();
  });
  sessionOverlay?.addEventListener('click', e => {
    if (e.target === sessionOverlay) closeAddSessionModal();
  });
  form.addEventListener('submit', onSubmit);
  sessionForm?.addEventListener('submit', onAddSessionSubmit);

  document.addEventListener('click', e => {
    if (!downloadWrap?.classList.contains('is-open')) return;
    if (downloadWrap.contains(e.target)) return;
    closeDownloadMenu();
  });

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (downloadWrap?.classList.contains('is-open')) {
      e.stopImmediatePropagation();
      closeDownloadMenu();
      return;
    }
    if (sessionOverlay?.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeAddSessionModal();
      return;
    }
    if (overlay.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeAddStudentModal();
    }
  });

  syncStudentsLabels();
}

/**
 * Fetch linked athletes for the authenticated coach (page 1, limit 5).
 * Cached in memory until force refresh, logout, search change, or session restore.
 * @param {{ force?: boolean }} [opts]
 */
export async function loadCoachAthletes({ force = false } = {}) {
  if (force) resetStudentsSearch({ keepInput: false });

  const shouldFetch = force || !athletesLoaded || athletes.length === 0;

  if (!shouldFetch) {
    renderStudentsList();
    return athletes;
  }

  return fetchAthletesPage(1, { replace: true });
}

async function loadMoreAthletes() {
  if (loadingAthletes || !hasMoreAthletes()) return;
  return fetchAthletesPage(page + 1, { replace: false });
}

async function fetchAthletesPage(nextPage, { replace }) {
  if (loadingAthletes) return athletes;

  const seq = ++loadSeq;
  loadingAthletes = true;
  syncLoadMoreBtn();

  try {
    const payload = await getCoachAthletes({
      page: nextPage,
      limit: ATHLETE_PAGE_SIZE,
      search: searchQuery || undefined,
    });
    if (seq !== loadSeq) return athletes;

    const items = normalizeAthletes(payload);
    page = Number(payload?.page) || nextPage;
    pages = Number(payload?.pages) || 0;
    total = Number(payload?.total) || 0;
    const merged = mergeLocalSessions(items);
    athletes = replace ? merged : athletes.concat(merged);
    athletesLoaded = true;
  } catch (err) {
    console.error(err);
    if (seq === loadSeq && replace) {
      athletes = [];
      athletesLoaded = false;
      page = 0;
      pages = 0;
      total = 0;
    }
  } finally {
    if (seq === loadSeq) loadingAthletes = false;
    renderStudentsList();
  }

  return athletes;
}

function normalizeAthletes(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function hasMoreAthletes() {
  return page > 0 && page < pages;
}

function onSearchInput() {
  syncSearchClear();
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    const next = searchInput?.value.trim() ?? '';
    if (next === searchQuery) return;
    searchQuery = next;
    openAthleteId = null;
    athletesLoaded = false;
    void fetchAthletesPage(1, { replace: true });
  }, SEARCH_DEBOUNCE_MS);
}

function clearStudentsSearch() {
  if (!searchInput) return;
  searchInput.value = '';
  syncSearchClear();
  if (!searchQuery) return;
  searchQuery = '';
  openAthleteId = null;
  athletesLoaded = false;
  void fetchAthletesPage(1, { replace: true });
}

function resetStudentsSearch({ keepInput = false } = {}) {
  window.clearTimeout(searchTimer);
  searchTimer = 0;
  searchQuery = '';
  if (!keepInput && searchInput) searchInput.value = '';
  syncSearchClear();
}

function syncSearchClear() {
  searchClearBtn?.classList.toggle('visible', Boolean(searchInput?.value));
}

export function clearCoachAthletesCache() {
  loadSeq += 1;
  athletes = [];
  athletesLoaded = false;
  loadingAthletes = false;
  page = 0;
  pages = 0;
  total = 0;
  openAthleteId = null;
  openSessionId = null;
  editorAthleteId = null;
  editorSessionId = null;
  clearSessionAssignTarget();
  resetStudentsSearch({ keepInput: false });
}

function mergeLocalSessions(nextItems) {
  const prev = new Map(athletes.map(a => [String(a?.id), a]));
  return nextItems.map(a => {
    const id = String(a?.id || '');
    const old = prev.get(id);
    const oldSessions = old && isSessionsShape(old.coachTrainingProgram || [])
      ? old.coachTrainingProgram
      : null;
    const apiSessions = isSessionsShape(a?.coachTrainingProgram || [])
      ? a.coachTrainingProgram
      : null;
    if (apiSessions?.length) return { ...a, coachTrainingProgram: apiSessions };
    if (oldSessions?.length) return { ...a, coachTrainingProgram: oldSessions };
    return {
      ...a,
      coachTrainingProgram: apiSessions || oldSessions || [],
    };
  });
}

export function getStudents() {
  return athletes;
}

export function openAddStudentModal() {
  if (!overlay) return;
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

export function syncStudentsLabels() {
  document.querySelectorAll(
    '#students-view [data-ui], #session-editor-view [data-ui], #session-assign-banner [data-ui], #add-student-overlay [data-ui], #add-session-overlay [data-ui]',
  ).forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });

  if (emailInput) emailInput.placeholder = ui('inviteEmailPlaceholder');
  if (searchInput) searchInput.placeholder = ui('studentsSearch');
  if (sessionNameInput && !sessionOverlay?.classList.contains('open')) {
    sessionNameInput.placeholder = ui('addSessionNamePlaceholder');
  }
  if (submitBtn && !submitBtn.classList.contains('is-sent') && submitLabel) {
    submitLabel.textContent = ui('addStudentSubmit');
  }

  syncSearchClear();
  if (athletesLoaded) renderStudentsList();
  syncSessionEditorView();
  syncSessionAssignBanner();
}

export function openAddSessionModal(athleteId) {
  if (!sessionOverlay || !sessionForm) return;
  const athlete = athletes.find(a => String(a?.id) === String(athleteId));
  if (!athlete) return;

  sessionAthleteId = String(athleteId);
  setSessionStatus('');
  sessionForm.reset();
  const next = getAthleteSessions(athlete).length + 1;
  const defaultName = ui('addSessionDefault', next);
  if (sessionNameInput) {
    sessionNameInput.placeholder = defaultName;
    sessionNameInput.value = defaultName;
  }
  if (sessionSubmitBtn) sessionSubmitBtn.disabled = false;
  sessionOverlay.classList.add('open');
  sessionNameInput?.focus();
  sessionNameInput?.select();
}

export function closeAddSessionModal() {
  sessionOverlay?.classList.remove('open');
  sessionAthleteId = null;
  setSessionStatus('');
  sessionForm?.reset();
  if (sessionSubmitBtn) sessionSubmitBtn.disabled = false;
}

function renderStudentsList() {
  const empty = document.getElementById('students-empty');
  const list = document.getElementById('students-list');
  const emptyTitle = empty?.querySelector('.students-empty-title');
  const emptyLead = empty?.querySelector('.students-empty-lead');
  const emptyAdd = document.getElementById('students-empty-add-btn');
  if (!empty || !list) return;

  const has = athletes.length > 0;
  const searching = Boolean(searchQuery);
  empty.hidden = has;
  list.hidden = !has;
  list.replaceChildren();

  if (!has) {
    openAthleteId = null;
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
    return;
  }

  if (emptyAdd) emptyAdd.hidden = false;

  const frag = document.createDocumentFragment();
  for (const athlete of athletes) {
    frag.appendChild(createStudentRow(athlete));
  }
  list.appendChild(frag);
  syncLoadMoreBtn();
}

function syncLoadMoreBtn() {
  if (!loadMoreBtn) loadMoreBtn = document.getElementById('students-load-more');
  if (!loadMoreBtn) return;

  const show = athletes.length > 0 && hasMoreAthletes();
  loadMoreBtn.hidden = !show;
  loadMoreBtn.disabled = loadingAthletes;
  const label = loadMoreBtn.querySelector('[data-ui="studentsLoadMore"]');
  if (label) label.textContent = ui('studentsLoadMore');
}

function toggleDownloadMenu() {
  if (downloadWrap?.classList.contains('is-open')) closeDownloadMenu();
  else openDownloadMenu();
}

function openDownloadMenu() {
  if (!downloadWrap || !downloadMenu || !downloadBtn) return;
  downloadWrap.classList.add('is-open');
  downloadMenu.hidden = false;
  downloadBtn.setAttribute('aria-expanded', 'true');
}

function closeDownloadMenu() {
  if (!downloadWrap || !downloadMenu || !downloadBtn) return;
  downloadWrap.classList.remove('is-open');
  downloadMenu.hidden = true;
  downloadBtn.setAttribute('aria-expanded', 'false');
}

function onDownloadAll() {
  closeDownloadMenu();
  // Shell: Excel export TBD (docs/TODO.md)
}

function createStudentRow(athlete) {
  const id = String(athlete?.id || '');
  const first = String(athlete?.firstName || '').trim();
  const last = String(athlete?.lastName || '').trim();
  const email = String(athlete?.email || '').trim();
  const full = [first, last].filter(Boolean).join(' ') || email || '—';
  const sessions = getAthleteSessions(athlete);

  const row = document.createElement('div');
  row.className = 'student-row';
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

  const nameEl = document.createElement('span');
  nameEl.className = 'student-row-name';
  nameEl.textContent = full;
  meta.append(nameEl);

  const chevron = document.createElement('span');
  chevron.className = 'student-row-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  header.append(avatar, meta, chevron);

  const body = document.createElement('div');
  body.className = 'student-row-body';

  const emailLine = document.createElement('div');
  emailLine.className = 'student-row-detail-line';

  const downloadOne = document.createElement('button');
  downloadOne.type = 'button';
  downloadOne.className = 'student-row-download';
  downloadOne.textContent = '⏬';
  downloadOne.setAttribute('aria-label', ui('studentsDownloadPlan'));
  downloadOne.title = ui('studentsDownloadPlan');
  downloadOne.addEventListener('click', e => {
    e.stopPropagation();
    onDownloadAthlete(id);
  });

  emailLine.append(createDetail(ui('email'), email || '—'), downloadOne);

  const plan = document.createElement('div');
  plan.className = 'student-plan';

  const planHead = document.createElement('div');
  planHead.className = 'student-plan-head';

  const planTitle = document.createElement('span');
  planTitle.className = 'student-plan-title';
  planTitle.textContent = ui('sessionsHeading');

  const addSessionBtn = document.createElement('button');
  addSessionBtn.type = 'button';
  addSessionBtn.className = 'student-plan-add';
  addSessionBtn.textContent = ui('addSession');
  addSessionBtn.addEventListener('click', e => {
    e.stopPropagation();
    openAddSessionModal(id);
  });

  planHead.append(planTitle, addSessionBtn);

  const sessionList = document.createElement('div');
  sessionList.className = 'student-session-list';

  if (sessions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'student-plan-empty';
    empty.textContent = ui('sessionsEmpty');
    sessionList.append(empty);
  } else {
    for (const session of sessions) {
      sessionList.appendChild(createSessionRow(session, id));
    }
  }

  plan.append(planHead, sessionList);

  body.append(
    createDetail(ui('firstName'), first || '—'),
    createDetail(ui('lastName'), last || '—'),
    emailLine,
    plan,
  );

  header.addEventListener('click', () => toggleStudentRow(row));
  row.append(header, body);

  if (openAthleteId && openAthleteId === id) openStudentRow(row);

  return row;
}

function createSessionRow(session, athleteId) {
  const id = String(session?.id || '');
  const name = String(session?.name || '').trim() || '—';
  const items = Array.isArray(session?.items) ? session.items : [];

  const row = document.createElement('div');
  row.className = 'student-session';
  if (id) row.dataset.sessionId = id;

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'student-session-header';
  header.setAttribute('aria-expanded', 'false');

  const nameEl = document.createElement('span');
  nameEl.className = 'student-session-name';
  nameEl.textContent = name;

  const meta = document.createElement('span');
  meta.className = 'student-session-meta';
  meta.textContent = ui('sessionExercisesCount', items.length);

  const chevron = document.createElement('span');
  chevron.className = 'student-session-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  header.append(nameEl, meta, chevron);

  const body = document.createElement('div');
  body.className = 'student-session-body';

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'student-session-empty';
    empty.textContent = ui('sessionEmptyItems');
    body.append(empty);
  } else {
    const summary = document.createElement('div');
    summary.className = 'student-session-summary';
    const sorted = [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    for (const item of sorted) {
      summary.appendChild(createSessionMiniCard(item));
    }
    body.append(summary);
  }

  const actions = document.createElement('div');
  actions.className = 'student-session-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'student-session-edit';
  editBtn.textContent = items.length ? ui('sessionEdit') : ui('sessionAddExercises');
  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    openSessionEditor(athleteId, id);
  });
  actions.append(editBtn);
  body.append(actions);

  header.addEventListener('click', e => {
    e.stopPropagation();
    toggleSessionRow(row);
  });

  row.append(header, body);

  if (openSessionId && openSessionId === id) openSessionRow(row);

  return row;
}

export function openSessionEditor(athleteId, sessionId) {
  const athlete = findAthlete(athleteId);
  const session = findSession(athleteId, sessionId);
  if (!athlete || !session) return;

  editorAthleteId = String(athleteId);
  editorSessionId = String(sessionId);
  openAthleteId = editorAthleteId;
  openSessionId = editorSessionId;
  clearSessionAssignTarget();
  navigateTo('session-editor');
}

export function beginSessionAssign(athleteId, sessionId) {
  const athlete = findAthlete(athleteId);
  const session = findSession(athleteId, sessionId);
  if (!athlete || !session) return;

  editorAthleteId = String(athleteId);
  editorSessionId = String(sessionId);
  navigateTo('catalog');
  armSessionAssignTarget(athlete, session);
}

/** Open modal to edit an exercise already in the session (stay in editor). */
export function editSessionExercise(athleteId, sessionId, exerciseId) {
  const athlete = findAthlete(athleteId);
  const session = findSession(athleteId, sessionId);
  if (!athlete || !session || !exerciseId) return;
  if (!isExerciseInSession(athleteId, sessionId, exerciseId)) return;

  editorAthleteId = String(athleteId);
  editorSessionId = String(sessionId);
  armSessionAssignTarget(athlete, session);
  openExercise(String(exerciseId));
}

function armSessionAssignTarget(athlete, session) {
  sessionAssignTarget = {
    athleteId: String(athlete.id),
    sessionId: String(session.id),
    sessionName: String(session.name || '').trim(),
    athleteName: athleteDisplayName(athlete),
  };
  syncSessionAssignBanner();
}

export function clearSessionAssignTarget() {
  sessionAssignTarget = null;
  syncSessionAssignBanner();
}

export function getSessionAssignTarget() {
  return sessionAssignTarget;
}

export function isExerciseInSession(athleteId, sessionId, exerciseId) {
  return Boolean(getSessionExerciseItem(athleteId, sessionId, exerciseId));
}

export function getSessionExerciseItem(athleteId, sessionId, exerciseId) {
  const session = findSession(athleteId, sessionId);
  if (!session) return null;
  const key = String(exerciseId || '');
  return (session.items || []).find(
    item => String(item.exercise?.id || item.exerciseId) === key,
  ) || null;
}

export function addExerciseToSession(athleteId, sessionId, exercise) {
  const session = findSession(athleteId, sessionId);
  if (!session || !exercise?.id) return false;

  const key = String(exercise.id);
  if (isExerciseInSession(athleteId, sessionId, key)) return false;

  if (!Array.isArray(session.items)) session.items = [];
  session.items.push({
    exerciseId: key,
    exercise,
    order: session.items.length,
  });
  syncSessionEditorView();
  if (athletesLoaded) renderStudentsList();
  return true;
}

export function updateSessionExercise(athleteId, sessionId, exerciseId, updates) {
  const item = getSessionExerciseItem(athleteId, sessionId, exerciseId);
  if (!item || !updates) return false;

  if ('sets' in updates) item.sets = updates.sets;
  if ('reps' in updates) item.reps = updates.reps;
  if ('rest' in updates) item.rest = updates.rest;
  if ('notes' in updates) item.notes = updates.notes;

  syncSessionEditorView();
  if (athletesLoaded) renderStudentsList();
  return true;
}

export function removeExerciseFromSession(athleteId, sessionId, exerciseId) {
  const session = findSession(athleteId, sessionId);
  if (!session) return false;

  const key = String(exerciseId || '');
  const before = session.items?.length || 0;
  session.items = (session.items || []).filter(
    item => String(item.exercise?.id || item.exerciseId) !== key,
  );
  session.items.forEach((item, i) => { item.order = i; });
  if (session.items.length === before) return false;

  syncSessionEditorView();
  if (athletesLoaded) renderStudentsList();
  return true;
}

export function getSessionAssignLabel() {
  const target = sessionAssignTarget;
  if (!target) return '';
  const athlete = findAthlete(target.athleteId);
  const session = findSession(target.athleteId, target.sessionId);
  if (!athlete || !session) return '';
  const athleteName = athleteDisplayName(athlete);
  return ui('sessionAssignTo', session.name, athleteName);
}

export function syncSessionEditorView() {
  const view = document.getElementById('session-editor-view');
  if (!view || view.hidden) return;

  const titleEl = document.getElementById('session-editor-title');
  const subtitleEl = document.getElementById('session-editor-subtitle');
  const listEl = document.getElementById('session-editor-list');
  if (!listEl) return;

  const athlete = findAthlete(editorAthleteId);
  const session = findSession(editorAthleteId, editorSessionId);

  if (!athlete || !session) {
    listEl.replaceChildren();
    if (titleEl) titleEl.textContent = ui('sessionsHeading');
    if (subtitleEl) subtitleEl.textContent = '';
    return;
  }

  if (titleEl) titleEl.textContent = session.name || ui('sessionsHeading');
  if (subtitleEl) {
    subtitleEl.textContent = `${athleteDisplayName(athlete)} · ${ui('sessionExercisesCount', session.items?.length || 0)}`;
  }

  listEl.replaceChildren();
  const items = [...(session.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!items.length) return;

  const frag = document.createDocumentFragment();
  for (const item of items) {
    frag.appendChild(createEditorItem(item, editorAthleteId, editorSessionId));
  }
  listEl.append(frag);
}

function syncSessionAssignBanner() {
  const banner = document.getElementById('session-assign-banner');
  const textEl = document.getElementById('session-assign-banner-text');
  if (!banner) return;

  const label = getSessionAssignLabel();
  const show = Boolean(label);
  banner.hidden = !show;
  if (textEl) textEl.textContent = label;
}

function createSessionMiniCard(item) {
  const ex = item.exercise;
  const id = String(ex?.id || item.exerciseId || '');
  const name = exerciseName(ex) || id || '—';

  const card = document.createElement('article');
  card.className = 'student-session-mini';
  if (id) card.dataset.id = id;

  const media = document.createElement('div');
  media.className = 'student-session-mini-media';
  const imageSrc = assetUrl(ex?.image || ex?.gif_url);
  if (imageSrc) {
    const thumb = document.createElement('img');
    thumb.className = 'student-session-mini-thumb';
    thumb.alt = name;
    thumb.loading = 'lazy';
    thumb.src = imageSrc;
    thumb.addEventListener('load', () => media.classList.add('has-image'), { once: true });
    thumb.addEventListener('error', () => {
      thumb.remove();
      media.classList.add('is-fallback');
      media.textContent = name.slice(0, 1).toUpperCase() || '?';
    }, { once: true });
    media.append(thumb);
  } else {
    media.classList.add('is-fallback');
    media.textContent = name.slice(0, 1).toUpperCase() || '?';
  }

  const main = document.createElement('div');
  main.className = 'student-session-mini-main';

  const nameEl = document.createElement('h4');
  nameEl.className = 'student-session-mini-name';
  nameEl.textContent = name;

  main.append(nameEl);
  appendPrescriptionDetail(main, item, {
    rxClass: 'student-session-mini-rx',
    chipClass: 'student-session-mini-chip',
    bareClass: 'student-session-mini-bare',
    noteClass: 'student-session-mini-note',
  });
  card.append(media, main);
  return card;
}

function appendPrescriptionDetail(parent, item, {
  rxClass,
  chipClass,
  bareClass,
  noteClass,
}) {
  const lines = prescriptionLines(item);
  const note = prescriptionNote(item);

  const rx = document.createElement('div');
  rx.className = rxClass;

  if (lines.length) {
    for (const line of lines) {
      const chip = document.createElement('span');
      chip.className = chipClass;
      const ico = document.createElement('span');
      ico.setAttribute('aria-hidden', 'true');
      ico.textContent = line.ico;
      const text = document.createElement('span');
      text.textContent = line.text;
      chip.append(ico, text);
      rx.append(chip);
    }
  } else {
    const bare = document.createElement('span');
    bare.className = bareClass;
    bare.textContent = ui('programBare');
    rx.append(bare);
  }
  parent.append(rx);

  if (note) {
    const noteEl = document.createElement('p');
    noteEl.className = noteClass;
    noteEl.textContent = note;
    noteEl.title = note;
    parent.append(noteEl);
  }
}

function createEditorItem(item, athleteId, sessionId) {
  const ex = item.exercise;
  const id = String(ex?.id || item.exerciseId || '');
  const name = exerciseName(ex) || id || '—';

  const row = document.createElement('article');
  row.className = 'session-editor-item';
  if (id) row.dataset.id = id;

  const media = document.createElement('div');
  media.className = 'session-editor-item-media';
  const thumb = document.createElement('img');
  thumb.className = 'session-editor-thumb';
  thumb.alt = name;
  thumb.loading = 'lazy';
  const imageSrc = assetUrl(ex?.image || ex?.gif_url);
  if (imageSrc) {
    thumb.src = imageSrc;
    thumb.addEventListener('load', () => media.classList.add('has-image'), { once: true });
    thumb.addEventListener('error', () => {
      thumb.remove();
      media.classList.add('is-fallback');
      media.textContent = name.slice(0, 1).toUpperCase() || '?';
    }, { once: true });
    media.append(thumb);
  } else {
    media.classList.add('is-fallback');
    media.textContent = name.slice(0, 1).toUpperCase() || '?';
  }

  const main = document.createElement('div');
  main.className = 'session-editor-item-main';

  const nameEl = document.createElement('h3');
  nameEl.className = 'session-editor-item-name';
  nameEl.textContent = name;

  main.append(nameEl);
  appendPrescriptionDetail(main, item, {
    rxClass: 'session-editor-item-rx',
    chipClass: 'session-editor-rx-chip',
    bareClass: 'session-editor-rx-bare',
    noteClass: 'session-editor-item-note',
  });

  const actions = document.createElement('div');
  actions.className = 'session-editor-item-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'session-editor-item-edit';
  editBtn.textContent = ui('sessionEditExercise');
  editBtn.addEventListener('click', () => {
    editSessionExercise(athleteId, sessionId, id);
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'session-editor-item-remove';
  removeBtn.setAttribute('aria-label', ui('sessionRemoveExercise'));
  removeBtn.title = ui('sessionRemoveExercise');
  removeBtn.innerHTML = `
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
      <path d="M4 4l8 8M12 4L4 12"/>
    </svg>
  `;
  removeBtn.addEventListener('click', () => {
    removeExerciseFromSession(athleteId, sessionId, id);
  });

  actions.append(editBtn, removeBtn);
  row.append(media, main, actions);
  return row;
}

function findAthlete(athleteId) {
  return athletes.find(a => String(a?.id) === String(athleteId)) || null;
}

function findSession(athleteId, sessionId) {
  const athlete = findAthlete(athleteId);
  if (!athlete) return null;
  return getAthleteSessions(athlete).find(s => String(s?.id) === String(sessionId)) || null;
}

function athleteDisplayName(athlete) {
  const first = String(athlete?.firstName || '').trim();
  const last = String(athlete?.lastName || '').trim();
  const email = String(athlete?.email || '').trim();
  return [first, last].filter(Boolean).join(' ') || email || '—';
}

function getAthleteSessions(athlete) {
  const prog = athlete?.coachTrainingProgram;
  if (!Array.isArray(prog) || !isSessionsShape(prog)) return [];
  return [...prog].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
}

function isSessionsShape(prog) {
  if (!prog.length) return true;
  return prog.every(s => (
    s
    && typeof s.name === 'string'
    && Array.isArray(s.items)
    && s.exerciseId == null
  ));
}

function ensureAthleteSessions(athlete) {
  if (!isSessionsShape(athlete.coachTrainingProgram || [])) {
    athlete.coachTrainingProgram = [];
  } else if (!Array.isArray(athlete.coachTrainingProgram)) {
    athlete.coachTrainingProgram = [];
  }
  return athlete.coachTrainingProgram;
}

function newLocalSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function onDownloadAthlete(_athleteId) {
  // Shell: Excel export TBD (docs/TODO.md)
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

function toggleSessionRow(row) {
  const opening = !row.classList.contains('is-open');
  const parent = row.closest('.student-row');
  parent?.querySelectorAll('.student-session.is-open').forEach(other => {
    if (other !== row) closeSessionRow(other);
  });
  if (opening) openSessionRow(row);
  else closeSessionRow(row);
}

function openSessionRow(row) {
  const header = row.querySelector('.student-session-header');
  row.classList.add('is-open');
  if (header) header.setAttribute('aria-expanded', 'true');
  openSessionId = row.dataset.sessionId || null;
}

function closeSessionRow(row) {
  const header = row.querySelector('.student-session-header');
  row.classList.remove('is-open');
  if (header) header.setAttribute('aria-expanded', 'false');
  if (openSessionId && row.dataset.sessionId === openSessionId) openSessionId = null;
}

function setSessionStatus(message, kind = '') {
  if (!sessionStatusEl) return;
  if (!message) {
    sessionStatusEl.hidden = true;
    sessionStatusEl.textContent = '';
    sessionStatusEl.classList.remove('is-error', 'is-ok');
    return;
  }
  sessionStatusEl.hidden = false;
  sessionStatusEl.textContent = message;
  sessionStatusEl.classList.toggle('is-error', kind === 'error');
  sessionStatusEl.classList.toggle('is-ok', kind === 'ok');
}

function onAddSessionSubmit(e) {
  e.preventDefault();
  const athleteId = sessionAthleteId;
  const athlete = athletes.find(a => String(a?.id) === String(athleteId));
  if (!athlete) return;

  const name = (sessionNameInput?.value || '').trim();
  if (!name) return;

  const sessions = ensureAthleteSessions(athlete);
  const session = {
    id: newLocalSessionId(),
    name,
    order: sessions.length,
    items: [],
  };
  sessions.push(session);

  // Shell only — persist via API later
  openAthleteId = String(athleteId);
  openSessionId = session.id;
  closeAddSessionModal();
  renderStudentsList();
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
  const header = row.querySelector('.student-row-header');
  row.classList.add('is-open');
  if (header) header.setAttribute('aria-expanded', 'true');
  openAthleteId = row.dataset.id || null;
}

function closeStudentRow(row) {
  const header = row.querySelector('.student-row-header');
  row.classList.remove('is-open');
  if (header) header.setAttribute('aria-expanded', 'false');
  if (openAthleteId && row.dataset.id === openAthleteId) openAthleteId = null;
}

function clearCloseTimer() {
  if (!closeTimer) return;
  window.clearTimeout(closeTimer);
  closeTimer = 0;
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

function stopSubmitFill() {
  if (!submitFill) return;
  submitFill.hidden = true;
  submitFill.style.animation = 'none';
  submitFill.style.width = '0%';
}

function startSubmitFill() {
  if (!submitFill) return;
  submitFill.hidden = false;
  submitFill.style.width = '';
  submitFill.style.animation = 'none';
  void submitFill.offsetWidth;
  submitFill.style.animation = '';
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

function inviteErrorMessage(err) {
  const status = err?.status;
  const raw = Array.isArray(err?.message) ? err.message.join(' ') : String(err?.message || '');
  const lower = raw.toLowerCase();

  if (status === 404) return ui('inviteNotFound');
  if (status === 409) {
    if (lower.includes('pending')) return ui('invitePending');
    return ui('inviteHasCoach');
  }
  return ui('inviteFail');
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
