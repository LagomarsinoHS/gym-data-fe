/**
 * Athlete Nutrición: read-only meal plans from GET /nutrition-plans.
 * Markup: #athlete-nutrition-view, #athlete-nutrition-delete-overlay
 */
import { deleteNutritionPlan, listNutritionPlans } from '../api/nutrition-plans.js';
import { ui } from '../utils/labels.js';
import {
  createMacrosRow,
  createPlanBody,
  el,
  formatKcal,
  formatMonthYear,
  formatShortDate,
  personName,
  sortNutritionPlans,
} from './nutrition-plan-render.js';

/** @type {Array<object>} */
let plans = [];
let loading = false;
let loadError = false;
let loaded = false;
let loadSeq = 0;
/** @type {string | null} */
let openCurrentId = null;
/** @type {string | null} */
let openArchivedId = null;
/** @type {string | null} */
let pendingDeleteId = null;
let deleteBusy = false;

let deleteOverlay;
let deleteNameEl;
let deleteStatusEl;
let deleteConfirmBtn;

export function initAthleteNutritionUi() {
  deleteOverlay = document.getElementById('athlete-nutrition-delete-overlay');
  deleteNameEl = document.getElementById('athlete-nutrition-delete-name');
  deleteStatusEl = document.getElementById('athlete-nutrition-delete-status');
  deleteConfirmBtn = document.getElementById('athlete-nutrition-delete-confirm');

  document.getElementById('athlete-nutrition-retry')?.addEventListener('click', () => {
    void loadAthleteNutritionPlans();
  });
  document.getElementById('athlete-nutrition-delete-close')?.addEventListener('click', closeDeleteModal);
  document.getElementById('athlete-nutrition-delete-cancel')?.addEventListener('click', closeDeleteModal);
  deleteConfirmBtn?.addEventListener('click', () => {
    void confirmDeletePlan();
  });
  deleteOverlay?.addEventListener('click', (event) => {
    if (event.target === deleteOverlay) closeDeleteModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    if (!deleteOverlay?.classList.contains('open')) return;
    event.stopPropagation();
    closeDeleteModal();
  });
}

export function resetAthleteNutritionUi() {
  plans = [];
  loading = false;
  loadError = false;
  loaded = false;
  openCurrentId = null;
  openArchivedId = null;
  pendingDeleteId = null;
  deleteBusy = false;
  loadSeq += 1;
  deleteOverlay?.classList.remove('open');
  setDeleteStatus('');
}

export function syncAthleteNutritionLabels() {
  document.querySelectorAll(
    '#athlete-nutrition-view [data-ui], #athlete-nutrition-delete-overlay [data-ui]',
  ).forEach((node) => {
    node.textContent = ui(node.dataset.ui);
  });
  const bodyEl = document.getElementById('athlete-nutrition-body');
  if (loaded && !loading && !loadError && bodyEl && !bodyEl.hidden) {
    renderPlans(bodyEl);
  }
}

export function syncAthleteNutritionView() {
  const viewEl = document.getElementById('athlete-nutrition-view');
  if (!viewEl || viewEl.hidden) return;
  syncAthleteNutritionLabels();
  if (!loaded && !loading) {
    void loadAthleteNutritionPlans();
    return;
  }
  renderState();
}

export async function loadAthleteNutritionPlans() {
  const viewEl = document.getElementById('athlete-nutrition-view');
  if (!viewEl || viewEl.hidden) return;

  const seq = ++loadSeq;
  loading = true;
  loadError = false;
  renderState();

  try {
    const res = await listNutritionPlans();
    if (seq !== loadSeq) return;
    const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    plans = sortNutritionPlans(list);
    loaded = true;
    loading = false;
    if (openCurrentId && !plans.some((plan) => plan.id === openCurrentId && plan.status !== 'archived')) {
      openCurrentId = null;
    }
    if (openArchivedId && !plans.some((plan) => plan.id === openArchivedId && plan.status === 'archived')) {
      openArchivedId = null;
    }
    renderState();
  } catch {
    if (seq !== loadSeq) return;
    loading = false;
    loadError = true;
    loaded = false;
    renderState();
  }
}

function renderState() {
  const loadingEl = document.getElementById('athlete-nutrition-loading');
  const errorEl = document.getElementById('athlete-nutrition-error');
  const emptyEl = document.getElementById('athlete-nutrition-empty');
  const bodyEl = document.getElementById('athlete-nutrition-body');
  if (!loadingEl || !errorEl || !emptyEl || !bodyEl) return;

  const hasPlans = plans.length > 0;
  loadingEl.hidden = !loading;
  errorEl.hidden = loading || !loadError;
  emptyEl.hidden = loading || loadError || hasPlans;
  bodyEl.hidden = loading || loadError || !hasPlans;

  if (!bodyEl.hidden) renderPlans(bodyEl);
}

function renderPlans(root) {
  root.replaceChildren();

  const active = plans.filter((plan) => plan.status !== 'archived');
  const archived = plans.filter((plan) => plan.status === 'archived');

  if (active.length) {
    const section = el('section', 'athlete-nutrition-section');
    section.append(el('h3', 'athlete-nutrition-group-title', ui('athleteNutritionActive')));
    const list = el('div', 'athlete-nutrition-current-list');
    active.forEach((plan) => list.append(createCurrentCard(plan)));
    section.append(list);
    root.append(section);
  }

  if (archived.length) {
    const section = el('section', 'athlete-nutrition-section');
    section.append(el('h3', 'athlete-nutrition-group-title', ui('athleteNutritionArchived')));
    const list = el('div', 'athlete-nutrition-archive-list');
    archived.forEach((plan) => list.append(createArchivedCard(plan)));
    section.append(list);
    root.append(section);
  }
}

