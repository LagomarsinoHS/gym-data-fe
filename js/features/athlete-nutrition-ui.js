/**
 * Athlete Nutrición: read-only meal plans from GET /nutrition-plans.
 * Markup: #athlete-nutrition-view, #athlete-nutrition-delete-overlay
 */
import { deleteNutritionPlan, listNutritionPlans } from '../api/nutrition-plans.js';
import { setInlineStatus } from '../utils/dom-status.js';
import { syncViewLabels, ui } from '../utils/labels.js';
import { bindOverlay } from '../utils/overlay.js';
import { renderNutritionPlansList } from './nutrition-plan-list-ui.js';
import {
  formatKcal,
  formatMonthYear,
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
  deleteConfirmBtn?.addEventListener('click', () => {
    void confirmDeletePlan();
  });
  bindOverlay({
    overlay: deleteOverlay,
    closeSelectors: ['#athlete-nutrition-delete-close', '#athlete-nutrition-delete-cancel'],
    onClose: closeDeleteModal,
    stopEscapePropagation: true,
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
  syncViewLabels('#athlete-nutrition-view');
  syncViewLabels('#athlete-nutrition-delete-overlay');
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
    const list = Array.isArray(res?.data) ? res.data : [];
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
  renderNutritionPlansList(root, {
    plans,
    openCurrentId,
    openArchivedId,
    activeTitle: ui('athleteNutritionActive'),
    archivedTitle: ui('athleteNutritionArchived'),
    currentSubtitle: planSubtitle,
    archivedMeta: archivedPlanMeta,
    onToggleCurrent: (planId) => {
      openCurrentId = openCurrentId === planId ? null : planId;
      renderState();
    },
    onToggleArchived: (planId) => {
      openArchivedId = openArchivedId === planId ? null : planId;
      renderState();
    },
    appendArchivedActions: (plan, itemEl) => {
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
      itemEl.prepend(removeBtn);
    },
  });
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
  setInlineStatus(deleteStatusEl, message, kind);
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

function archivedPlanMeta(plan) {
  const kcal = formatKcal(plan?.targets?.calories);
  const coach = personName(plan?.coach);
  return `${kcal} kcal • ${coach}`;
}
