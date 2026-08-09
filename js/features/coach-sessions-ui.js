/**
 * Coach — athlete training sessions: accordion, editor, catalog assign, Guardar plan.
 * Markup: #session-editor-view, #add-session-overlay, #session-assign-banner
 * State: coach-athletes-store.js · List shell: students-ui.js
 */
import { putCoachAthleteTrainingProgram } from '../api/users.js';
import { assetUrl } from '../utils/assets.js';
import { exerciseName, ui } from '../utils/labels.js';
import { prescriptionLines, prescriptionNote } from '../utils/prescription.js';
import {
  store,
  findAthlete,
  findSession,
  athleteDisplayName,
  getAthleteSessions,
  ensureAthleteSessions,
  isAthleteDirty,
  markAthleteDirty,
  clearAthleteDirty,
} from './coach-athletes-store.js';

const ICON_CLOSE_SVG = `
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
    <path d="M4 4l8 8M12 4L4 12"/>
  </svg>
`;

let sessionOverlay;
let sessionForm;
let sessionNameInput;
let sessionStatusEl;
let sessionSubmitBtn;
let sessionAthleteId = null;
let removeSessionOverlay;
let removeSessionTitle;
let removeSessionLead;
let pendingRemoveSession = null;

// ── Init / labels ─────────────────────────────────────────────────────
export function initCoachSessionsUi() {
  sessionOverlay = document.getElementById('add-session-overlay');
  sessionForm = document.getElementById('add-session-form');
  sessionNameInput = document.getElementById('add-session-name');
  sessionStatusEl = document.getElementById('add-session-status');
  sessionSubmitBtn = document.getElementById('add-session-submit');
  removeSessionOverlay = document.getElementById('remove-session-overlay');
  removeSessionTitle = document.getElementById('remove-session-title');
  removeSessionLead = document.getElementById('remove-session-lead');

  document.getElementById('add-session-close')?.addEventListener('click', closeAddSessionModal);
  document.getElementById('remove-session-close')?.addEventListener('click', closeRemoveSessionModal);
  document.getElementById('remove-session-cancel')?.addEventListener('click', closeRemoveSessionModal);
  document.getElementById('remove-session-confirm')?.addEventListener('click', confirmRemoveSession);
  document.getElementById('session-editor-back')?.addEventListener('click', () => {
    store.editorAthleteId = null;
    store.editorSessionId = null;
    store.navigateTo('students');
  });
  document.getElementById('session-editor-add')?.addEventListener('click', () => {
    if (store.editorAthleteId && store.editorSessionId) {
      beginSessionAssign(store.editorAthleteId, store.editorSessionId);
    }
  });
  const sessionNameEditor = document.getElementById('session-editor-name');
  sessionNameEditor?.addEventListener('change', commitSessionEditorName);
  sessionNameEditor?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      revertSessionEditorName(e.currentTarget);
      e.currentTarget.blur();
    }
  });
  document.getElementById('session-assign-done')?.addEventListener('click', () => {
    clearSessionAssignTarget();
    if (store.editorAthleteId && store.editorSessionId) store.navigateTo('session-editor');
    else store.navigateTo('students');
  });
  sessionOverlay?.addEventListener('click', e => {
    if (e.target === sessionOverlay) closeAddSessionModal();
  });
  removeSessionOverlay?.addEventListener('click', e => {
    if (e.target === removeSessionOverlay) closeRemoveSessionModal();
  });
  sessionForm?.addEventListener('submit', onAddSessionSubmit);

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (removeSessionOverlay?.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeRemoveSessionModal();
      return;
    }
    if (sessionOverlay?.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeAddSessionModal();
    }
  });
}

