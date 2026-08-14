/**
 * Coach — session templates library (list / create / edit / save).
 * Apply from Plantillas → athletes; Use template from Mis alumnos → POST /coach/templates/apply.
 * Markup: #coach-templates-view, #apply-template-overlay, #use-template-overlay
 */
import { getCoachAthletes } from '../api/users.js';
import {
  getCoachTemplates,
  applyCoachTemplates,
} from '../api/coach-templates.js';
import { ui } from '../utils/labels.js';
import { setInlineStatus } from '../utils/dom-status.js';
import { bindOverlay } from '../utils/overlay.js';
import {
  store,
  TEMPLATES_SCOPE_ID,
  getTemplatesAthlete,
  findAthlete,
  clearAthleteDirty,
  ensureAthleteSessions,
  getAthleteSessions,
  athleteDisplayName,
} from './coach-athletes-store.js';
import { createAthletePlan } from './coach-sessions-ui.js';
const ATHLETE_PAGE_SIZE = 100;
const SEARCH_DEBOUNCE_MS = 320;

let bodyEl;
let loadingEl;
let statusEl;
let loadSeq = 0;
let toastEl;
let toastTitleEl;
let toastDetailEl;
let toastHideTimer = null;
const TOAST_VISIBLE_MS = 3000;

let applyOverlay;
let applyLeadEl;
let applySearchInput;
let applyListEl;
let applyEmptyEl;
let applySkeletonEl;
let applyStatusEl;
let applyConfirmBtn;
let pendingTemplate = null;
/** @type {Set<string>} */
let selectedAthleteIds = new Set();
/** @type {Map<string, any>} */
let selectedAthleteCache = new Map();
/** @type {any[]} */
let applyAthletes = [];
let applySearchTimer = 0;
let applyLoadSeq = 0;
let applyBusy = false;

let useOverlay;
let useLeadEl;
let useSearchInput;
let useListEl;
let useEmptyEl;
let useSkeletonEl;
let useStatusEl;
let useConfirmBtn;
/** @type {any | null} */
let useAthlete = null;
/** @type {Set<string>} */
let selectedTemplateIds = new Set();
/** @type {any[]} */
let useTemplates = [];
let useSearchTimer = 0;
let useLoadSeq = 0;
let useBusy = false;

export function initCoachTemplatesUi() {
  bodyEl = document.getElementById('coach-templates-body');
  loadingEl = document.getElementById('coach-templates-loading');
  statusEl = document.getElementById('coach-templates-status');
  toastEl = document.getElementById('coach-templates-toast');
  toastTitleEl = document.getElementById('coach-templates-toast-title');
  toastDetailEl = document.getElementById('coach-templates-toast-detail');
  document.getElementById('coach-templates-toast-close')?.addEventListener('click', () => {
    hideApplyToast();
  });

  applyOverlay = document.getElementById('apply-template-overlay');
  applyLeadEl = document.getElementById('apply-template-lead');
  applySearchInput = document.getElementById('apply-template-search');
  applyListEl = document.getElementById('apply-template-list');
  applyEmptyEl = document.getElementById('apply-template-empty');
  applySkeletonEl = document.getElementById('apply-template-skeleton');
  applyStatusEl = document.getElementById('apply-template-status');
  applyConfirmBtn = document.getElementById('apply-template-confirm');

  useOverlay = document.getElementById('use-template-overlay');
  useLeadEl = document.getElementById('use-template-lead');
  useSearchInput = document.getElementById('use-template-search');
  useListEl = document.getElementById('use-template-list');
  useEmptyEl = document.getElementById('use-template-empty');
  useSkeletonEl = document.getElementById('use-template-skeleton');
  useStatusEl = document.getElementById('use-template-status');
  useConfirmBtn = document.getElementById('use-template-confirm');

  store.refreshTemplatesList = renderTemplatesList;
  store.requestApplyTemplate = openApplyTemplateModal;
  store.requestUseTemplatesForAthlete = openUseTemplatesModal;

  bindOverlayChrome({
    overlay: applyOverlay,
    closeIds: ['apply-template-close', 'apply-template-cancel'],
    onClose: closeApplyTemplateModal,
    confirmBtn: applyConfirmBtn,
    onConfirm: () => void confirmApplyTemplate(),
    searchInput: applySearchInput,
    onSearch: () => {
      window.clearTimeout(applySearchTimer);
      applySearchTimer = window.setTimeout(() => {
        void loadApplyAthletes({ replace: true });
      }, SEARCH_DEBOUNCE_MS);
    },
  });

  bindOverlayChrome({
    overlay: useOverlay,
    closeIds: ['use-template-close', 'use-template-cancel'],
    onClose: closeUseTemplatesModal,
    confirmBtn: useConfirmBtn,
    onConfirm: () => void confirmUseTemplates(),
    searchInput: useSearchInput,
    onSearch: () => {
      window.clearTimeout(useSearchTimer);
      useSearchTimer = window.setTimeout(() => {
        renderUseTemplates();
      }, SEARCH_DEBOUNCE_MS);
    },
  });

}

