/**
 * Coach — athlete training sessions: accordion, editor, catalog assign, Guardar plan.
 * Markup: #session-editor-view, #add-session-overlay, #session-assign-banner
 * State: coach-athletes-store.js · List shell: students-ui.js
 */
import { putCoachAthleteTrainingProgram, putCoachTemplates, postCoachTemplate } from '../api/users.js';
import { assetUrl } from '../utils/assets.js';
import {
  createFeatureHint,
  dismissFeatureHintById,
} from '../utils/feature-hints.js';
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
  isTemplatesScope,
} from './coach-athletes-store.js';

const ICON_CLOSE_SVG = `
  <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true">
    <path d="M4 4l8 8M12 4L4 12"/>
  </svg>
`;

/** @type {{ kind: 'session' | 'exercise', athleteId: string, sessionId?: string, id: string } | null} */
let activeDrag = null;

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
    const fromTemplates = isTemplatesScope(store.editorAthleteId);
    store.editorAthleteId = null;
    store.editorSessionId = null;
    store.navigateTo(fromTemplates ? 'coach-templates' : 'students');
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
    else store.navigateTo(isTemplatesScope(store.editorAthleteId) ? 'coach-templates' : 'students');
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
  const backLabel = document.querySelector('#session-editor-back [data-ui="sessionEditorBack"]');
  if (backLabel) {
    backLabel.textContent = isTemplatesScope(store.editorAthleteId)
      ? ui('coachTemplates')
      : ui('sessionEditorBack');
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
  planTitle.textContent = isTemplatesScope(id)
    ? ui('coachTemplatesListHeading')
    : ui('sessionsHeading');

  const planHeadActions = document.createElement('div');
  planHeadActions.className = 'student-plan-head-actions';

  const addSessionBtn = document.createElement('button');
  addSessionBtn.type = 'button';
  addSessionBtn.className = 'student-plan-add';
  addSessionBtn.textContent = isTemplatesScope(id)
    ? ui('addTemplate')
    : ui('addSession');
  addSessionBtn.addEventListener('click', e => {
    e.stopPropagation();
    openAddSessionModal(id);
  });
  planHeadActions.append(addSessionBtn);

  if (!isTemplatesScope(id)) {
    const useTemplateBtn = document.createElement('button');
    useTemplateBtn.type = 'button';
    useTemplateBtn.className = 'student-plan-use-template';
    useTemplateBtn.textContent = ui('useTemplate');
    useTemplateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (typeof store.requestUseTemplatesForAthlete === 'function') {
        store.requestUseTemplatesForAthlete(athlete);
      }
    });
    planHeadActions.append(useTemplateBtn);
  }

  if (isAthleteDirty(id)) {
    const dirty = document.createElement('span');
    dirty.className = 'student-plan-dirty';
    dirty.textContent = isTemplatesScope(id)
      ? ui('coachTemplatesUnsaved')
      : ui('athletePlanUnsaved');
    planHeadActions.prepend(dirty);
  }

  planHead.append(planTitle, planHeadActions);

  const sessionList = document.createElement('div');
  sessionList.className = 'student-session-list';

  if (sessions.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'student-plan-empty';
    empty.textContent = isTemplatesScope(id)
      ? ui('coachTemplatesEmpty')
      : ui('sessionsEmpty');
    sessionList.append(empty);
  } else {
    for (const session of sessions) {
      sessionList.appendChild(createSessionRow(session, id));
    }
  }

  plan.append(planHead);

  if (sessions.length >= 2) {
    const tip = createFeatureHint({
      id: 'reorder-sessions',
      text: ui('hintReorderSessions'),
      dismissLabel: ui('hintDismiss'),
      className: 'feature-hint--plan',
    });
    if (tip) plan.append(tip);
  }

  plan.append(sessionList);

  if (isAthleteDirty(id) || store.savingAthleteIds.has(id) || store.saveErrorByAthleteId.has(id)) {
    plan.append(createPlanSaveBar(id));
  }

  return plan;
}