export function syncCoachSessionsLabels() {
  document.querySelectorAll(
    '#session-editor-view [data-ui], #session-assign-banner [data-ui], #add-session-overlay [data-ui], #remove-session-overlay [data-ui]',
  ).forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });

  if (sessionNameInput && !sessionOverlay?.classList.contains('open')) {
    sessionNameInput.placeholder = ui('addSessionNamePlaceholder');
  }
  const sessionNameEditor = document.getElementById('session-editor-name');
  if (sessionNameEditor) {
    sessionNameEditor.setAttribute('aria-label', ui('addSessionName'));
    sessionNameEditor.placeholder = ui('addSessionNamePlaceholder');
  }
  if (removeSessionOverlay?.classList.contains('open') && pendingRemoveSession) {
    syncRemoveSessionCopy(pendingRemoveSession.name);
  }

  syncSessionEditorView();
  syncSessionAssignBanner();
}

export function resetCoachSessionsUi() {
  sessionAthleteId = null;
  closeAddSessionModal();
  closeRemoveSessionModal();
  clearSessionAssignTarget();
}

/** Plan block inside an athlete accordion row (sessions + dirty + save). */
export function createAthletePlan(athlete) {
  const id = String(athlete?.id || '');
  const sessions = getAthleteSessions(athlete);

  const plan = document.createElement('div');
  plan.className = 'student-plan';

  const planHead = document.createElement('div');
  planHead.className = 'student-plan-head';

  const planTitle = document.createElement('span');
  planTitle.className = 'student-plan-title';
  planTitle.textContent = ui('sessionsHeading');

  const planHeadActions = document.createElement('div');
  planHeadActions.className = 'student-plan-head-actions';

  const addSessionBtn = document.createElement('button');
  addSessionBtn.type = 'button';
  addSessionBtn.className = 'student-plan-add';
  addSessionBtn.textContent = ui('addSession');
  addSessionBtn.addEventListener('click', e => {
    e.stopPropagation();
    openAddSessionModal(id);
  });
  planHeadActions.append(addSessionBtn);

  if (isAthleteDirty(id)) {
    const dirty = document.createElement('span');
    dirty.className = 'student-plan-dirty';
    dirty.textContent = ui('athletePlanUnsaved');
    planHeadActions.prepend(dirty);
  }

  planHead.append(planTitle, planHeadActions);

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

  if (isAthleteDirty(id) || store.savingAthleteIds.has(id) || store.saveErrorByAthleteId.has(id)) {
    plan.append(createPlanSaveBar(id));
  }

  return plan;
}

export function collapseOpenSessionsIn(row) {
  row?.querySelectorAll('.student-session.is-open').forEach(closeSessionRow);
}

