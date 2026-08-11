/**
 * Coach — session templates library (list / create / edit / save).
 * Apply from Plantillas → athletes; Use template from Mis alumnos → POST /coach/templates/:id/apply.
 * Markup: #coach-templates-view, #apply-template-overlay, #use-template-overlay
 */
import { getCoachAthletes } from '../api/users.js';
import {
  getCoachTemplates,
  applyCoachTemplate,
} from '../api/coach-templates.js';
import { ui } from '../utils/labels.js';
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

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (applyOverlay?.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeApplyTemplateModal();
      return;
    }
    if (useOverlay?.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeUseTemplatesModal();
    }
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
    const res = await applyCoachTemplate(templateId, athleteIds);
    const applied = Array.isArray(res?.applied) ? res.applied.map(String) : [];
    const skipped = Array.isArray(res?.skipped) ? res.skipped.map(String) : [];
    const failed = Array.isArray(res?.failed) ? res.failed.map(String) : [];

    syncAppliedAthletesLocally(templateSnapshot, applied);

    const okCount = applied.length;
    const skippedCount = skipped.length;
    const failCount = failed.length;

    if (okCount > 0) store.refreshList();

    if (okCount === 0 && failCount > 0 && skippedCount === 0) {
      setApplyStatus(ui('templateApplyFail'), 'error');
      return;
    }

    closeApplyTemplateModal();

    if (okCount === 0 && skippedCount > 0 && failCount === 0) {
      setStatus(ui('templateApplyAllSkipped', templateName), 'ok');
    } else if (okCount === 1 && skippedCount === 0 && failCount === 0) {
      const name = athleteDisplayName(
        resolveAthleteForApply(applied[0]) || { id: applied[0] },
      );
      setStatus(ui('templateApplyOk', templateName, name), 'ok');
    } else if (skippedCount > 0 || failCount > 0) {
      setStatus(
        ui('templateApplyOkWithSkips', templateName, okCount, skippedCount + failCount),
        'ok',
      );
    } else {
      setStatus(ui('templateApplyOkMany', templateName, okCount), 'ok');
    }
  } catch (err) {
    console.error(err);
    setApplyStatus(ui('templateApplyFail'), 'error');
  } finally {
    applyBusy = false;
    syncApplyConfirm();
  }
}

/** Keep Mis alumnos store in sync after a successful server apply. */
function syncAppliedAthletesLocally(template, appliedIds) {
  const templateId = String(template?.id || '').trim();
  if (!templateId) return;

  for (const athleteId of appliedIds) {
    const target = findAthlete(athleteId);
    if (!target) continue;
    const sessions = ensureAthleteSessions(target);
    if (sessions.some((s) => String(s?.id || '') === templateId)) {
      clearAthleteDirty(athleteId);
      continue;
    }
    sessions.push({
      id: templateId,
      name: String(template?.name || '').trim() || ui('addSessionDefault', sessions.length + 1),
      order: sessions.length,
      items: mapTemplateItems(template),
    });
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

  let okCount = 0;
  let skippedCount = 0;
  let failCount = 0;
  /** @type {any[]} */
  const appliedTemplates = [];

  try {
    for (const templateId of templateIds) {
      const template = useTemplates.find((t) => String(t?.id) === templateId);
      const res = await applyCoachTemplate(templateId, [athleteId]);
      const applied = Array.isArray(res?.applied) ? res.applied.map(String) : [];
      const skipped = Array.isArray(res?.skipped) ? res.skipped.map(String) : [];
      const failed = Array.isArray(res?.failed) ? res.failed.map(String) : [];

      if (applied.includes(athleteId)) {
        okCount += 1;
        if (template) appliedTemplates.push(template);
      } else if (skipped.includes(athleteId)) {
        skippedCount += 1;
      } else if (failed.includes(athleteId) || failed.length || !applied.length) {
        failCount += 1;
      } else {
        skippedCount += 1;
      }
    }

    if (appliedTemplates.length) {
      for (const template of appliedTemplates) {
        syncAppliedAthletesLocally(template, [athleteId]);
      }
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
  for (const id of closeIds) {
    document.getElementById(id)?.addEventListener('click', onClose);
  }
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) onClose();
  });
  confirmBtn?.addEventListener('click', onConfirm);
  searchInput?.addEventListener('input', onSearch);
}

function setPickerStatus(el, message, kind = '') {
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    el.classList.remove('is-error', 'is-ok');
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle('is-error', kind === 'error');
  el.classList.toggle('is-ok', kind === 'ok');
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

function mapTemplateItems(template) {
  return (Array.isArray(template?.items) ? template.items : [])
    .map((item, index) => {
      const exerciseId = String(item?.exercise?.id || item?.exerciseId || '').trim();
      if (!exerciseId) return null;
      const payload = {
        exerciseId,
        order: item?.order ?? index,
      };
      if (item?.sets != null) payload.sets = item.sets;
      if (item?.reps) payload.reps = String(item.reps);
      if (item?.rest != null) payload.rest = item.rest;
      if (item?.notes != null && String(item.notes).trim() !== '') {
        payload.notes = String(item.notes).trim();
      }
      if (item?.exercise) payload.exercise = item.exercise;
      return payload;
    })
    .filter(Boolean);
}