export function syncCoachTemplatesLabels() {
  document.querySelectorAll(
    '#coach-templates-view [data-ui], #apply-template-overlay [data-ui], #use-template-overlay [data-ui]',
  ).forEach((el) => {
    el.textContent = ui(el.dataset.ui);
  });
  if (applySearchInput) {
    applySearchInput.placeholder = ui('templateApplySearchPlaceholder');
  }
  if (useSearchInput) {
    useSearchInput.placeholder = ui('useTemplateSearchPlaceholder');
  }
  if (store.templatesLoaded) renderTemplatesList();
  if (pendingTemplate) syncApplyLead();
  if (useAthlete) syncUseLead();
}

export function resetCoachTemplatesUi() {
  loadSeq += 1;
  store.templates = [];
  store.templatesLoaded = false;
  store.loadingTemplates = false;
  clearAthleteDirty(TEMPLATES_SCOPE_ID);
  setLoading(false);
  setStatus('');
  hideApplyToast(true);
  bodyEl?.replaceChildren();
  closeApplyTemplateModal();
  closeUseTemplatesModal();
}

export async function loadCoachTemplates({ force = false } = {}) {
  if (store.loadingTemplates) return;

  // Keep in-memory edits (create/edit). Only refetch when forced or never loaded.
  if (store.templatesLoaded && !force) {
    renderTemplatesList();
    return;
  }

  const seq = ++loadSeq;
  store.loadingTemplates = true;
  setLoading(true);
  setStatus('');

  try {
    const res = await getCoachTemplates();
    if (seq !== loadSeq) return;
    applyFetchedTemplates(res);
    renderTemplatesList();
  } catch (err) {
    console.error(err);
    if (seq !== loadSeq) return;
    store.templatesLoaded = false;
    bodyEl?.replaceChildren();
    setStatus(ui('coachTemplatesLoadFail'), 'error');
  } finally {
    if (seq === loadSeq) {
      store.loadingTemplates = false;
      setLoading(false);
    }
  }
}

function renderTemplatesList() {
  if (!bodyEl) return;
  const athlete = getTemplatesAthlete();
  bodyEl.replaceChildren(createAthletePlan(athlete));
}

function applyFetchedTemplates(res) {
  store.templates = Array.isArray(res?.coachTemplates) ? res.coachTemplates : [];
  store.templatesLoaded = true;
  clearAthleteDirty(TEMPLATES_SCOPE_ID);
}

/** Ensure store.templates is hydrated (throws on network/API error). */
async function ensureTemplatesLoaded() {
  if (store.templatesLoaded) return;
  const res = await getCoachTemplates();
  applyFetchedTemplates(res);
}

function setLoading(on) {
  if (loadingEl) loadingEl.hidden = !on;
}

function setStatus(message, kind = '') {
  setInlineStatus(statusEl, message, kind);
}

function hideApplyToast(immediate = false) {
  if (toastHideTimer != null) {
    clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }
  if (!toastEl || toastEl.hidden) return;

  if (immediate) {
    toastEl.hidden = true;
    toastEl.classList.remove('is-visible', 'is-leaving');
    if (toastTitleEl) toastTitleEl.textContent = '';
    if (toastDetailEl) toastDetailEl.textContent = '';
    return;
  }

  toastEl.classList.remove('is-visible');
  toastEl.classList.add('is-leaving');

  const finish = () => {
    toastEl.hidden = true;
    toastEl.classList.remove('is-leaving');
    if (toastTitleEl) toastTitleEl.textContent = '';
    if (toastDetailEl) toastDetailEl.textContent = '';
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish();
    return;
  }

  window.setTimeout(finish, 280);
}