export function collapseOpenSessionsIn(row) {
  row?.querySelectorAll('.student-session.is-open').forEach(closeSessionRow);
}

// ── Add session modal ─────────────────────────────────────────────────
export function openAddSessionModal(athleteId) {
  if (!sessionOverlay || !sessionForm) return;
  const athlete = findAthlete(athleteId);
  if (!athlete) return;

  sessionAthleteId = String(athleteId);
  setSessionStatus('');
  sessionForm.reset();
  const next = getAthleteSessions(athlete).length + 1;
  const defaultName = isTemplatesScope(athleteId)
    ? ui('addTemplateDefault', next)
    : ui('addSessionDefault', next);
  if (sessionNameInput) {
    sessionNameInput.placeholder = defaultName;
    sessionNameInput.value = defaultName;
  }
  if (sessionSubmitBtn) {
    sessionSubmitBtn.disabled = false;
    const label = sessionSubmitBtn.querySelector('[data-ui]') || sessionSubmitBtn;
    if (sessionSubmitBtn.querySelector('[data-ui]')) {
      label.dataset.ui = isTemplatesScope(athleteId) ? 'addTemplateSubmit' : 'addSessionSubmit';
      label.textContent = ui(label.dataset.ui);
    }
  }
  const titleEl = sessionOverlay.querySelector('[data-ui="addSessionTitle"]');
  if (titleEl) {
    titleEl.textContent = isTemplatesScope(athleteId)
      ? ui('addTemplateTitle')
      : ui('addSessionTitle');
  }
  const hintEl = sessionOverlay.querySelector('[data-ui="addSessionHint"]');
  if (hintEl) {
    hintEl.textContent = isTemplatesScope(athleteId)
      ? ui('addTemplateHint')
      : ui('addSessionHint');
  }
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

async function onAddSessionSubmit(e) {
  e.preventDefault();
  const athleteId = sessionAthleteId;
  const athlete = findAthlete(athleteId);
  if (!athlete) return;

  const name = (sessionNameInput?.value || '').trim();
  if (!name) return;

  if (isTemplatesScope(athleteId)) {
    await createTemplateOnServer(athleteId, name);
    return;
  }

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

async function createTemplateOnServer(athleteId, name) {
  if (sessionSubmitBtn) sessionSubmitBtn.disabled = true;
  setSessionStatus('');
  try {
    const res = await postCoachTemplate({ name });
    const created = res?.template;
    if (!created?.id) throw new Error('template_missing');

    const current = Array.isArray(store.templates) ? store.templates : [];
    store.templates = [...current, created];
    clearAthleteDirty(athleteId);
    store.openAthleteId = String(athleteId);
    store.openSessionId = String(created.id);
    closeAddSessionModal();
    store.refreshTemplatesList?.();
  } catch (err) {
    console.error(err);
    setSessionStatus(ui('addTemplateCreateFail'), 'error');
  } finally {
    if (sessionSubmitBtn) sessionSubmitBtn.disabled = false;
  }
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
function createSessionRow(session, athleteId) {
  const id = String(session?.id || '');
  const name = String(session?.name || '').trim() || '—';
  const items = Array.isArray(session?.items) ? session.items : [];

  const row = document.createElement('div');
  row.className = 'student-session is-draggable';
  if (id) row.dataset.sessionId = id;
  row.title = ui('sessionDragHandle');

  const top = document.createElement('div');
  top.className = 'student-session-top';

  const header = document.createElement('div');
  header.className = 'student-session-header';
  header.setAttribute('role', 'button');
  header.tabIndex = 0;
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

  if (isTemplatesScope(athleteId)) {
    const applyBtn = document.createElement('button');
    applyBtn.type = 'button';
    applyBtn.className = 'student-session-apply';
    applyBtn.textContent = ui('templateApply');
    applyBtn.disabled = items.length === 0;
    applyBtn.title = items.length ? ui('templateApply') : ui('templateApplyNeedsExercises');
    applyBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (typeof store.requestApplyTemplate === 'function') {
        store.requestApplyTemplate(session);
      }
    });
    actions.append(applyBtn);
  }

  body.append(actions);

  const onToggle = e => {
    e.stopPropagation();
    if (row.dataset.suppressClick === '1') {
      delete row.dataset.suppressClick;
      return;
    }
    toggleSessionRow(row);
  };
  header.addEventListener('click', onToggle);
  header.addEventListener('keydown', e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    onToggle(e);
  });

  row.append(top, body);
  wireCardDrag(row, {
    kind: 'session',
    athleteId: String(athleteId),
    id,
    itemSelector: '.student-session',
    ignoreSelector: '.student-session-remove, .student-session-edit, .student-session-actions button',
    onDragStart: () => {
      row.dataset.suppressClick = '1';
    },
  });

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
    syncSessionEditorReorderHint(0);
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
    const meta = sessionAccordionMeta(items);
    subtitleEl.textContent = isTemplatesScope(store.editorAthleteId)
      ? `${ui('coachTemplatesKicker')} · ${meta}`
      : `${athleteDisplayName(athlete)} · ${meta}`;
  }

  const backLabel = document.querySelector('#session-editor-back [data-ui="sessionEditorBack"]');
  if (backLabel) {
    backLabel.textContent = isTemplatesScope(store.editorAthleteId)
      ? ui('coachTemplates')
      : ui('sessionEditorBack');
  }
  const kicker = document.querySelector('#session-editor-view [data-ui="sessionEditorKicker"]');
  if (kicker) {
    kicker.textContent = isTemplatesScope(store.editorAthleteId)
      ? ui('coachTemplatesKicker')
      : ui('sessionEditorKicker');
  }

  syncSessionEditorReorderHint(
    [...(session.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)).length,
  );

  listEl.replaceChildren();
  const items = [...(session.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!items.length) return;

  const frag = document.createDocumentFragment();
  for (const item of items) {
    frag.appendChild(createEditorItem(item, store.editorAthleteId, store.editorSessionId));
  }
  listEl.append(frag);
}

