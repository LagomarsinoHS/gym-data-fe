/**
 * Coach — Pauta alimenticia (list/read) inside #nutrition-view workspace.
 * Create/edit editor lands next; stub panel is ready.
 * Markup: #nutrition-plan
 */
import { archiveNutritionPlan, listNutritionPlans } from '../api/nutrition-plans.js';
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
  document.querySelectorAll('#nutrition-plan [data-ui]').forEach((node) => {
    node.textContent = ui(node.dataset.ui);
  });
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
  root.replaceChildren();

  const active = plans.filter((plan) => plan.status !== 'archived');
  const archived = plans.filter((plan) => plan.status === 'archived');

  if (active.length) {
    const section = el('section', 'athlete-nutrition-section');
    section.append(el('h3', 'athlete-nutrition-group-title', ui('nutritionPlanActive')));
    const list = el('div', 'athlete-nutrition-current-list');
    for (const plan of active) {
      list.append(createCurrentCard(plan, { open: openCurrentId === plan.id }));
    }
    section.append(list);
    root.append(section);
  }

  if (archived.length) {
    const section = el('section', 'athlete-nutrition-section');
    section.append(el('h3', 'athlete-nutrition-group-title', ui('nutritionPlanArchived')));
    const list = el('div', 'athlete-nutrition-archive-list');
    for (const plan of archived) {
      list.append(createArchivedItem(plan, { open: openArchivedId === plan.id }));
    }
    section.append(list);
    root.append(section);
  }
}

function createCurrentCard(plan, { open }) {
  const card = el('article', `athlete-nutrition-current-card${open ? ' is-open' : ''}`);

  const summary = el('div', 'athlete-nutrition-current-summary');
  const top = el('div', 'athlete-nutrition-current-top');
  top.append(
    el('span', 'athlete-nutrition-month', formatMonthYear(plan?.validFrom)),
    el('span', 'athlete-nutrition-status', ui('athleteNutritionStatusActive')),
  );

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'athlete-nutrition-view-btn';
  toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  toggle.append(
    el('span', 'athlete-nutrition-view-label', ui(open ? 'athleteNutritionHidePlan' : 'athleteNutritionViewPlan')),
    el('span', 'athlete-nutrition-view-arrow', open ? '↑' : '→'),
  );
  toggle.addEventListener('click', () => {
    openCurrentId = open ? null : plan.id;
    openArchivedId = null;
    renderCoachNutritionPlan();
  });
  top.append(toggle);
  summary.append(top);

  const footer = el('div', 'athlete-nutrition-current-footer');
  footer.append(
    el(
      'p',
      'athlete-nutrition-valid',
      ui('athleteNutritionValidFrom', formatShortDate(plan?.validFrom)),
    ),
  );
  summary.append(
    el('p', 'athlete-nutrition-subtitle-line', planSubtitle(plan)),
    createMacrosRow(plan?.targets),
    footer,
  );

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
  summary.append(actions);

  const body = el('div', 'athlete-nutrition-detail');
  if (open) body.append(createPlanBody(plan, { includeTargets: false, includeTitle: false }));

  card.append(summary, body);
  return card;
}

function createArchivedItem(plan, { open }) {
  const item = el('section', `athlete-nutrition-archive-item${open ? ' is-open' : ''}`);

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'athlete-nutrition-archive-header';
  header.setAttribute('aria-expanded', open ? 'true' : 'false');
  const kcal = formatKcal(plan?.targets?.calories);
  const athlete = personName(plan?.athlete);
  const heading = el('span', 'athlete-nutrition-archive-heading');
  heading.append(
    el('span', 'athlete-nutrition-month', formatMonthYear(plan?.validFrom)),
    el('span', 'athlete-nutrition-archive-meta', `${kcal} kcal • ${athlete}`),
  );
  const chevron = el('span', 'athlete-nutrition-chevron');
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = open ? '▾' : '▸';
  header.append(heading, chevron);
  header.addEventListener('click', () => {
    openArchivedId = open ? null : plan.id;
    openCurrentId = null;
    renderCoachNutritionPlan();
  });

  const body = el('div', 'athlete-nutrition-detail');
  if (open) body.append(createPlanBody(plan, { includeTargets: true, includeTitle: true }));

  item.append(header, body);
  return item;
}

function planSubtitle(plan) {
  const title = String(plan?.title || '').trim();
  return title || '—';
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