function showApplyToast(title, detail) {
  if (!toastEl || !toastTitleEl || !toastDetailEl) return;

  if (toastHideTimer != null) {
    clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }

  toastTitleEl.textContent = title;
  toastDetailEl.textContent = detail || '';
  toastDetailEl.hidden = !detail;

  toastEl.hidden = false;
  toastEl.classList.remove('is-leaving');
  toastEl.classList.remove('is-visible');
  void toastEl.offsetWidth;
  toastEl.classList.add('is-visible');

  toastHideTimer = window.setTimeout(() => {
    toastHideTimer = null;
    hideApplyToast();
  }, TOAST_VISIBLE_MS);
}

// ── Apply template → athlete ─────────────────────────────────────────

function openApplyTemplateModal(template) {
  const items = Array.isArray(template?.items) ? template.items : [];
  if (!template?.id || items.length === 0) {
    setStatus(ui('templateApplyNeedsExercises'), 'error');
    return;
  }

  pendingTemplate = template;
  selectedAthleteIds = new Set();
  selectedAthleteCache = new Map();
  applyAthletes = [];
  if (applySearchInput) applySearchInput.value = '';
  setApplyStatus('');
  syncApplyLead();
  syncApplyConfirm();
  applyOverlay?.classList.add('open');
  void loadApplyAthletes({ replace: true });
  applySearchInput?.focus();
}

function closeApplyTemplateModal() {
  applyOverlay?.classList.remove('open');
  pendingTemplate = null;
  selectedAthleteIds = new Set();
  selectedAthleteCache = new Map();
  applyAthletes = [];
  applyBusy = false;
  setApplyStatus('');
  resetPickerList({
    list: applyListEl,
    empty: applyEmptyEl,
    skeleton: applySkeletonEl,
    searchInput: applySearchInput,
  });
  syncApplyConfirm();
}

function syncApplyLead() {
  if (!applyLeadEl) return;
  const name = String(pendingTemplate?.name || '').trim() || '—';
  applyLeadEl.replaceChildren();
  applyLeadEl.append(
    document.createTextNode(ui('templateApplyLeadBefore')),
    Object.assign(document.createElement('strong'), { textContent: name }),
    document.createTextNode(ui('templateApplyLeadAfter')),
  );
}

async function loadApplyAthletes({ replace = true } = {}) {
  const seq = ++applyLoadSeq;
  setApplyLoading(true);

  try {
    const search = String(applySearchInput?.value || '').trim();
    const res = await getCoachAthletes({
      page: 1,
      limit: ATHLETE_PAGE_SIZE,
      search: search || undefined,
    });
    if (seq !== applyLoadSeq) return;
    const raw = Array.isArray(res?.data) ? res.data : [];
    applyAthletes = raw.filter((athlete) => !athleteHasTemplate(athlete, pendingTemplate?.id));
    // Drop selections that are no longer assignable / visible.
    selectedAthleteIds = new Set(
      [...selectedAthleteIds].filter((id) =>
        applyAthletes.some((a) => String(a?.id) === id),
      ),
    );
    for (const athlete of applyAthletes) {
      const id = String(athlete?.id || '');
      if (id && selectedAthleteIds.has(id)) selectedAthleteCache.set(id, athlete);
    }
    for (const id of [...selectedAthleteCache.keys()]) {
      if (!selectedAthleteIds.has(id)) selectedAthleteCache.delete(id);
    }
    renderApplyAthletes();
    syncApplyConfirm();
  } catch (err) {
    console.error(err);
    if (seq !== applyLoadSeq) return;
    if (!applyAthletes.length) {
      renderApplyAthletes();
    }
    setApplyStatus(ui('templateApplyLoadAthletesFail'), 'error');
  } finally {
    if (seq === applyLoadSeq) setApplyLoading(false);
  }
}