// ── Add session modal ─────────────────────────────────────────────────
// ── Add session modal ─────────────────────────────────────────────────
export function openAddSessionModal(athleteId) {
  if (!sessionOverlay || !sessionForm) return;
  const athlete = store.athletes.find(a => String(a?.id) === String(athleteId));
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

function onAddSessionSubmit(e) {
  e.preventDefault();
  const athleteId = sessionAthleteId;
  const athlete = store.athletes.find(a => String(a?.id) === String(athleteId));
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

  markAthleteDirty(athleteId);
  store.openAthleteId = String(athleteId);
  store.openSessionId = session.id;
  closeAddSessionModal();
  store.refreshList();
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

function openRemoveSessionModal(athleteId, sessionId, sessionName) {
  if (!removeSessionOverlay) return;
  pendingRemoveSession = {
    athleteId: String(athleteId),
    sessionId: String(sessionId),
    name: String(sessionName || '').trim() || '—',
  };
  syncRemoveSessionCopy(pendingRemoveSession.name);
  removeSessionOverlay.classList.add('open');
  document.getElementById('remove-session-confirm')?.focus();
}

function closeRemoveSessionModal() {
  pendingRemoveSession = null;
  removeSessionOverlay?.classList.remove('open');
}

function syncRemoveSessionCopy(sessionName) {
  if (removeSessionTitle) {
    const nameEl = document.createElement('span');
    nameEl.className = 'confirm-modal-name';
    nameEl.textContent = sessionName;
    removeSessionTitle.replaceChildren(
      document.createTextNode(ui('sessionRemoveTitleBefore')),
      nameEl,
      document.createTextNode(ui('sessionRemoveTitleAfter')),
    );
  }
  if (removeSessionLead) {
    removeSessionLead.textContent = ui('sessionRemoveConfirm');
  }
}

function confirmRemoveSession() {
  const pending = pendingRemoveSession;
  if (!pending) return;
  const { athleteId, sessionId } = pending;
  closeRemoveSessionModal();
  removeSessionFromAthlete(athleteId, sessionId);
}

// ── Session accordion ─────────────────────────────────────────────────
// ── Session accordion ─────────────────────────────────────────────────
function createSessionRow(session, athleteId) {
  const id = String(session?.id || '');
  const name = String(session?.name || '').trim() || '—';
  const items = Array.isArray(session?.items) ? session.items : [];

  const row = document.createElement('div');
  row.className = 'student-session';
  if (id) row.dataset.sessionId = id;

  const top = document.createElement('div');
  top.className = 'student-session-top';

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'student-session-header';
  header.setAttribute('aria-expanded', 'false');

  const nameEl = document.createElement('span');
  nameEl.className = 'student-session-name';
  nameEl.textContent = name;

  const meta = createSessionMetaChips(items);

  const chevron = document.createElement('span');
  chevron.className = 'student-session-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  header.append(nameEl, meta, chevron);

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'student-session-remove';
  removeBtn.setAttribute('aria-label', ui('sessionRemove'));
  removeBtn.title = ui('sessionRemove');
  removeBtn.innerHTML = ICON_CLOSE_SVG;
  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    openRemoveSessionModal(athleteId, id, name);
  });

  top.append(header, removeBtn);

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

  row.append(top, body);

  if (store.openSessionId && store.openSessionId === id) openSessionRow(row);

  return row;
}

