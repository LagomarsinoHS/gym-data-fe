/**
 * Athlete Nutrición: read-only meal plans from GET /nutrition-plans.
 * Markup: #athlete-nutrition-view, #athlete-nutrition-delete-overlay
 */
import { deleteNutritionPlan, listNutritionPlans } from '../api/nutrition-plans.js';
import { getLang, ui } from '../utils/labels.js';

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
    plans = sortPlans(list);
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

function sortPlans(list) {
  return [...list].sort((a, b) => {
    const aArchived = a?.status === 'archived' ? 1 : 0;
    const bArchived = b?.status === 'archived' ? 1 : 0;
    if (aArchived !== bArchived) return aArchived - bArchived;
    return String(b?.validFrom || '').localeCompare(String(a?.validFrom || ''));
  });
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

function createMacrosRow(targets = {}) {
  const row = el('div', 'athlete-nutrition-macros');
  const items = [
    ['kcal', formatKcal(targets.calories), 'kcal'],
    ['protein', formatNumber(targets.proteinG), ui('athleteNutritionProteinShort')],
    ['carbs', formatNumber(targets.carbsG), ui('athleteNutritionCarbsShort')],
    ['fat', formatNumber(targets.fatG), ui('athleteNutritionFatShort')],
  ];
  for (const [kind, value, unit] of items) {
    const chip = el('span', `athlete-nutrition-macro is-${kind}`);
    const icon = el('span', `athlete-nutrition-macro-icon is-${kind}`);
    icon.setAttribute('aria-hidden', 'true');
    icon.textContent = kind === 'kcal' ? '🔥' : unit;
    chip.append(icon, el('strong', '', value), document.createTextNode(` ${unit}`));
    row.append(chip);
  }
  return row;
}

function planSubtitle(plan) {
  const title = String(plan?.title || '').trim();
  const coach = `${ui('athleteNutritionCoach')}: ${personName(plan?.coach)}`;
  return title ? `${title} • ${coach}` : coach;
}

function createPlanBody(plan, { includeTargets = true, includeTitle = false } = {}) {
  const wrap = el('div', 'athlete-nutrition-plan-content');
  const title = String(plan?.title || '').trim();
  if (includeTitle && title) wrap.append(el('h4', 'athlete-nutrition-plan-title', title));
  if (includeTargets) wrap.append(createMacrosRow(plan?.targets));

  const meals = Array.isArray(plan?.meals) ? plan.meals : [];
  if (!meals.length) {
    wrap.append(el('h4', 'athlete-nutrition-subtitle', ui('athleteNutritionMeals')));
    wrap.append(el('p', 'athlete-nutrition-muted', ui('athleteNutritionNoMeals')));
  } else {
    wrap.append(createMealsTimeline(meals));
  }

  const notes = String(plan?.generalNotes || '').trim();
  if (notes) {
    wrap.append(el('h4', 'athlete-nutrition-subtitle', ui('athleteNutritionNotes')));
    wrap.append(el('p', 'athlete-nutrition-notes', notes));
  }
  return wrap;
}

function createMealsTimeline(meals) {
  const timeline = el('div', 'athlete-nutrition-timeline');
  const rail = el('div', 'athlete-nutrition-timeline-rail');
  rail.setAttribute('aria-hidden', 'true');
  rail.append(
    el('span', 'athlete-nutrition-timeline-cap is-sun', '☀️'),
    el('span', 'athlete-nutrition-timeline-line'),
    el('span', 'athlete-nutrition-timeline-cap is-moon', '🌙'),
  );
  timeline.append(rail);

  const list = el('div', 'athlete-nutrition-timeline-list');
  meals.forEach((meal, index) => {
    list.append(createMeal(meal, { index, total: meals.length }));
  });
  timeline.append(list);
  return timeline;
}

function createMeal(meal, { index = 0, total = 1 } = {}) {
  const row = el('article', 'athlete-nutrition-timeline-item');

  const dot = el('span', 'athlete-nutrition-timeline-dot');
  dot.setAttribute('aria-hidden', 'true');
  row.append(dot);

  const time = String(meal?.time || '').trim();
  row.append(el('span', 'athlete-nutrition-meal-time', time || '—'));

  const card = el('div', 'athlete-nutrition-meal');
  const main = el('div', 'athlete-nutrition-meal-main');
  const icon = el('span', 'athlete-nutrition-meal-icon');
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = mealIcon(index, total);
  main.append(
    icon,
    el('h5', 'athlete-nutrition-meal-name', String(meal?.name || '').trim() || '—'),
  );

  const foods = Array.isArray(meal?.foods) ? meal.foods : [];
  if (foods.length) {
    const foodLine = foods
      .map((food) => {
        const name = String(food?.name || '').trim() || '—';
        const qty = formatNumber(food?.quantity);
        const unit = String(food?.unit || '').trim();
        return unit ? `${qty} ${unit} ${name}` : `${qty} ${name}`;
      })
      .join(' • ');
    main.append(el('p', 'athlete-nutrition-meal-foods', foodLine));
  }

  card.append(main);
  const mealNotes = String(meal?.notes || '').trim();
  const notesEl = el('p', 'athlete-nutrition-meal-notes', mealNotes);
  if (!mealNotes) notesEl.setAttribute('aria-hidden', 'true');
  card.append(notesEl);
  row.append(card);
  return row;
}

function mealIcon(index, total) {
  if (total <= 1) return '☀️';
  if (index === 0) return '🌅';
  if (index === total - 1) return '🌙';
  if (index === 1) return '☀️';
  return '🥗';
}

function personName(person) {
  return [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim() || '—';
}

function parsePlanDate(value) {
  if (!value) return null;
  const raw = value instanceof Date ? value.toISOString() : String(value).trim();
  const ymd = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [year, month, day] = ymd.split('-').map(Number);
    return new Date(year, month - 1, day, 12, 0, 0, 0);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatMonthYear(value) {
  const date = parsePlanDate(value);
  if (!date) return '—';
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  const raw = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatShortDate(value) {
  const date = parsePlanDate(value);
  if (!date) return '—';
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  return new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatKcal(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return new Intl.NumberFormat(getLang() === 'en' ? 'en-US' : 'es-CL', {
    maximumFractionDigits: 0,
  }).format(Math.round(num));
}

function formatNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return '—';
  return Number.isInteger(num) ? String(num) : String(Math.round(num * 10) / 10);
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null && text !== '') node.textContent = text;
  return node;
}