function athleteHasTemplate(athlete, templateId) {
  const tid = String(templateId || '').trim();
  if (!tid) return false;
  const fromStore = findAthlete(athlete?.id);
  const sessions = getAthleteSessions(fromStore || athlete);
  return sessions.some((s) => String(s?.id || '') === tid);
}

function setApplyLoading(on) {
  setPickerLoading(
    { skeleton: applySkeletonEl, empty: applyEmptyEl, list: applyListEl },
    on,
    applyAthletes.length === 0,
  );
}

function renderApplyAthletes() {
  if (!applyListEl || !applyEmptyEl) return;
  applyListEl.replaceChildren();
  const search = String(applySearchInput?.value || '').trim();

  if (applyAthletes.length === 0) {
    applyListEl.hidden = true;
    applyEmptyEl.hidden = false;
    applyEmptyEl.textContent = search
      ? ui('templateApplyEmpty')
      : ui('templateApplyEmptyAllHaveIt');
    return;
  }

  applyEmptyEl.hidden = true;
  applyListEl.hidden = false;
  const frag = document.createDocumentFragment();
  for (const athlete of applyAthletes) {
    frag.appendChild(
      createPickerRow({
        id: String(athlete?.id || ''),
        selected: selectedAthleteIds.has(String(athlete?.id || '')),
        primary: athleteDisplayName(athlete),
        secondary: String(athlete?.email || '').trim() || '—',
        onClick: (id) => toggleApplyAthlete(id, athlete),
      }),
    );
  }
  applyListEl.append(frag);
}

function toggleApplyAthlete(id, athlete) {
  if (!id) return;
  if (selectedAthleteIds.has(id)) {
    selectedAthleteIds.delete(id);
    selectedAthleteCache.delete(id);
  } else {
    selectedAthleteIds.add(id);
    selectedAthleteCache.set(id, athlete);
  }
  setApplyStatus('');
  renderApplyAthletes();
  syncApplyConfirm();
}

function syncApplyConfirm() {
  syncPickerConfirm(applyConfirmBtn, {
    busy: applyBusy,
    canSubmit: Boolean(pendingTemplate),
    count: selectedAthleteIds.size,
  });
}

function setApplyStatus(message, kind = '') {
  setPickerStatus(applyStatusEl, message, kind);
}

async function confirmApplyTemplate() {
  const athleteIds = [...selectedAthleteIds];
  if (applyBusy || !pendingTemplate || athleteIds.length === 0) return;

  const templateSnapshot = pendingTemplate;
  const templateId = String(templateSnapshot?.id || '').trim();
  const templateName = String(templateSnapshot.name || '').trim() || '—';
  if (!templateId) {
    setApplyStatus(ui('templateApplyFail'), 'error');
    return;
  }

  applyBusy = true;
  syncApplyConfirm();
  setApplyStatus('');

  try {
    const res = await applyCoachTemplates({
      templateIds: [templateId],
      athleteIds,
    });
    const appliedPairs = applyPairs(res?.applied);
    const skippedPairs = applyPairs(res?.skipped);
    const failedAthletes = Array.isArray(res?.failedAthletes)
      ? res.failedAthletes.map(String)
      : [];
    const failedTemplates = Array.isArray(res?.failedTemplates)
      ? res.failedTemplates.map(String)
      : [];

    const appliedAthleteIds = uniqueIds(appliedPairs.map((p) => p.athleteId));
    const skippedAthleteIds = uniqueIds(skippedPairs.map((p) => p.athleteId))
      .filter((id) => !appliedAthleteIds.includes(id));

    if (appliedAthleteIds.length) {
      syncFromApplyResponse(res);
      store.refreshList();
    }

    const okCount = appliedAthleteIds.length;
    const skippedCount = skippedAthleteIds.length;
    const failCount = failedAthletes.length + failedTemplates.length;

    if (okCount === 0 && failCount > 0 && skippedCount === 0) {
      setApplyStatus(ui('templateApplyFail'), 'error');
      return;
    }

    closeApplyTemplateModal();

    if (okCount === 0 && skippedCount > 0 && failCount === 0) {
      showApplyToast(
        ui('templateApplyToastTitleSkipped'),
        ui('templateApplyToastAllSkipped', templateName),
      );
    } else if (okCount === 1 && skippedCount === 0 && failCount === 0) {
      const name = athleteDisplayName(
        resolveAthleteForApply(appliedAthleteIds[0]) || { id: appliedAthleteIds[0] },
      );
      showApplyToast(
        ui('templateApplyToastTitle'),
        ui('templateApplyToastOne', templateName, name),
      );
    } else if (skippedCount > 0 || failCount > 0) {
      showApplyToast(
        ui('templateApplyToastTitle'),
        ui('templateApplyToastWithSkips', templateName, okCount, skippedCount + failCount),
      );
    } else {
      showApplyToast(
        ui('templateApplyToastTitle'),
        ui('templateApplyToastMany', templateName, okCount),
      );
    }
  } catch (err) {
    console.error(err);
    setApplyStatus(ui('templateApplyFail'), 'error');
  } finally {
    applyBusy = false;
    syncApplyConfirm();
  }
}

