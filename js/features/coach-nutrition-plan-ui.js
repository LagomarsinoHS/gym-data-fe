/**
 * Coach — Pauta alimenticia (list/read) inside #nutrition-view workspace.
 * Create/edit editor lands next; stub panel is ready.
 * Markup: #nutrition-plan
 */
import { archiveNutritionPlan, listNutritionPlans } from '../api/nutrition-plans.js';
import { syncViewLabels, ui } from '../utils/labels.js';
import { renderNutritionPlansList } from './nutrition-plan-list-ui.js';
import {
  el,
  formatKcal,
  personName,
  sortNutritionPlans,
} from './nutrition-plan-render.js';

/** @type {string | null} */
let athleteId = null;
/** @type {Array<object>} */
let plans = [];
let loading = false;
let loadError = false;
let loaded = false;
let loadSeq = 0;
/** @type {'list' | 'editor'} */
let panel = 'list';
/** @type {string | null} */
let openCurrentId = null;
/** @type {string | null} */
let openArchivedId = null;
let archiveBusy = false;

export function initCoachNutritionPlanUi() {
  document.getElementById('nutrition-plan-retry')?.addEventListener('click', () => {
    void loadCoachNutritionPlans();
  });
  document.getElementById('nutrition-plan-create')?.addEventListener('click', openEditorStub);
  document.getElementById('nutrition-plan-empty-create')?.addEventListener('click', openEditorStub);
  document.getElementById('nutrition-plan-editor-back')?.addEventListener('click', () => {
    panel = 'list';
    renderCoachNutritionPlan();
  });
}

export function resetCoachNutritionPlanUi() {
  athleteId = null;
  plans = [];
  loading = false;
  loadError = false;
  loaded = false;
  panel = 'list';
  openCurrentId = null;
  openArchivedId = null;
  archiveBusy = false;
  loadSeq += 1;
}

/**
 * Sync when coach workspace shows the Pauta mode for an athlete.
 * @param {{ athleteId: string | null, active: boolean }} opts
 */
export function syncCoachNutritionPlanUi({ athleteId: nextId, active }) {
  const planEl = document.getElementById('nutrition-plan');
  if (!planEl) return;

  planEl.hidden = !active;
  if (!active) return;

  syncCoachNutritionPlanLabels();

  const id = nextId ? String(nextId) : null;
  if (!id) {
    resetCoachNutritionPlanUi();
    renderCoachNutritionPlan();
    return;
  }

  if (id !== athleteId) {
    athleteId = id;
    plans = [];
    loaded = false;
    loadError = false;
    panel = 'list';
    openCurrentId = null;
    openArchivedId = null;
    void loadCoachNutritionPlans();
    return;
  }

  if (!loaded && !loading) {
    void loadCoachNutritionPlans();
    return;
  }
  renderCoachNutritionPlan();
}

export function syncCoachNutritionPlanLabels() {
  syncViewLabels('#nutrition-plan');
  const modeNav = document.getElementById('nutrition-mode-tabs');
  if (modeNav) modeNav.setAttribute('aria-label', ui('nutritionModeList'));
  const bodyEl = document.getElementById('nutrition-plan-body');
  if (loaded && !loading && !loadError && bodyEl && !bodyEl.hidden && panel === 'list') {
    renderPlans(bodyEl);
  }
}

async function loadCoachNutritionPlans() {
  if (!athleteId) return;

  const seq = ++loadSeq;
  loading = true;
  loadError = false;
  panel = 'list';
  renderCoachNutritionPlan();

  try {
    const res = await listNutritionPlans({ athleteId });
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
    renderCoachNutritionPlan();
  } catch {
    if (seq !== loadSeq) return;
    loading = false;
    loadError = true;
    loaded = false;
    renderCoachNutritionPlan();
  }
}

function openEditorStub() {
  panel = 'editor';
  renderCoachNutritionPlan();
}

function renderCoachNutritionPlan() {
  const loadingEl = document.getElementById('nutrition-plan-loading');
  const errorEl = document.getElementById('nutrition-plan-error');
  const emptyEl = document.getElementById('nutrition-plan-empty');
  const bodyEl = document.getElementById('nutrition-plan-body');
  const editorEl = document.getElementById('nutrition-plan-editor');
  const toolbarEl = document.getElementById('nutrition-plan-toolbar');
  const createBtn = document.getElementById('nutrition-plan-create');

  if (!loadingEl || !errorEl || !emptyEl || !bodyEl || !editorEl) return;

  const showEditor = panel === 'editor';
  const hasPlans = plans.length > 0;
  const showList = !showEditor && !loading && !loadError && hasPlans;
  const showEmpty = !showEditor && !loading && !loadError && !hasPlans && loaded;

  loadingEl.hidden = showEditor || !loading;
  errorEl.hidden = showEditor || loading || !loadError;
  emptyEl.hidden = !showEmpty;
  bodyEl.hidden = !showList;
  editorEl.hidden = !showEditor;
  if (toolbarEl) toolbarEl.hidden = showEditor;
  if (createBtn) createBtn.hidden = !showList;

  if (showList) renderPlans(bodyEl);
}

function renderPlans(root) {
  renderNutritionPlansList(root, {
    plans,
    openCurrentId,
    openArchivedId,
    activeTitle: ui('nutritionPlanActive'),
    archivedTitle: ui('nutritionPlanArchived'),
    currentSubtitle: planSubtitle,
    archivedMeta: archivedPlanMeta,
    onToggleCurrent: (planId) => {
      openCurrentId = openCurrentId === planId ? null : planId;
      openArchivedId = null;
      renderCoachNutritionPlan();
    },
    onToggleArchived: (planId) => {
      openArchivedId = openArchivedId === planId ? null : planId;
      openCurrentId = null;
      renderCoachNutritionPlan();
    },
    appendCurrentActions: (plan, summaryEl) => {
      const actions = el('div', 'nutrition-plan-card-actions');
      const archiveBtn = document.createElement('button');
      archiveBtn.type = 'button';
      archiveBtn.className = 'recommend-again-btn nutrition-plan-archive-btn';
      archiveBtn.textContent = ui('nutritionPlanArchive');
      archiveBtn.disabled = archiveBusy;
      archiveBtn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        void confirmArchive(plan);
      });
      actions.append(archiveBtn);
      summaryEl.append(actions);
    },
  });
}

function planSubtitle(plan) {
  const title = String(plan?.title || '').trim();
  return title || '—';
}

function archivedPlanMeta(plan) {
  const kcal = formatKcal(plan?.targets?.calories);
  const athlete = personName(plan?.athlete);
  return `${kcal} kcal • ${athlete}`;
}

async function confirmArchive(plan) {
  if (archiveBusy || !plan?.id) return;
  const ok = window.confirm(ui('nutritionPlanArchiveConfirm'));
  if (!ok) return;

  archiveBusy = true;
  renderCoachNutritionPlan();
  try {
    await archiveNutritionPlan(plan.id);
    archiveBusy = false;
    if (openCurrentId === plan.id) openCurrentId = null;
    await loadCoachNutritionPlans();
  } catch {
    archiveBusy = false;
    renderCoachNutritionPlan();
    window.alert(ui('nutritionPlanArchiveFail'));
  }
}