function createSessionMiniCard(item) {
  const ex = item.exercise;
  const id = String(ex?.id || item.exerciseId || '');
  const name = exerciseName(ex) || id || '—';

  const card = document.createElement('article');
  card.className = 'student-session-mini';
  if (id) card.dataset.id = id;

  const media = createExerciseMedia(ex, name, {
    mediaClass: 'student-session-mini-media',
    thumbClass: 'student-session-mini-thumb',
  });

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

function createSessionMetaChips(items) {
  const list = Array.isArray(items) ? items : [];
  const wrap = document.createElement('span');
  wrap.className = 'student-session-meta';
  wrap.setAttribute('aria-label', sessionAccordionMeta(list));

  wrap.appendChild(createSessionStatChip(
    list.length,
    ui('sessionExercisesUnit', list.length),
    'student-session-stat',
  ));

  if (list.length) {
    const sets = totalSessionSets(list);
    wrap.appendChild(createSessionStatChip(
      sets,
      ui('sessionSetsUnit', sets),
      'student-session-stat student-session-stat--sets',
    ));
  }

  return wrap;
}

function createSessionStatChip(value, unit, className) {
  const chip = document.createElement('span');
  chip.className = className;
  chip.setAttribute('aria-hidden', 'true');

  const num = document.createElement('strong');
  num.className = 'student-session-stat-value';
  num.textContent = String(value);

  const label = document.createElement('span');
  label.className = 'student-session-stat-unit';
  label.textContent = unit;

  chip.append(num, label);
  return chip;
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
  store.openSessionId = row.dataset.sessionId || null;
}

function closeSessionRow(row) {
  const header = row.querySelector('.student-session-header');
  row.classList.remove('is-open');
  if (header) header.setAttribute('aria-expanded', 'false');
  if (store.openSessionId && row.dataset.sessionId === store.openSessionId) store.openSessionId = null;
}

// ── Session editor ────────────────────────────────────────────────────
// ── Session editor ────────────────────────────────────────────────────
export function openSessionEditor(athleteId, sessionId) {
  const athlete = findAthlete(athleteId);
  const session = findSession(athleteId, sessionId);
  if (!athlete || !session) return;

  store.editorAthleteId = String(athleteId);
  store.editorSessionId = String(sessionId);
  store.openAthleteId = store.editorAthleteId;
  store.openSessionId = store.editorSessionId;
  clearSessionAssignTarget();
  store.navigateTo('session-editor');
}

export function syncSessionEditorView() {
  const view = document.getElementById('session-editor-view');
  if (!view || view.hidden) return;

  const nameInput = document.getElementById('session-editor-name');
  const subtitleEl = document.getElementById('session-editor-subtitle');
  const listEl = document.getElementById('session-editor-list');
  if (!listEl) return;

  const athlete = findAthlete(store.editorAthleteId);
  const session = findSession(store.editorAthleteId, store.editorSessionId);

  if (!athlete || !session) {
    listEl.replaceChildren();
    if (nameInput && document.activeElement !== nameInput) {
      nameInput.value = '';
    }
    if (subtitleEl) subtitleEl.textContent = '';
    return;
  }

  if (nameInput && document.activeElement !== nameInput) {
    nameInput.value = String(session.name || '').trim();
  }
  if (subtitleEl) {
    const items = Array.isArray(session.items) ? session.items : [];
    subtitleEl.textContent = `${athleteDisplayName(athlete)} · ${sessionAccordionMeta(items)}`;
  }

  listEl.replaceChildren();
  const items = [...(session.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!items.length) return;

  const frag = document.createDocumentFragment();
  for (const item of items) {
    frag.appendChild(createEditorItem(item, store.editorAthleteId, store.editorSessionId));
  }
  listEl.append(frag);
}

function createEditorItem(item, athleteId, sessionId) {
  const ex = item.exercise;
  const id = String(ex?.id || item.exerciseId || '');
  const name = exerciseName(ex) || id || '—';

  const row = document.createElement('article');
  row.className = 'session-editor-item';
  if (id) row.dataset.id = id;

  const media = createExerciseMedia(ex, name, {
    mediaClass: 'session-editor-item-media',
    thumbClass: 'session-editor-thumb',
  });

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
  removeBtn.innerHTML = ICON_CLOSE_SVG;
  removeBtn.addEventListener('click', () => {
    removeExerciseFromSession(athleteId, sessionId, id);
  });

  actions.append(editBtn, removeBtn);
  row.append(media, main, actions);
  return row;
}

function revertSessionEditorName(input) {
  const session = findSession(store.editorAthleteId, store.editorSessionId);
  if (input) input.value = String(session?.name || '').trim();
}

function commitSessionEditorName(e) {
  const input = e?.currentTarget || document.getElementById('session-editor-name');
  if (!input || !store.editorAthleteId || !store.editorSessionId) return;

  const next = String(input.value || '').trim();
  if (!next) {
    revertSessionEditorName(input);
    return;
  }

  renameSession(store.editorAthleteId, store.editorSessionId, next);
}

export function renameSession(athleteId, sessionId, name) {
  const session = findSession(athleteId, sessionId);
  if (!session) return false;

  const next = String(name || '').trim().slice(0, 40);
  if (!next || next === String(session.name || '').trim()) {
    const input = document.getElementById('session-editor-name');
    if (input && document.activeElement !== input) input.value = String(session.name || '').trim();
    return false;
  }

  session.name = next;

  if (store.sessionAssignTarget
    && String(store.sessionAssignTarget.athleteId) === String(athleteId)
    && String(store.sessionAssignTarget.sessionId) === String(sessionId)) {
    store.sessionAssignTarget.sessionName = next;
    syncSessionAssignBanner();
  }

  touchPlanUi(athleteId);
  return true;
}

// ── Catalog assign mode ───────────────────────────────────────────────
// ── Catalog assign mode ───────────────────────────────────────────────
export function beginSessionAssign(athleteId, sessionId) {
  const athlete = findAthlete(athleteId);
  const session = findSession(athleteId, sessionId);
  if (!athlete || !session) return;

  store.editorAthleteId = String(athleteId);
  store.editorSessionId = String(sessionId);
  store.navigateTo('catalog');
  armSessionAssignTarget(athlete, session);
}

/** Open modal to edit an exercise already in the session (stay in editor). */
export function editSessionExercise(athleteId, sessionId, exerciseId) {
  const athlete = findAthlete(athleteId);
  const session = findSession(athleteId, sessionId);
  if (!athlete || !session || !exerciseId) return;
  if (!isExerciseInSession(athleteId, sessionId, exerciseId)) return;

  store.editorAthleteId = String(athleteId);
  store.editorSessionId = String(sessionId);
  armSessionAssignTarget(athlete, session);
  store.openExercise(String(exerciseId));
}

function armSessionAssignTarget(athlete, session) {
  store.sessionAssignTarget = {
    athleteId: String(athlete.id),
    sessionId: String(session.id),
    sessionName: String(session.name || '').trim(),
    athleteName: athleteDisplayName(athlete),
  };
  syncSessionAssignBanner();
}

export function clearSessionAssignTarget() {
  store.sessionAssignTarget = null;
  syncSessionAssignBanner();
}

export function getSessionAssignTarget() {
  return store.sessionAssignTarget;
}

export function getSessionAssignLabel() {
  const target = store.sessionAssignTarget;
  if (!target) return '';
  const athlete = findAthlete(target.athleteId);
  const session = findSession(target.athleteId, target.sessionId);
  if (!athlete || !session) return '';
  const athleteName = athleteDisplayName(athlete);
  return ui('sessionAssignTo', session.name, athleteName);
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

// ── Session mutations (local + dirty) ─────────────────────────────────
// ── Session mutations (local + dirty) ─────────────────────────────────
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
  touchPlanUi(athleteId);
  return true;
}

export function updateSessionExercise(athleteId, sessionId, exerciseId, updates) {
  const item = getSessionExerciseItem(athleteId, sessionId, exerciseId);
  if (!item || !updates) return false;

  if ('sets' in updates) item.sets = updates.sets;
  if ('reps' in updates) item.reps = updates.reps;
  if ('rest' in updates) item.rest = updates.rest;
  if ('notes' in updates) {
    const notes = String(updates.notes ?? '').trim();
    if (notes) item.notes = notes;
    else delete item.notes;
  }

  touchPlanUi(athleteId);
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

  touchPlanUi(athleteId);
  return true;
}

/** Local remove — persists with Guardar plan (full PUT replace). */
export function removeSessionFromAthlete(athleteId, sessionId) {
  const athlete = findAthlete(athleteId);
  if (!athlete) return false;

  const sessions = ensureAthleteSessions(athlete);
  const key = String(sessionId || '');
  const before = sessions.length;
  athlete.coachTrainingProgram = sessions.filter(s => String(s?.id) !== key);
  athlete.coachTrainingProgram.forEach((s, i) => { s.order = i; });
  if (athlete.coachTrainingProgram.length === before) return false;

  if (store.openSessionId === key) store.openSessionId = null;

  if (store.sessionAssignTarget
    && String(store.sessionAssignTarget.athleteId) === String(athleteId)
    && String(store.sessionAssignTarget.sessionId) === key) {
    clearSessionAssignTarget();
  }

  if (String(store.editorAthleteId) === String(athleteId) && String(store.editorSessionId) === key) {
    store.editorAthleteId = null;
    store.editorSessionId = null;
    const editorView = document.getElementById('session-editor-view');
    if (editorView && !editorView.hidden) store.navigateTo('students');
  }

  touchPlanUi(athleteId);
  return true;
}

// ── Plan dirty + save (PUT) ───────────────────────────────────────────
/** PUT body shape: sessions + items with exerciseId only (no populated exercise). */
export function serializeCoachTrainingProgram(athlete) {
  return getAthleteSessions(athlete).map((session, index) => ({
    id: String(session.id),
    name: String(session.name || '').trim(),
    order: session.order ?? index,
    items: (session.items || []).map((item, itemIndex) => {
      const payload = {
        exerciseId: String(item.exercise?.id || item.exerciseId || ''),
        order: item.order ?? itemIndex,
      };
      if (item.sets != null) payload.sets = item.sets;
      if (item.reps) payload.reps = String(item.reps);
      if (item.rest != null) payload.rest = item.rest;
      if (item.notes != null && String(item.notes).trim() !== '') {
        payload.notes = String(item.notes).trim();
      }
      return payload;
    }),
  }));
}

function createPlanSaveBar(athleteId) {
  const id = String(athleteId);
  const bar = document.createElement('div');
  bar.className = 'student-plan-save-bar';

  const errMsg = store.saveErrorByAthleteId.get(id);
  if (errMsg) {
    const errEl = document.createElement('p');
    errEl.className = 'student-plan-save-error';
    errEl.textContent = errMsg;
    bar.append(errEl);
  }

  const saving = store.savingAthleteIds.has(id);
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'student-plan-save';
  btn.disabled = saving;
  btn.textContent = saving ? ui('savingAthletePlan') : ui('saveAthletePlan');
  btn.addEventListener('click', e => {
    e.stopPropagation();
    void saveAthletePlan(athleteId);
  });

  bar.append(btn);
  return bar;
}

/** PUT /users/coach/store.athletes/:id/training-program — full replace. */
async function saveAthletePlan(athleteId) {
  const id = String(athleteId || '');
  const athlete = findAthlete(id);
  if (!athlete || store.savingAthleteIds.has(id)) return;

  const coachTrainingProgram = serializeCoachTrainingProgram(athlete);

  store.savingAthleteIds.add(id);
  store.saveErrorByAthleteId.delete(id);
  syncSessionEditorView();
  store.refreshList();

  try {
    const updated = await putCoachAthleteTrainingProgram(id, coachTrainingProgram);
    if (Array.isArray(updated?.coachTrainingProgram)) {
      athlete.coachTrainingProgram = updated.coachTrainingProgram;
    }
    clearAthleteDirty(id);
  } catch (err) {
    console.error(err);
    store.saveErrorByAthleteId.set(id, ui('athletePlanSaveFail'));
  } finally {
    store.savingAthleteIds.delete(id);
    syncSessionEditorView();
    store.refreshList();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────
function touchPlanUi(athleteId) {
  markAthleteDirty(athleteId);
  syncSessionEditorView();
  store.refreshList();
}

function createExerciseMedia(ex, name, { mediaClass, thumbClass }) {
  const media = document.createElement('div');
  media.className = mediaClass;
  const imageSrc = assetUrl(ex?.image || ex?.gif_url);
  if (!imageSrc) {
    media.classList.add('is-fallback');
    media.textContent = name.slice(0, 1).toUpperCase() || '?';
    return media;
  }

  const thumb = document.createElement('img');
  thumb.className = thumbClass;
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
  return media;
}

function newLocalSessionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Sum of items[].sets (missing / invalid → 0). Derived — not stored in API. */
function totalSessionSets(items) {
  return (items || []).reduce((sum, item) => {
    const n = Number(item?.sets);
    return sum + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  }, 0);
}

function sessionAccordionMeta(items) {
  const list = Array.isArray(items) ? items : [];
  const parts = [ui('sessionExercisesCount', list.length)];
  if (list.length) parts.push(ui('sessionSetsCount', totalSessionSets(list)));
  return parts.join(' · ');
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