function applyPairs(list) {
  return (Array.isArray(list) ? list : [])
    .map((row) => ({
      athleteId: String(row?.athleteId || '').trim(),
      templateId: String(row?.templateId || '').trim(),
    }))
    .filter((row) => row.athleteId && row.templateId);
}

function uniqueIds(ids) {
  return [...new Set((ids || []).map(String).filter(Boolean))];
}

/** Merge server apply result into Mis alumnos store. */
function syncFromApplyResponse(res) {
  const sessions = Array.isArray(res?.sessions) ? res.sessions : [];
  const byTemplateId = new Map(
    sessions
      .map((session) => [String(session?.id || '').trim(), session])
      .filter(([id]) => id),
  );
  const byAthlete = new Map();

  for (const { athleteId, templateId } of applyPairs(res?.applied)) {
    const session = byTemplateId.get(templateId);
    if (!session) continue;
    if (!byAthlete.has(athleteId)) byAthlete.set(athleteId, []);
    byAthlete.get(athleteId).push(session);
  }

  for (const [athleteId, athleteSessions] of byAthlete) {
    syncAppliedAthletesLocally(athleteSessions, [athleteId]);
  }
}

/** Merge server-returned session(s) into Mis alumnos store after apply. */
function syncAppliedAthletesLocally(sessionOrSessions, appliedIds) {
  const sessions = Array.isArray(sessionOrSessions)
    ? sessionOrSessions
    : sessionOrSessions
      ? [sessionOrSessions]
      : [];
  if (!sessions.length) return;

  for (const athleteId of appliedIds) {
    const target = findAthlete(athleteId);
    if (!target) continue;
    const plan = ensureAthleteSessions(target);

    for (const session of sessions) {
      const sessionId = String(session?.id || '').trim();
      if (!sessionId) continue;
      if (plan.some((s) => String(s?.id || '') === sessionId)) continue;
      plan.push({
        id: sessionId,
        name: String(session?.name || '').trim() || ui('addSessionDefault', plan.length + 1),
        order: plan.length,
        items: Array.isArray(session?.items) ? session.items : [],
      });
    }

    clearAthleteDirty(athleteId);
  }
}

function resolveAthleteForApply(athleteId) {
  const id = String(athleteId || '');
  const fromStore = findAthlete(id);
  if (fromStore) return fromStore;
  return (
    applyAthletes.find((a) => String(a?.id) === id) ||
    selectedAthleteCache.get(id) ||
    null
  );
}

// ── Use templates → one athlete (from Mis alumnos) ───────────────────

function openUseTemplatesModal(athlete) {
  const id = String(athlete?.id || '');
  if (!id) return;

  useAthlete = athlete;
  selectedTemplateIds = new Set();
  useTemplates = [];
  if (useSearchInput) useSearchInput.value = '';
  setUseStatus('');
  syncUseLead();
  syncUseConfirm();
  useOverlay?.classList.add('open');
  void loadUseTemplates();
  useSearchInput?.focus();
}

function closeUseTemplatesModal() {
  useOverlay?.classList.remove('open');
  useAthlete = null;
  selectedTemplateIds = new Set();
  useTemplates = [];
  useBusy = false;
  setUseStatus('');
  resetPickerList({
    list: useListEl,
    empty: useEmptyEl,
    skeleton: useSkeletonEl,
    searchInput: useSearchInput,
  });
  syncUseConfirm();
}