function syncSessionEditorReorderHint(itemCount) {
  const host = document.getElementById('session-editor-hint');
  if (!host) return;
  host.replaceChildren();
  if (itemCount < 2) {
    host.hidden = true;
    return;
  }
  const tip = createFeatureHint({
    id: 'reorder-exercises',
    text: ui('hintReorderExercises'),
    dismissLabel: ui('hintDismiss'),
    className: 'feature-hint--editor',
  });
  if (!tip) {
    host.hidden = true;
    return;
  }
  host.hidden = false;
  host.append(tip);
}

function createEditorItem(item, athleteId, sessionId) {
  const ex = item.exercise;
  const id = String(ex?.id || item.exerciseId || '');
  const name = exerciseName(ex) || id || '—';

  const row = document.createElement('article');
  row.className = 'session-editor-item is-draggable';
  if (id) row.dataset.id = id;
  row.title = ui('sessionExerciseDragHandle');

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
  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    editSessionExercise(athleteId, sessionId, id);
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'session-editor-item-remove';
  removeBtn.setAttribute('aria-label', ui('sessionRemoveExercise'));
  removeBtn.title = ui('sessionRemoveExercise');
  removeBtn.innerHTML = ICON_CLOSE_SVG;
  removeBtn.addEventListener('click', e => {
    e.stopPropagation();
    removeExerciseFromSession(athleteId, sessionId, id);
  });

  actions.append(editBtn, removeBtn);
  row.append(media, main, actions);
  wireCardDrag(row, {
    kind: 'exercise',
    athleteId: String(athleteId),
    sessionId: String(sessionId),
    id,
    itemSelector: '.session-editor-item',
    ignoreSelector: 'button, a, input, select, textarea',
  });
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
  if (isTemplatesScope(target.athleteId)) {
    return ui('sessionAssignToTemplate', session.name);
  }
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

/** Local reorder — persists with Guardar plan (full PUT replace). */
export function moveSessionToIndex(athleteId, sessionId, toIndex) {
  const athlete = findAthlete(athleteId);
  if (!athlete) return false;

  const sessions = ensureAthleteSessions(athlete);
  const sorted = [...sessions].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  const from = sorted.findIndex(s => String(s?.id) === String(sessionId));
  if (from < 0) return false;

  const clamped = Math.max(0, Math.min(sorted.length - 1, Number(toIndex)));
  if (!Number.isInteger(clamped) || clamped === from) return false;

  const [session] = sorted.splice(from, 1);
  sorted.splice(clamped, 0, session);
  sorted.forEach((s, i) => { s.order = i; });
  athlete.coachTrainingProgram = sorted;

  markAthleteDirty(athleteId);
  reorderSessionRowsInDom(athleteId);
  syncPlanDirtyChrome(athleteId);
  dismissFeatureHintById('reorder-sessions');
  return true;
}

/** Local reorder within a session — persists with Guardar plan. */
export function moveSessionExerciseToIndex(athleteId, sessionId, exerciseId, toIndex) {
  const session = findSession(athleteId, sessionId);
  if (!session) return false;

  const items = Array.isArray(session.items) ? session.items : [];
  const sorted = [...items].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
  const key = String(exerciseId || '');
  const from = sorted.findIndex(
    item => String(item.exercise?.id || item.exerciseId) === key,
  );
  if (from < 0) return false;

  const clamped = Math.max(0, Math.min(sorted.length - 1, Number(toIndex)));
  if (!Number.isInteger(clamped) || clamped === from) return false;

  const [item] = sorted.splice(from, 1);
  sorted.splice(clamped, 0, item);
  sorted.forEach((entry, i) => { entry.order = i; });
  session.items = sorted;

  markAthleteDirty(athleteId);
  reorderExerciseRowsInDom(sessionId);
  syncPlanDirtyChrome(athleteId);
  dismissFeatureHintById('reorder-exercises');
  return true;
}

/**
 * Whole-card drag. Ignores interactive targets; optional onDragStart for click suppress.
 * @param {HTMLElement} row
 * @param {{ kind: 'session' | 'exercise', athleteId: string, sessionId?: string, id: string, itemSelector: string, ignoreSelector?: string, onDragStart?: () => void }} meta
 */
function wireCardDrag(row, meta) {
  const ignoreSelector = meta.ignoreSelector || 'button, a, input, select, textarea';

  row.addEventListener('pointerdown', e => {
    if (e.button != null && e.button !== 0) return;
    const target = /** @type {Element | null} */ (e.target);
    if (target?.closest?.(ignoreSelector)) {
      row.draggable = false;
      return;
    }
    row.draggable = true;
  });

  const clearDraggable = () => {
    if (!activeDrag) row.draggable = false;
  };
  row.addEventListener('pointerup', clearDraggable);
  row.addEventListener('pointercancel', clearDraggable);

  wireSharedDragEvents(row, meta);
}

/**
 * @param {HTMLElement} row
 * @param {{ kind: 'session' | 'exercise', athleteId: string, sessionId?: string, id: string, itemSelector: string, onDragStart?: () => void }} meta
 */
function wireSharedDragEvents(row, meta) {
  row.addEventListener('dragstart', e => {
    if (!row.draggable) {
      e.preventDefault();
      return;
    }
    activeDrag = {
      kind: meta.kind,
      athleteId: meta.athleteId,
      sessionId: meta.sessionId,
      id: meta.id,
    };
    row.classList.add('is-dragging');
    meta.onDragStart?.();
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', meta.id);
    try {
      e.dataTransfer.setDragImage(row, 40, 24);
    } catch {
      /* some browsers reject custom drag image */
    }
  });

  row.addEventListener('dragend', () => {
    row.draggable = false;
    row.classList.remove('is-dragging');
    clearDropMarkers(row.parentElement, meta.itemSelector);
    activeDrag = null;
  });

  row.addEventListener('dragover', e => {
    if (!activeDrag || activeDrag.kind !== meta.kind) return;
    if (activeDrag.athleteId !== meta.athleteId) return;
    if (meta.kind === 'exercise' && activeDrag.sessionId !== meta.sessionId) return;
    if (activeDrag.id === meta.id) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const rect = row.getBoundingClientRect();
    const before = e.clientY < rect.top + rect.height / 2;
    row.classList.toggle('is-drop-before', before);
    row.classList.toggle('is-drop-after', !before);

    const parent = row.parentElement;
    if (!parent) return;
    parent.querySelectorAll(meta.itemSelector).forEach(el => {
      if (el === row) return;
      el.classList.remove('is-drop-before', 'is-drop-after');
    });
  });

  row.addEventListener('dragleave', e => {
    if (row.contains(/** @type {Node} */ (e.relatedTarget))) return;
    row.classList.remove('is-drop-before', 'is-drop-after');
  });

  row.addEventListener('drop', e => {
    if (!activeDrag || activeDrag.kind !== meta.kind) return;
    if (activeDrag.athleteId !== meta.athleteId) return;
    if (meta.kind === 'exercise' && activeDrag.sessionId !== meta.sessionId) return;

    e.preventDefault();
    e.stopPropagation();

    const parent = row.parentElement;
    const siblings = parent
      ? [...parent.querySelectorAll(meta.itemSelector)]
      : [];
    const targetIndex = siblings.indexOf(row);
    if (targetIndex < 0) return;

    const before = row.classList.contains('is-drop-before');
    let toIndex = before ? targetIndex : targetIndex + 1;

    const fromIndex = siblings.findIndex(el => {
      if (meta.kind === 'session') {
        return String(el.dataset.sessionId || '') === activeDrag.id;
      }
      return String(el.dataset.id || '') === activeDrag.id;
    });
    if (fromIndex >= 0 && fromIndex < toIndex) toIndex -= 1;

    clearDropMarkers(parent, meta.itemSelector);

    if (meta.kind === 'session') {
      moveSessionToIndex(activeDrag.athleteId, activeDrag.id, toIndex);
    } else {
      moveSessionExerciseToIndex(
        activeDrag.athleteId,
        activeDrag.sessionId,
        activeDrag.id,
        toIndex,
      );
    }
  });
}

function clearDropMarkers(parent, itemSelector) {
  parent?.querySelectorAll(itemSelector).forEach(el => {
    el.classList.remove('is-drop-before', 'is-drop-after', 'is-dragging');
  });
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
  btn.textContent = saving
    ? (isTemplatesScope(id) ? ui('savingCoachTemplates') : ui('savingAthletePlan'))
    : (isTemplatesScope(id) ? ui('saveCoachTemplates') : ui('saveAthletePlan'));
  btn.addEventListener('click', e => {
    e.stopPropagation();
    void saveAthletePlan(athleteId);
  });

  bar.append(btn);
  return bar;
}

/** PUT full replace — athlete training-program or coach templates. */
async function saveAthletePlan(athleteId) {
  const id = String(athleteId || '');
  const athlete = findAthlete(id);
  if (!athlete || store.savingAthleteIds.has(id)) return;

  const payload = serializeCoachTrainingProgram(athlete);

  store.savingAthleteIds.add(id);
  store.saveErrorByAthleteId.delete(id);
  syncSessionEditorView();
  store.refreshList();
  store.refreshTemplatesList();

  try {
    if (isTemplatesScope(id)) {
      const updated = await putCoachTemplates(payload);
      if (Array.isArray(updated?.coachTemplates)) {
        store.templates = updated.coachTemplates;
      }
    } else {
      const updated = await putCoachAthleteTrainingProgram(id, payload);
      if (Array.isArray(updated?.coachTrainingProgram)) {
        athlete.coachTrainingProgram = updated.coachTrainingProgram;
      }
    }
    clearAthleteDirty(id);
  } catch (err) {
    console.error(err);
    store.saveErrorByAthleteId.set(
      id,
      isTemplatesScope(id) ? ui('coachTemplatesSaveFail') : ui('athletePlanSaveFail'),
    );
  } finally {
    store.savingAthleteIds.delete(id);
    syncSessionEditorView();
    store.refreshList();
    store.refreshTemplatesList();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────
function touchPlanUi(athleteId) {
  markAthleteDirty(athleteId);
  syncSessionEditorView();
  store.refreshList();
  if (isTemplatesScope(athleteId)) store.refreshTemplatesList();
}

/** Move existing session cards in place (avoids accordion flash). */
function reorderSessionRowsInDom(athleteId) {
  const athlete = findAthlete(athleteId);
  const list = findSessionListEl(athleteId);
  if (!athlete || !list) return false;

  for (const session of getAthleteSessions(athlete)) {
    const el = list.querySelector(
      `.student-session[data-session-id="${cssEscape(session?.id)}"]`,
    );
    if (el) list.appendChild(el);
  }
  return true;
}

/** Move existing exercise cards in the session editor list. */
function reorderExerciseRowsInDom(sessionId) {
  const session = findSession(store.editorAthleteId, sessionId);
  const list = document.getElementById('session-editor-list');
  if (!session || !list) return false;

  const items = [...(session.items || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  for (const item of items) {
    const id = String(item.exercise?.id || item.exerciseId || '');
    if (!id) continue;
    const el = list.querySelector(`.session-editor-item[data-id="${cssEscape(id)}"]`);
    if (el) list.appendChild(el);
  }
  return true;
}

function findSessionListEl(athleteId) {
  const id = String(athleteId || '');
  if (isTemplatesScope(id)) {
    return document.querySelector('#coach-templates-body .student-session-list');
  }
  return document.querySelector(
    `#students-list .student-row[data-id="${cssEscape(id)}"] .student-session-list`,
  );
}

function findPlanEl(athleteId) {
  const id = String(athleteId || '');
  if (isTemplatesScope(id)) {
    return document.querySelector('#coach-templates-body .student-plan');
  }
  return document.querySelector(
    `#students-list .student-row[data-id="${cssEscape(id)}"] .student-plan`,
  );
}

/** Dirty chip + save bar without rebuilding session cards. */
function syncPlanDirtyChrome(athleteId) {
  const id = String(athleteId || '');
  const plan = findPlanEl(id);
  if (!plan) return;

  const headActions = plan.querySelector('.student-plan-head-actions');
  if (headActions) {
    let dirty = headActions.querySelector('.student-plan-dirty');
    if (isAthleteDirty(id)) {
      if (!dirty) {
        dirty = document.createElement('span');
        dirty.className = 'student-plan-dirty';
        dirty.textContent = isTemplatesScope(id)
          ? ui('coachTemplatesUnsaved')
          : ui('athletePlanUnsaved');
        headActions.prepend(dirty);
      }
    } else {
      dirty?.remove();
    }
  }

  const needBar =
    isAthleteDirty(id)
    || store.savingAthleteIds.has(id)
    || store.saveErrorByAthleteId.has(id);
  const saveBar = plan.querySelector('.student-plan-save-bar');
  if (needBar) {
    const next = createPlanSaveBar(id);
    if (saveBar) saveBar.replaceWith(next);
    else plan.append(next);
  } else {
    saveBar?.remove();
  }
}

function cssEscape(value) {
  const text = String(value ?? '');
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(text);
  }
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
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