function createCurrentCard(plan) {
  const id = String(plan?.id || '');
  const open = Boolean(id) && id === openCurrentId;
  const card = el('article', `athlete-nutrition-current-card${open ? ' is-open' : ''}`);
  if (id) card.dataset.planId = id;

  const summary = el('div', 'athlete-nutrition-current-summary');
  const top = el('div', 'athlete-nutrition-current-top');
  top.append(
    el('span', 'athlete-nutrition-month', formatMonthYear(plan?.validFrom)),
    el('span', 'athlete-nutrition-status', ui('athleteNutritionStatusActive')),
  );

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'athlete-nutrition-view-btn';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.append(
    el('span', 'athlete-nutrition-view-label', ui(open ? 'athleteNutritionHidePlan' : 'athleteNutritionViewPlan')),
    el('span', 'athlete-nutrition-view-arrow', open ? '↑' : '→'),
  );
  toggle.addEventListener('click', () => {
    openCurrentId = open ? null : id;
    renderState();
  });

  const footer = el('div', 'athlete-nutrition-current-footer');
  footer.append(
    el(
      'p',
      'athlete-nutrition-valid',
      plan?.validFrom ? ui('athleteNutritionValidFrom', formatShortDate(plan.validFrom)) : '',
    ),
    toggle,
  );

  summary.append(
    top,
    el('p', 'athlete-nutrition-subtitle-line', planSubtitle(plan)),
    createMacrosRow(plan?.targets),
    footer,
  );

  const body = el('div', 'athlete-nutrition-detail');
  if (open) body.append(createPlanBody(plan, { includeTargets: false, includeTitle: false }));

  card.append(summary, body);
  return card;
}

function createArchivedCard(plan) {
  const id = String(plan?.id || '');
  const open = Boolean(id) && id === openArchivedId;
  const kcal = formatKcal(plan?.targets?.calories);
  const coach = personName(plan?.coach);

  const item = el('section', `athlete-nutrition-archive-item${open ? ' is-open' : ''}`);
  if (id) item.dataset.planId = id;

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'athlete-nutrition-archive-header';
  header.setAttribute('aria-expanded', String(open));

  const heading = el('span', 'athlete-nutrition-archive-heading');
  heading.append(
    el('span', 'athlete-nutrition-month', formatMonthYear(plan?.validFrom)),
    el('span', 'athlete-nutrition-archive-meta', `${kcal} kcal • ${coach}`),
  );
  const chevron = el('span', 'athlete-nutrition-chevron');
  chevron.setAttribute('aria-hidden', 'true');
  header.append(heading, chevron);
  header.addEventListener('click', () => {
    openArchivedId = open ? null : id;
    renderState();
  });

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'athlete-nutrition-archive-delete';
  removeBtn.setAttribute('aria-label', ui('athleteNutritionDeleteAria'));
  removeBtn.textContent = '✕';
  removeBtn.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    openDeleteModal(plan);
  });

  const body = el('div', 'athlete-nutrition-detail');
  if (open) body.append(createPlanBody(plan, { includeTargets: true, includeTitle: true }));

  item.append(removeBtn, header, body);
  return item;
}

function openDeleteModal(plan) {
  if (deleteBusy) return;
  pendingDeleteId = String(plan?.id || '') || null;
  if (!pendingDeleteId || !deleteOverlay) return;

  document.querySelectorAll('#athlete-nutrition-delete-overlay [data-ui]').forEach((node) => {
    node.textContent = ui(node.dataset.ui);
  });
  const title = String(plan?.title || '').trim();
  const month = formatMonthYear(plan?.validFrom);
  if (deleteNameEl) deleteNameEl.textContent = title ? `${month} · ${title}` : month;
  setDeleteStatus('');
  deleteOverlay.classList.add('open');
  deleteConfirmBtn?.focus();
}

function closeDeleteModal() {
  if (deleteBusy) return;
  deleteOverlay?.classList.remove('open');
  pendingDeleteId = null;
  setDeleteStatus('');
}

function setDeleteStatus(message, kind = '') {
  if (!deleteStatusEl) return;
  if (!message) {
    deleteStatusEl.hidden = true;
    deleteStatusEl.textContent = '';
    deleteStatusEl.classList.remove('is-error', 'is-ok');
    return;
  }
  deleteStatusEl.hidden = false;
  deleteStatusEl.textContent = message;
  deleteStatusEl.classList.toggle('is-error', kind === 'error');
  deleteStatusEl.classList.toggle('is-ok', kind === 'ok');
}

async function confirmDeletePlan() {
  if (deleteBusy || !pendingDeleteId) return;

  const planId = pendingDeleteId;
  deleteBusy = true;
  if (deleteConfirmBtn) deleteConfirmBtn.disabled = true;
  setDeleteStatus('');

  try {
    await deleteNutritionPlan(planId);
    deleteBusy = false;
    if (deleteConfirmBtn) deleteConfirmBtn.disabled = false;
    if (openArchivedId === planId) openArchivedId = null;
    closeDeleteModal();
    plans = plans.filter((plan) => plan.id !== planId);
    renderState();
  } catch {
    deleteBusy = false;
    if (deleteConfirmBtn) deleteConfirmBtn.disabled = false;
    setDeleteStatus(ui('athleteNutritionDeleteFail'), 'error');
  }
}

function planSubtitle(plan) {
  const title = String(plan?.title || '').trim();
  const coach = `${ui('athleteNutritionCoach')}: ${personName(plan?.coach)}`;
  return title ? `${title} • ${coach}` : coach;
}