function syncUseLead() {
  if (!useLeadEl) return;
  const name = athleteDisplayName(useAthlete);
  useLeadEl.replaceChildren();
  useLeadEl.append(
    document.createTextNode(ui('useTemplateLeadBefore')),
    Object.assign(document.createElement('strong'), { textContent: name }),
    document.createTextNode(ui('useTemplateLeadAfter')),
  );
}

async function loadUseTemplates() {
  const seq = ++useLoadSeq;
  setUseLoading(true);
  try {
    await ensureTemplatesLoaded();
    if (seq !== useLoadSeq) return;
    useTemplates = assignableTemplatesForAthlete(useAthlete);
    selectedTemplateIds = new Set(
      [...selectedTemplateIds].filter((id) =>
        useTemplates.some((t) => String(t?.id) === id),
      ),
    );
    renderUseTemplates();
    syncUseConfirm();
  } catch (err) {
    console.error(err);
    if (seq !== useLoadSeq) return;
    useTemplates = [];
    renderUseTemplates();
    setUseStatus(ui('useTemplateLoadFail'), 'error');
  } finally {
    if (seq === useLoadSeq) setUseLoading(false);
  }
}

/** Templates with exercises that this athlete does not already have (by session id). */
function assignableTemplatesForAthlete(athlete) {
  const target = findAthlete(athlete?.id) || athlete;
  const ownedIds = new Set(
    getAthleteSessions(target).map((s) => String(s?.id || '')).filter(Boolean),
  );
  const all = Array.isArray(store.templates) ? store.templates : [];
  return all.filter((template) => {
    const id = String(template?.id || '').trim();
    if (!id || ownedIds.has(id)) return false;
    const items = Array.isArray(template?.items) ? template.items : [];
    return items.length > 0;
  });
}

function setUseLoading(on) {
  setPickerLoading(
    { skeleton: useSkeletonEl, empty: useEmptyEl, list: useListEl },
    on,
    filteredUseTemplates().length === 0,
  );
}

function filteredUseTemplates() {
  const q = String(useSearchInput?.value || '').trim().toLowerCase();
  if (!q) return useTemplates;
  return useTemplates.filter((t) =>
    String(t?.name || '').toLowerCase().includes(q),
  );
}

function renderUseTemplates() {
  if (!useListEl || !useEmptyEl) return;
  useListEl.replaceChildren();
  const list = filteredUseTemplates();
  const q = String(useSearchInput?.value || '').trim();

  if (list.length === 0) {
    useListEl.hidden = true;
    useEmptyEl.hidden = false;
    if (q) {
      useEmptyEl.textContent = ui('useTemplateEmpty');
    } else if ((store.templates || []).length > 0) {
      useEmptyEl.textContent = ui('useTemplateEmptyNoneLeft');
    } else {
      useEmptyEl.textContent = ui('useTemplateEmpty');
    }
    return;
  }

  useEmptyEl.hidden = true;
  useListEl.hidden = false;
  const frag = document.createDocumentFragment();
  for (const template of list) {
    const id = String(template?.id || '');
    const items = Array.isArray(template?.items) ? template.items : [];
    frag.appendChild(
      createPickerRow({
        id,
        selected: selectedTemplateIds.has(id),
        primary: String(template?.name || '').trim() || '—',
        secondary: ui('useTemplateExerciseCount', items.length),
        onClick: (rowId) => toggleUseTemplate(rowId),
      }),
    );
  }
  useListEl.append(frag);
}

function toggleUseTemplate(id) {
  if (!id) return;
  if (selectedTemplateIds.has(id)) selectedTemplateIds.delete(id);
  else selectedTemplateIds.add(id);
  setUseStatus('');
  renderUseTemplates();
  syncUseConfirm();
}

function syncUseConfirm() {
  syncPickerConfirm(useConfirmBtn, {
    busy: useBusy,
    canSubmit: Boolean(useAthlete),
    count: selectedTemplateIds.size,
  });
}

function setUseStatus(message, kind = '') {
  setPickerStatus(useStatusEl, message, kind);
}

async function confirmUseTemplates() {
  const athleteId = String(useAthlete?.id || '');
  const templateIds = [...selectedTemplateIds];
  if (useBusy || !athleteId || templateIds.length === 0) return;

  const athleteName = athleteDisplayName(useAthlete);
  useBusy = true;
  syncUseConfirm();
  setUseStatus('');

  try {
    const res = await applyCoachTemplates({
      templateIds,
      athleteIds: [athleteId],
    });
    const appliedPairs = applyPairs(res?.applied);
    const skippedPairs = applyPairs(res?.skipped);
    const failedAthletes = Array.isArray(res?.failedAthletes)
      ? res.failedAthletes.map(String)
      : [];
    const failedTemplates = Array.isArray(res?.failedTemplates)
      ? res.failedTemplates.map(String)
      : [];

    const okCount = uniqueIds(appliedPairs.map((p) => p.templateId)).length;
    const skippedCount = uniqueIds(skippedPairs.map((p) => p.templateId)).length;
    const failCount = failedAthletes.length + failedTemplates.length;

    if (okCount > 0) {
      syncFromApplyResponse(res);
      store.refreshList();
    }

    if (okCount === 0 && failCount > 0 && skippedCount === 0) {
      setUseStatus(ui('useTemplateFail'), 'error');
      return;
    }

    let toast = '';
    if (okCount === 0 && skippedCount > 0 && failCount === 0) {
      toast = ui('useTemplateAllSkipped', athleteName);
    } else if (okCount > 0 && (skippedCount > 0 || failCount > 0)) {
      toast = ui('useTemplateOkWithSkips', okCount, skippedCount + failCount, athleteName);
    } else if (okCount > 0) {
      toast = ui('useTemplateOk', okCount, athleteName);
    }

    if (toast) setUseStatus(toast, 'ok');
    window.setTimeout(() => {
      closeUseTemplatesModal();
    }, 650);
  } catch (err) {
    console.error(err);
    setUseStatus(ui('useTemplateFail'), 'error');
  } finally {
    useBusy = false;
    syncUseConfirm();
  }
}

// ── Shared picker helpers (apply ↔ use modals) ───────────────────────

function bindOverlayChrome({
  overlay,
  closeIds = [],
  onClose,
  confirmBtn,
  onConfirm,
  searchInput,
  onSearch,
}) {
  bindOverlay({
    overlay,
    closeSelectors: closeIds.map((id) => `#${id}`),
    onClose,
    stopEscapePropagation: true,
  });
  confirmBtn?.addEventListener('click', onConfirm);
  searchInput?.addEventListener('input', onSearch);
}

function setPickerStatus(el, message, kind = '') {
  setInlineStatus(el, message, kind);
}

function setPickerLoading(parts, on, isEmpty) {
  const { skeleton, empty, list } = parts || {};
  if (skeleton) skeleton.hidden = !on;
  if (on) {
    if (empty) empty.hidden = true;
    if (list) list.hidden = true;
  } else if (list) {
    list.hidden = isEmpty;
  }
}

function syncPickerConfirm(btn, { busy, canSubmit, count }) {
  if (!btn) return;
  btn.disabled = busy || !canSubmit || count === 0;
  if (busy) {
    btn.textContent = ui('templateApplySaving');
  } else if (count > 1) {
    btn.textContent = ui('templateApplyConfirmCount', count);
  } else {
    btn.textContent = ui('templateApplyConfirm');
  }
}

function resetPickerList({ list, empty, skeleton, searchInput }) {
  if (searchInput) searchInput.value = '';
  list?.replaceChildren();
  if (empty) empty.hidden = true;
  if (skeleton) skeleton.hidden = true;
  if (list) list.hidden = false;
}

function createPickerRow({ id, selected, primary, secondary, onClick }) {
  const li = document.createElement('li');
  li.className = 'apply-template-item';
  if (selected) li.classList.add('is-selected');

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'apply-template-item-btn';
  btn.setAttribute('aria-pressed', selected ? 'true' : 'false');

  const nameEl = document.createElement('span');
  nameEl.className = 'apply-template-item-name';
  nameEl.textContent = primary;

  const metaEl = document.createElement('span');
  metaEl.className = 'apply-template-item-email';
  metaEl.textContent = secondary;

  btn.append(nameEl, metaEl);
  btn.addEventListener('click', () => onClick?.(id));
  li.append(btn);
  return li;
}
