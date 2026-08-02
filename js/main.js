/**
 * App entry: catálogo, filtros, grid, modal de ejercicio, WOD, idioma.
 * Markup: index.html (#exercise-grid, #modal-overlay, …).
 * Features: auth-ui.js, footer.js, easter-egg.js.
 */
import { isLoggedIn } from './api/token.js';
import { getEasterEgg, isEasterEggQuery, renderEasterEgg } from './features/easter-egg.js';
import { initFooter } from './features/footer.js';
import { initAuthUi, openAuth, syncAuthLabels } from './features/auth-ui.js';
import { initThemeUi } from './features/theme-ui.js';
import { initNavDrawer } from './features/nav-drawer.js';
import { initRecommendUi, syncRecommendLabels, renderRecommendPlan } from './features/recommend-ui.js';
import {
  initStudentsUi,
  syncStudentsLabels,
  loadCoachAthletes,
} from './features/students-ui.js';
import {
  initCoachPanelUi,
  refreshCoachPanel,
  syncCoachPanelLabels,
} from './features/coach-panel-ui.js';
import {
  getSessionAssignTarget,
  clearSessionAssignTarget,
  isExerciseInSession,
  getSessionExerciseItem,
  addExerciseToSession,
  updateSessionExercise,
  removeExerciseFromSession,
} from './features/coach-sessions-ui.js';
import { initCoachInviteUi, syncCoachInviteBanner } from './features/coach-invite-ui.js';
import {
  initSessionUi,
  restoreSession,
  setUser,
  setView,
  syncSessionLabels,
  getUser,
  getView,
  getProgramExerciseIds,
  isCoach,
} from './features/session-ui.js';
import { renderTrainingProgram, renderCoachTrainingProgram } from './features/training-ui.js';
import { getExercises, getExercise, getLabels, getRandomExercise, getRecommendedExercises } from './api/exercises.js';
import { addToTrainingProgram, removeTrainingProgramExercise, updateTrainingProgramExercise } from './api/users.js';
import { EQUIP_INITIAL } from './constants.js';
import { debounce, dedupeById } from './utils/helpers.js';
import { assetUrl } from './utils/assets.js';
import { fillCardMedia, wireCardGrid } from './utils/cards.js';
import { setLang, ui, label, exerciseName } from './utils/labels.js';
import { getStoredLang, setStoredLang } from './utils/prefs.js';
import { cleanReps, formatReps } from './utils/reps.js';
import { exerciseShareUrl, readExerciseFromUrl, syncExerciseInUrl } from './utils/url.js';

const FILTER_KEYS = ['category', 'equipment', 'target'];
const LANG_NAMES = { en: 'English', es: 'Español' };
const PAGE_SIZE = 12;

/** Card to soft-flash on training grid after closing the modal. */
let pendingTrainingFlashId = null;

// ── State ──────────────────────────────────────────
const state = {
  exercises: [],
  filtered: [],
  labels: { category: [], equipment: [], target: [] },
  wod: null,
  search: '',
  lang: getStoredLang(),
  filters: {
    category: new Set(),
    equipment: new Set(),
    target: new Set(),
  },
  page: 0,
  pages: 0,
  total: 0,
  loading: false,
  /** false hasta el primer fetch de catálogo (evita empty state prematuro) */
  catalogReady: false,
};

// ── DOM ────────────────────────────────────────────
const gridEl = document.getElementById('exercise-grid');
const sentinelEl = document.getElementById('load-sentinel');
const spinnerEl = document.getElementById('load-spinner');
const countEl = document.getElementById('results-count');
const activeFilEl = document.getElementById('active-filters');
const searchEl = document.getElementById('search');
const searchClearEl = document.getElementById('search-clear');
const modalOverlay = document.getElementById('modal-overlay');
const modalPanel = document.getElementById('modal-panel');
const modalTitle = document.getElementById('modal-title');
const modalGif = document.getElementById('modal-gif');
const modalMeta = document.getElementById('modal-meta');
const modalActions = document.getElementById('modal-actions');
const modalAddPlan = document.getElementById('modal-add-plan');
const modalPlanBtnLabel = document.getElementById('modal-plan-btn-label');
const modalPlanBtnFill = document.getElementById('modal-plan-btn-fill');
const modalRxBtn = document.getElementById('modal-rx-btn');
const modalRxForm = document.getElementById('modal-rx-form');
const modalRxSummary = document.getElementById('modal-rx-summary');
const modalRxSets = document.getElementById('modal-rx-sets');
const modalRxReps = document.getElementById('modal-rx-reps');
const modalRxRest = document.getElementById('modal-rx-rest');
const modalRxNotes = document.getElementById('modal-rx-notes');
const modalRxStatus = document.getElementById('modal-rx-status');
const modalRxSubmit = document.getElementById('modal-rx-submit');
const modalMuscles = document.getElementById('modal-muscles');
const modalInstr = document.getElementById('modal-instructions');
const modalClose = document.getElementById('modal-close');
const modalShare = document.getElementById('modal-share');
const modalShareFeedback = document.getElementById('modal-share-feedback');
const langToggle = document.getElementById('lang-toggle');
const wodBtn = document.getElementById('wod-btn');

// ── Boot ───────────────────────────────────────────
async function init() {
  syncChromeLabels();

  const labels = await getLabels();
  state.labels = {
    category: labels.category,
    equipment: labels.equipment,
    target: labels.target,
  };

  initSessionUi({
    onViewChange(view) {
      if (view === 'training') refreshTrainingGrid();
      else if (view === 'coach-plan') refreshCoachPlanGrid();
      else if (view === 'coach-panel') void refreshCoachPanel();
      else if (view === 'students') void loadCoachAthletes();
      else if (view === 'catalog') reloadExercises();
    },
  });
  initAuthUi({
    onAuthSuccess: async () => {
      await restoreSession();
      setView(isCoach() ? 'coach-panel' : 'training');
      if (modalOverlay.classList.contains('open') && modalOverlay.dataset.openId) {
        syncPlanAction(modalOverlay.dataset.openId);
      }
    },
  });
  initThemeUi();
  initNavDrawer();
  initStudentsUi({
    navigateTo: setView,
    openExercise: id => openModal(id),
  });
  initCoachPanelUi();
  initCoachInviteUi();
  initRecommendUi({
    getFilterLabels: () => state.labels,
    onSubmit: async ({ zone, equipment }) => {
      const plan = await getRecommendedExercises({ zone, equipment });
      for (const item of plan?.exercises || []) {
        const ex = item.exercise || item;
        if (ex?.id) upsertExercise(ex);
      }
      renderRecommendPlan(plan);
    },
  });

  applyLanguage();
  initFilterAccordions();
  revealFilters();
  collapseFiltersOnMobile();
  initResultsBarPlacement();
  await restoreSession();
  await reloadExercises();
  wireEvents();
  initFooter();

  const deepLinked = readExerciseFromUrl();
  if (deepLinked) openModal(deepLinked);
}

function isIdSearch(q = state.search) {
  return /^\d+$/.test(String(q).trim());
}

function activeFilters() {
  return {
    category: [...state.filters.category][0],
    equipment: [...state.filters.equipment][0],
    target: [...state.filters.target][0],
    search: state.search.trim(),
  };
}

function filterQueryParams() {
  const { category, equipment, target, search } = activeFilters();
  const params = {};
  if (category) params.category = category;
  if (equipment) params.equipment = equipment;
  if (target) params.target = target;
  if (search && !isIdSearch(search) && !isEasterEggQuery(search)) {
    params.search = search;
  }
  return params;
}

function hasMorePages() {
  return state.page < state.pages;
}

let listRequestId = 0;

async function reloadExercises() {
  if (getView() === 'training') {
    refreshTrainingGrid();
    return;
  }
  listRequestId++;
  state.exercises = [];
  state.filtered = [];
  state.page = 0;
  state.pages = 0;
  state.total = 0;
  state.loading = false;
  state.catalogReady = false;
  showCatalogLoading();
  updateResultsBar();
  updateActiveBadges();
  await loadNextPage();
}

function refreshTrainingGrid({ highlightId } = {}) {
  const { search } = activeFilters();
  renderTrainingProgram(getUser(), { search, highlightId });
  updateActiveBadges();
}

function refreshCoachPlanGrid() {
  renderCoachTrainingProgram(getUser());
}

async function loadNextPage() {
  if (getView() === 'training') return;
  if (state.loading || (state.page > 0 && !hasMorePages())) return;
  if (isIdSearch() || isEasterEggQuery(state.search)) return;

  const requestId = listRequestId;
  state.loading = true;
  spinnerEl.classList.add('visible');

  try {
    const nextPage = state.page + 1;
    const data = await getExercises({
      page: nextPage,
      limit: PAGE_SIZE,
      ...filterQueryParams(),
    });
    if (requestId !== listRequestId) return;

    const items = data.data;
    items.forEach(upsertExercise);
    state.page = data.page;
    state.pages = data.pages;
    state.total = data.total;

    if (nextPage === 1) {
      state.catalogReady = true;
      syncGrid();
    } else {
      const unique = dedupeById(items);
      const wasEmpty = state.filtered.length === 0;
      state.filtered.push(...unique);
      state.filtered = dedupeById(state.filtered);
      if (unique.length) {
        if (wasEmpty) renderGrid();
        else appendCards(unique);
      }
      updateResultsBar();
    }
  } finally {
    if (requestId !== listRequestId) return;
    state.loading = false;
    spinnerEl.classList.toggle('visible', hasMorePages());
    if (hasMorePages()) {
      requestAnimationFrame(() => {
        if (requestId !== listRequestId) return;
        const { top } = sentinelEl.getBoundingClientRect();
        if (top < window.innerHeight + 200) loadNextPage();
      });
    }
  }
}

function upsertExercise(exercise) {
  const i = state.exercises.findIndex(e => String(e.id) === String(exercise.id));
  if (i >= 0) state.exercises[i] = exercise;
  else state.exercises.push(exercise);
}

function syncChromeLabels() {
  setLang(state.lang);
  document.documentElement.lang = state.lang;
  document.querySelectorAll('[data-ui]').forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });
  document.querySelectorAll('.lang-toggle-btn').forEach(btn => {
    const active = btn.dataset.lang === state.lang;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-pressed', String(active));
  });
  const onTraining = getView() === 'training' && Boolean(getUser());
  searchEl.placeholder = onTraining ? ui('searchTraining') : ui('search');
  syncAuthLabels();
  syncSessionLabels();
  syncRecommendLabels();
  syncStudentsLabels();
  syncCoachPanelLabels();
  syncCoachInviteBanner();
}

function revealFilters() {
  const status = document.getElementById('sidebar-filters-status');
  const filters = document.getElementById('sidebar-filters');
  status?.setAttribute('hidden', '');
  filters?.removeAttribute('hidden');

  if (!filters) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  filters.querySelectorAll('.filter-section').forEach((section, sectionIndex) => {
    section.style.setProperty('--section-i', String(sectionIndex));
    section.querySelectorAll('.chip').forEach((chip, chipIndex) => {
      chip.style.setProperty('--chip-i', String(Math.min(chipIndex, 10)));
    });
  });

  filters.classList.remove('is-revealing');
  void filters.offsetWidth;
  filters.classList.add('is-revealing');

  window.clearTimeout(revealFilters._timer);
  revealFilters._timer = window.setTimeout(() => {
    filters.classList.remove('is-revealing');
  }, 700);
}

function applyLanguage() {
  syncChromeLabels();

  buildFilterOptions();
  syncActiveChips();
  syncGrid();

  syncShareButtonLabels();
  if (modalOverlay.classList.contains('open') && modalOverlay.dataset.openId) {
    syncPlanAction(modalOverlay.dataset.openId);
  }
  if (getView() === 'training') refreshTrainingGrid();

  if (modalOverlay.classList.contains('open') && modalOverlay.dataset.openId) {
    openModal(modalOverlay.dataset.openId);
  }
}

function syncActiveChips() {
  document.querySelectorAll('.chip[data-filter]').forEach(chip => {
    const active = state.filters[chip.dataset.filter]?.has(chip.dataset.value);
    chip.classList.toggle('active', Boolean(active));
  });
}

// ── Filters ────────────────────────────────────────
function sortedFilterValues(values) {
  const unique = [...new Set(values)];
  unique.sort((a, b) => {
    const textA = label(a);
    const textB = label(b);
    return textA.localeCompare(textB, state.lang, { sensitivity: 'base' });
  });
  return unique;
}

function buildFilterOptions() {
  renderChips('category-chips', sortedFilterValues(state.labels.category), 'category');
  renderChips('equipment-chips', sortedFilterValues(state.labels.equipment), 'equipment', EQUIP_INITIAL);
  renderChips('target-chips', sortedFilterValues(state.labels.target), 'target', EQUIP_INITIAL);
  syncFilterSectionHints();
}

/** Hint en el título si la sección está colapsada y hay filtro activo. */
function syncFilterSectionHints() {
  document.querySelectorAll('.filter-section[data-filter-key]').forEach(section => {
    const key = section.dataset.filterKey;
    const hint = section.querySelector('.filter-summary-hint');
    if (!hint) return;

    const selected = [...(state.filters[key] || [])][0];
    const collapsed = section.classList.contains('is-collapsed');
    section.classList.toggle('has-active-filter', Boolean(selected));

    if (collapsed && selected) {
      hint.hidden = false;
      hint.textContent = label(selected);
    } else {
      hint.hidden = true;
      hint.textContent = '';
    }
  });
}

function initFilterAccordions() {
  document.querySelectorAll('.filter-summary').forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.closest('.filter-section');
      if (!section) return;
      const collapsed = section.classList.toggle('is-collapsed');
      btn.setAttribute('aria-expanded', String(!collapsed));
      syncFilterSectionHints();
    });
  });
}

/** En móvil: filtros cerrados por defecto para no comer viewport. */
function collapseFiltersOnMobile() {
  if (!window.matchMedia('(max-width: 768px)').matches) return;

  document.querySelectorAll('.filter-section').forEach(section => {
    section.classList.add('is-collapsed');
    section.querySelector('.filter-summary')?.setAttribute('aria-expanded', 'false');
  });
  syncFilterSectionHints();
}

/**
 * Keep results-bar in main (search stays visible on mobile with hamburger drawer).
 */
function placeResultsBarForViewport() {
  const bar = document.querySelector('.results-bar');
  const main = document.querySelector('.main-content');
  if (!bar || !main) return;
  if (bar.parentElement === main && main.firstElementChild === bar) return;
  main.insertBefore(bar, main.firstElementChild);
}

function initResultsBarPlacement() {
  placeResultsBarForViewport();
  window.matchMedia('(max-width: 768px)').addEventListener('change', placeResultsBarForViewport);
}

function renderChips(containerId, values, filterKey, pageSize = null) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  if (!pageSize || values.length <= pageSize) {
    values.forEach(val => container.appendChild(makeChip(val, filterKey)));
    return;
  }

  let shown = 0;
  const moreBtn = document.createElement('button');
  moreBtn.type = 'button';
  moreBtn.className = 'chip filter-show-more';

  const syncMoreBtn = () => {
    const remaining = values.length - shown;
    if (remaining <= 0) {
      moreBtn.remove();
      return;
    }
    moreBtn.textContent = ui('remaining', remaining);
    if (!moreBtn.isConnected) container.appendChild(moreBtn);
  };

  const revealNext = (count) => {
    const end = Math.min(shown + count, values.length);
    const frag = document.createDocumentFragment();
    for (let i = shown; i < end; i++) {
      frag.appendChild(makeChip(values[i], filterKey));
    }
    container.insertBefore(frag, moreBtn.isConnected ? moreBtn : null);
    shown = end;
    syncActiveChips();
    syncMoreBtn();
  };

  // Primera tanda; si hay filtro activo oculto, revelar lotes hasta incluirlo
  let initial = pageSize;
  state.filters[filterKey]?.forEach(val => {
    const idx = values.indexOf(val);
    if (idx >= initial) {
      initial = Math.ceil((idx + 1) / pageSize) * pageSize;
    }
  });

  revealNext(Math.min(initial, values.length));
  moreBtn.addEventListener('click', () => revealNext(pageSize));
}

function makeChip(value, filterKey) {
  const btn = document.createElement('button');
  btn.className = 'chip';
  btn.textContent = label(value);
  btn.dataset.filter = filterKey;
  btn.dataset.value = value; // English key for filtering
  return btn;
}

/** Refresh grid from current in-memory list (server already filtered). */
function syncGrid() {
  state.filtered = dedupeById(state.exercises);
  renderGrid();
  updateResultsBar();
  updateActiveBadges();
  spinnerEl.classList.toggle('visible', hasMorePages() && !isIdSearch());
}

function clearAllFilters() {
  FILTER_KEYS.forEach(key => state.filters[key].clear());
  state.search = '';
  searchEl.value = '';
  searchClearEl.classList.remove('visible');
  document.querySelectorAll('.chip.active').forEach(c => c.classList.remove('active'));
  reloadExercises();
}

// ── Grid ───────────────────────────────────────────
function appendCards(exercises) {
  const frag = document.createDocumentFragment();
  exercises.forEach((exercise, i) => {
    const card = createCard(exercise);
    card.classList.add('card-enter');
    card.style.setProperty('--card-i', String(Math.min(i, 11)));
    frag.appendChild(card);
  });
  gridEl.appendChild(frag);
}

function showCatalogLoading() {
  gridEl.innerHTML = `
    <div class="catalog-boot-loading">
      <div class="load-spinner visible" aria-hidden="true"></div>
      <span>${ui('loading')}</span>
    </div>
  `;
}

function renderGrid() {
  gridEl.innerHTML = '';

  if (state.filtered.length === 0) {
    // Solo “cargando” antes del primer response; si ya respondió vacío → empty state
    if (!state.catalogReady) {
      showCatalogLoading();
      return;
    }
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `<p>🔍</p><p>${ui('empty')}</p>`;
    gridEl.appendChild(empty);
    return;
  }

  appendCards(state.filtered);
}

function createCard(exercise) {
  const article = document.createElement('article');
  article.className = 'exercise-card';
  article.dataset.id = exercise.id;
  article.innerHTML = `
    <div class="card-media">
      <img class="card-thumb" loading="lazy" alt="" />
      <img class="card-gif" alt="" />
    </div>
    <div class="card-body">
      <h3 class="card-name"></h3>
      <div class="card-tags">
        <span class="tag tag-cat"></span>
        <span class="tag tag-equip"></span>
      </div>
    </div>`;

  fillCardMedia(article, exercise);
  return article;
}

function updateResultsBar() {
  if (!state.catalogReady) {
    countEl.textContent = '';
    return;
  }
  countEl.textContent = ui('exercises', state.total);
}

function updateActiveBadges() {
  activeFilEl.innerHTML = '';
  let hasAny = false;

  FILTER_KEYS.forEach(key => {
    state.filters[key].forEach(val => {
      hasAny = true;
      const shown = label(val);
      const badge = document.createElement('span');
      badge.className = 'active-badge';
      badge.innerHTML = `${shown}<button class="active-badge-remove" data-filter="${key}" data-value="${val}" aria-label="Remove ${shown}">×</button>`;
      activeFilEl.appendChild(badge);
    });
  });

  syncFilterSectionHints();

  if (!hasAny) return;

  const clearAll = document.createElement('button');
  clearAll.className = 'clear-all';
  clearAll.textContent = ui('clearAll');
  clearAll.addEventListener('click', clearAllFilters);
  activeFilEl.appendChild(clearAll);
}

// ── Modal ──────────────────────────────────────────
let modalRequestId = 0;
let modalCloseClearTimer = 0;

function findCachedExercise(id) {
  const key = String(id);
  const fromCatalog = state.exercises.find(e => String(e.id) === key);
  if (fromCatalog) return fromCatalog;
  if (state.wod && String(state.wod.id) === key) return state.wod;
  const fromProgram = getUser()?.trainingProgram
    ?.find(item => String(item.exercise?.id || item.exerciseId) === key)
    ?.exercise;
  return fromProgram || null;
}

async function openModal(id) {
  if (id == null || id === '') return;
  const requestId = ++modalRequestId;
  const wasOpen = modalOverlay.classList.contains('open');

  window.clearTimeout(modalCloseClearTimer);
  modalOverlay.classList.add('open');
  modalOverlay.dataset.openId = id;
  document.body.style.overflow = 'hidden';
  syncExerciseInUrl(id);
  syncShareButtonLabels();
  modalClose.focus();

  if (wasOpen && modalPanel) {
    modalPanel.classList.remove('is-swap');
    void modalPanel.offsetWidth;
    modalPanel.classList.add('is-swap');
  }

  const cached = findCachedExercise(id);
  if (cached) fillModal(cached);

  try {
    const exercise = await getExercise(id);
    if (requestId !== modalRequestId) return;
    upsertExercise(exercise);
    fillModal(exercise);
  } catch (err) {
    console.error(err);
    if (requestId !== modalRequestId) return;
    if (!cached) closeModal();
  }
}

function fillModal(exercise) {
  const name = exerciseName(exercise);
  modalTitle.textContent = name;
  modalGif.src = assetUrl(exercise.gif_url);
  modalGif.alt = name;

  renderModalMeta(exercise);
  syncPlanAction(exercise.id);
  renderModalMuscles(exercise);
  renderModalInstructions(exercise);
}

function setPlanBtnLabel(text) {
  if (modalPlanBtnLabel) modalPlanBtnLabel.textContent = text;
  else if (modalAddPlan) modalAddPlan.textContent = text;
}

function stopPlanUndoFill() {
  if (!modalPlanBtnFill) return;
  modalPlanBtnFill.hidden = true;
  modalPlanBtnFill.style.animation = 'none';
  modalPlanBtnFill.style.width = '0%';
}

function startPlanUndoFill() {
  if (!modalPlanBtnFill) return;
  modalPlanBtnFill.hidden = false;
  modalPlanBtnFill.style.width = '';
  modalPlanBtnFill.style.animation = 'none';
  // restart CSS animation
  void modalPlanBtnFill.offsetWidth;
  modalPlanBtnFill.style.animation = '';
}

function syncPlanAction(exerciseId) {
  if (!modalAddPlan) return;

  exerciseId = String(exerciseId || '');
  modalAddPlan.classList.remove('is-in-plan', 'is-remove', 'is-undo', 'is-busy');
  stopPlanUndoFill();
  delete modalAddPlan.dataset.error;

  // Coach: browse-only, unless assigning exercises to an athlete session
  if (isCoach()) {
    const assign = getSessionAssignTarget();
    if (!assign) {
      modalAddPlan.hidden = true;
      setPrescriptionEditorVisible(false);
      if (modalActions) modalActions.hidden = true;
      return;
    }

    if (modalActions) modalActions.hidden = !exerciseId;
    modalAddPlan.hidden = !exerciseId;
    if (!exerciseId) {
      setPrescriptionEditorVisible(false);
      return;
    }

    const inSession = isExerciseInSession(assign.athleteId, assign.sessionId, exerciseId);
    if (inSession) {
      modalAddPlan.disabled = false;
      modalAddPlan.dataset.mode = 'session-remove';
      modalAddPlan.classList.add('is-remove');
      setPlanBtnLabel(ui('sessionRemoveExercise'));
      setPrescriptionEditorVisible(true, { keepOpen: false });
      return;
    }

    modalAddPlan.disabled = false;
    modalAddPlan.dataset.mode = 'session-add';
    setPlanBtnLabel(ui('sessionAddTo'));
    setPrescriptionEditorVisible(false);
    return;
  }

  if (modalActions) modalActions.hidden = !exerciseId;
  modalAddPlan.hidden = !exerciseId;

  if (!exerciseId) {
    setPrescriptionEditorVisible(false);
    return;
  }

  if (!getUser()) {
    modalAddPlan.disabled = false;
    modalAddPlan.dataset.mode = 'login';
    setPlanBtnLabel(ui('addToPlanLogin'));
    setPrescriptionEditorVisible(false);
    return;
  }

  const inPlan = getProgramExerciseIds().includes(exerciseId);

  // Mi entrenamiento: quitar (no mostrar "En tu plan")
  if (getView() === 'training' && inPlan) {
    modalAddPlan.disabled = false;
    modalAddPlan.dataset.mode = 'remove';
    modalAddPlan.classList.add('is-remove');
    setPlanBtnLabel(ui('removeFromPlan'));
    setPrescriptionEditorVisible(true, { keepOpen: false });
    return;
  }

  modalAddPlan.dataset.mode = inPlan ? 'in-plan' : 'add';
  modalAddPlan.disabled = inPlan;
  modalAddPlan.classList.toggle('is-in-plan', inPlan);
  setPlanBtnLabel(ui(inPlan ? 'inPlan' : 'addToPlan'));
  setPrescriptionEditorVisible(inPlan, { keepOpen: false });
}

function getProgramItem(exerciseId) {
  exerciseId = String(exerciseId || '');
  const user = getUser();
  if (!exerciseId || !user) return null;
  return (user.trainingProgram || []).find(
    item => String(item.exercise?.id || item.exerciseId) === exerciseId,
  ) || null;
}

/** Athlete plan item, or coach session item while assigning. */
function getActiveProgramItem(exerciseId) {
  exerciseId = String(exerciseId || '');
  if (!exerciseId) return null;

  const assign = getSessionAssignTarget();
  if (isCoach() && assign) {
    return getSessionExerciseItem(assign.athleteId, assign.sessionId, exerciseId);
  }
  return getProgramItem(exerciseId);
}

function setPrescriptionEditorVisible(visible, { keepOpen = false } = {}) {
  if (modalRxBtn) {
    modalRxBtn.hidden = !visible;
    modalRxBtn.title = ui('editPrescription');
  }
  if (!visible) {
    collapsePrescriptionForm({ instant: true });
    syncPrescriptionSummary(null);
    return;
  }
  if (!keepOpen) collapsePrescriptionForm({ instant: true });
  populatePrescriptionForm(modalOverlay.dataset.openId);
  if (!keepOpen && modalRxForm?.hidden) {
    syncPrescriptionSummary(modalOverlay.dataset.openId);
  }
}

/** @param {{ instant?: boolean }} [opts] */
function collapsePrescriptionForm({ instant = false } = {}) {
  modalRxBtn?.classList.remove('is-open');
  modalRxBtn?.setAttribute('aria-expanded', 'false');
  setPrescriptionStatus('');

  if (!modalRxForm) return Promise.resolve();
  if (modalRxForm.hidden && !modalRxForm.classList.contains('is-open')) {
    return Promise.resolve();
  }

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (instant || prefersReduced) {
    modalRxForm.classList.remove('is-open');
    modalRxForm.hidden = true;
    return Promise.resolve();
  }

  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      modalRxForm.hidden = true;
      modalRxForm.removeEventListener('transitionend', onEnd);
      window.clearTimeout(fallback);
      resolve();
    };
    const onEnd = e => {
      if (e.target !== modalRxForm) return;
      if (e.propertyName !== 'opacity' && e.propertyName !== 'max-height') return;
      finish();
    };
    modalRxForm.addEventListener('transitionend', onEnd);
    const fallback = window.setTimeout(finish, 260);
    // Ensure a frame so the browser applies the open styles before closing
    requestAnimationFrame(() => {
      modalRxForm.classList.remove('is-open');
    });
  });
}

function openPrescriptionForm() {
  if (!modalRxForm) return;
  populatePrescriptionForm(modalOverlay.dataset.openId);
  modalRxForm.hidden = false;
  modalRxBtn?.classList.add('is-open');
  modalRxBtn?.setAttribute('aria-expanded', 'true');
  syncPrescriptionSummary(modalOverlay.dataset.openId);
  requestAnimationFrame(() => {
    modalRxForm.classList.add('is-open');
    modalRxSets?.focus();
  });
}

function syncPrescriptionSummary(exerciseId, { celebrate = false } = {}) {
  if (!modalRxSummary) return;

  // Hide while editing
  if (modalRxForm && !modalRxForm.hidden) {
    modalRxSummary.hidden = true;
    return;
  }

  if (exerciseId == null || modalRxBtn?.hidden) {
    modalRxSummary.hidden = true;
    modalRxSummary.replaceChildren();
    modalRxSummary.classList.remove('is-empty', 'is-saved-pop');
    return;
  }

  const item = getActiveProgramItem(exerciseId);
  const metrics = [];
  if (item?.sets != null) {
    metrics.push({ ico: '🏋️', text: String(item.sets) });
  }
  if (item?.reps) {
    metrics.push({ ico: '🔁', text: String(item.reps) });
  }
  if (item?.rest != null) {
    metrics.push({ ico: '⏱️', text: `${item.rest}s` });
  }
  const note = item?.notes ? String(item.notes).trim() : '';

  modalRxSummary.replaceChildren();
  modalRxSummary.classList.remove('is-saved-pop');

  if (!metrics.length && !note) {
    modalRxSummary.hidden = false;
    modalRxSummary.classList.add('is-empty');
    const empty = document.createElement('p');
    empty.className = 'modal-rx-summary-empty';
    empty.textContent = ui('programBare');
    modalRxSummary.appendChild(empty);
    return;
  }

  modalRxSummary.hidden = false;
  modalRxSummary.classList.remove('is-empty');

  if (metrics.length) {
    const row = document.createElement('div');
    row.className = 'modal-rx-metrics';
    metrics.forEach((m, i) => {
      const chip = document.createElement('span');
      chip.className = 'modal-rx-metric';
      if (celebrate) {
        chip.classList.add('is-pop');
        chip.style.setProperty('--rx-pop-delay', `${i * 45}ms`);
      }
      const ico = document.createElement('span');
      ico.className = 'modal-rx-metric-ico';
      ico.setAttribute('aria-hidden', 'true');
      ico.textContent = m.ico;
      const labelEl = document.createElement('span');
      labelEl.textContent = m.text;
      chip.append(ico, labelEl);
      row.appendChild(chip);
    });
    modalRxSummary.appendChild(row);
  }

  if (note) {
    const noteEl = document.createElement('p');
    noteEl.className = 'modal-rx-summary-note';
    if (celebrate) noteEl.classList.add('is-fade');
    noteEl.textContent = note;
    modalRxSummary.appendChild(noteEl);
  }

  if (celebrate) {
    requestAnimationFrame(() => {
      modalRxSummary.classList.add('is-saved-pop');
    });
  }
}

async function togglePrescriptionForm() {
  if (!modalRxForm || modalRxBtn?.hidden) return;
  if (modalRxForm.hidden || !modalRxForm.classList.contains('is-open')) {
    openPrescriptionForm();
  } else {
    await collapsePrescriptionForm();
    syncPrescriptionSummary(modalOverlay.dataset.openId);
  }
}

function populatePrescriptionForm(exerciseId) {
  const item = getActiveProgramItem(exerciseId);
  if (modalRxSets) modalRxSets.value = item?.sets != null ? String(item.sets) : '';
  if (modalRxReps) modalRxReps.value = item?.reps ? cleanReps(item.reps) : '';
  if (modalRxRest) modalRxRest.value = item?.rest != null ? String(item.rest) : '';
  if (modalRxNotes) modalRxNotes.value = item?.notes ? String(item.notes) : '';
  setPrescriptionStatus('');
}

function setPrescriptionStatus(message, kind = '') {
  if (!modalRxStatus) return;
  if (!message) {
    modalRxStatus.hidden = true;
    modalRxStatus.textContent = '';
    modalRxStatus.classList.remove('is-error', 'is-ok');
    return;
  }
  modalRxStatus.hidden = false;
  modalRxStatus.textContent = message;
  modalRxStatus.classList.toggle('is-error', kind === 'error');
  modalRxStatus.classList.toggle('is-ok', kind === 'ok');
}

function buildPrescriptionUpdate() {
  const updates = {};
  const setsRaw = modalRxSets?.value.trim() ?? '';
  const repsRaw = modalRxReps?.value.trim() ?? '';
  const restRaw = modalRxRest?.value.trim() ?? '';
  const notesRaw = modalRxNotes?.value ?? '';

  if (setsRaw !== '') {
    const sets = Number(setsRaw);
    if (!Number.isInteger(sets) || sets < 1) return { error: ui('prescriptionNeedField') };
    updates.sets = sets;
  }
  if (repsRaw) {
    const reps = formatReps(repsRaw);
    if (!reps) return { error: ui('prescriptionRepsFormat') };
    updates.reps = reps;
  }
  if (restRaw !== '') {
    const rest = Number(restRaw);
    if (!Number.isInteger(rest) || rest < 0) return { error: ui('prescriptionNeedField') };
    updates.rest = rest;
  }
  if (notesRaw.trim() !== '') updates.notes = notesRaw.trim();

  if (!Object.keys(updates).length) return { error: ui('prescriptionNeedField') };
  return { updates };
}

async function onPrescriptionSubmit(e) {
  e.preventDefault();
  const exerciseId = String(modalOverlay.dataset.openId || '');
  if (!exerciseId || !getUser()) return;

  const built = buildPrescriptionUpdate();
  if (built.error) {
    setPrescriptionStatus(built.error, 'error');
    return;
  }

  if (modalRxSubmit) modalRxSubmit.disabled = true;
  setPrescriptionStatus('');

  try {
    const assign = getSessionAssignTarget();
    if (isCoach() && assign) {
      const ok = updateSessionExercise(
        assign.athleteId,
        assign.sessionId,
        exerciseId,
        built.updates,
      );
      if (!ok) throw new Error('session exercise missing');
      await collapsePrescriptionForm();
      closeModal();
      clearSessionAssignTarget();
      setView('session-editor');
      return;
    }

    await applyUserUpdate(
      await updateTrainingProgramExercise(exerciseId, built.updates),
      { highlightId: exerciseId },
    );
    await collapsePrescriptionForm();
    syncPrescriptionSummary(exerciseId, { celebrate: true });
  } catch (err) {
    console.error(err);
    setPrescriptionStatus(ui('prescriptionSaveFail'), 'error');
  } finally {
    if (modalRxSubmit) modalRxSubmit.disabled = false;
  }
}

let planUndoTimer = 0;
/** @type {{ exerciseId: string, prevUser: object } | null} */
let planUndoSnapshot = null;

function clearPlanUndoTimer() {
  window.clearTimeout(planUndoTimer);
  planUndoTimer = 0;
}

function clearPlanUndoState() {
  clearPlanUndoTimer();
  planUndoSnapshot = null;
  stopPlanUndoFill();
  modalAddPlan?.classList.remove('is-undo');
}

function cloneUserForPlan(user) {
  return {
    ...user,
    trainingProgram: [...(user.trainingProgram || [])],
  };
}

function armPlanUndo(snapshot) {
  planUndoSnapshot = snapshot;
  modalAddPlan.disabled = false;
  modalAddPlan.classList.remove('is-busy', 'is-remove');
  modalAddPlan.classList.add('is-undo');
  modalAddPlan.dataset.mode = 'undo';
  setPlanBtnLabel(ui('undo'));
  startPlanUndoFill();
  setPrescriptionEditorVisible(false);

  clearPlanUndoTimer();
  planUndoTimer = window.setTimeout(() => {
    commitPendingRemove();
  }, 1000);
}

async function commitPendingRemove() {
  const snapshot = planUndoSnapshot;
  planUndoSnapshot = null;
  planUndoTimer = 0;

  // Close while still styled as undo (closeModal must not restyle first)
  closeModal({ skipPendingRemove: true });

  if (!snapshot) return;

  try {
    await applyUserUpdate(
      await removeTrainingProgramExercise(snapshot.exerciseId),
    );
  } catch (err) {
    console.error(err);
    setUser(snapshot.prevUser);
    if (getView() === 'training') refreshTrainingGrid();
  }
}

async function applyUserUpdate(updated, { highlightId } = {}) {
  setUser(updated);
  if (highlightId != null) pendingTrainingFlashId = String(highlightId);
  if (getView() === 'training') refreshTrainingGrid({ highlightId });
  return updated;
}

function flashTrainingCard(id) {
  if (id == null || id === '') return;
  const card = document.querySelector(
    `#training-grid .training-card[data-id="${CSS.escape(String(id))}"]`,
  );
  if (!card) return;
  card.classList.remove('is-updated');
  void card.offsetWidth;
  card.classList.add('is-updated');
}

async function saveProgramIds(exerciseIds) {
  return applyUserUpdate(await addToTrainingProgram(exerciseIds));
}

async function onPlanActionClick() {
  if (!modalAddPlan || modalAddPlan.disabled) return;

  const mode = modalAddPlan.dataset.mode;
  const exerciseId = String(modalOverlay.dataset.openId || '');

  if (isCoach()) {
    const assign = getSessionAssignTarget();
    if (!assign || !exerciseId) return;

    if (mode === 'session-remove') {
      removeExerciseFromSession(assign.athleteId, assign.sessionId, exerciseId);
      syncPlanAction(exerciseId);
      return;
    }
    if (mode === 'session-add') {
      const exercise = findCachedExercise(exerciseId);
      if (!exercise) return;
      addExerciseToSession(assign.athleteId, assign.sessionId, exercise);
      syncPlanAction(exerciseId);
      openPrescriptionForm();
      return;
    }
    return;
  }

  if (mode === 'login') {
    openAuth('login');
    return;
  }
  if (mode === 'remove') {
    removeFromPlan();
    return;
  }
  if (mode === 'undo') {
    undoRemoveFromPlan();
    return;
  }
  if (mode !== 'add') return;

  const user = getUser();
  if (!exerciseId || !user?.id) return;

  modalAddPlan.disabled = true;
  modalAddPlan.classList.add('is-busy');
  setPlanBtnLabel(ui('loading'));

  try {
    clearPlanUndoState();
    await saveProgramIds([exerciseId]);
    syncPlanAction(exerciseId);
  } catch (err) {
    console.error(err);
    modalAddPlan.disabled = false;
    modalAddPlan.classList.remove('is-busy');
    modalAddPlan.dataset.mode = 'add';
    setPlanBtnLabel(ui('addToPlanFail'));
    window.setTimeout(() => syncPlanAction(exerciseId), 1800);
  }
}

/** Optimistic remove: API runs only if undo window expires (or modal closes). */
function removeFromPlan() {
  const exerciseId = String(modalOverlay.dataset.openId || '');
  const user = getUser();
  if (!exerciseId || !user?.id) return;
  if (!getProgramExerciseIds(user).includes(exerciseId)) return;

  const prevUser = cloneUserForPlan(user);
  const optimistic = {
    ...user,
    trainingProgram: (user.trainingProgram || []).filter(
      item => String(item.exercise?.id || item.exerciseId) !== exerciseId,
    ),
  };

  setUser(optimistic);
  if (getView() === 'training') refreshTrainingGrid();
  armPlanUndo({ exerciseId, prevUser });
}

function undoRemoveFromPlan() {
  const snapshot = planUndoSnapshot;
  if (!snapshot) return;

  clearPlanUndoState();
  setUser(snapshot.prevUser);
  if (getView() === 'training') refreshTrainingGrid();
  syncPlanAction(snapshot.exerciseId);
}

function closeModal({ skipPendingRemove = false } = {}) {
  modalRequestId++;
  collapsePrescriptionForm({ instant: true });

  const pending = planUndoSnapshot;
  const wasOpen = modalOverlay.classList.contains('open');

  // Hide overlay first — clearing is-undo before this caused a blue flash
  modalOverlay.classList.remove('open');
  delete modalOverlay.dataset.openId;
  document.body.style.overflow = '';
  syncExerciseInUrl(null);
  resetShareFeedback();

  clearPlanUndoState();

  const flashId = pendingTrainingFlashId;
  pendingTrainingFlashId = null;
  if (flashId && getView() === 'training') {
    requestAnimationFrame(() => flashTrainingCard(flashId));
  }

  const finishClear = () => {
    modalGif.src = '';
  };

  if (wasOpen && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const onEnd = e => {
      if (e.target !== modalOverlay || e.propertyName !== 'opacity') return;
      modalOverlay.removeEventListener('transitionend', onEnd);
      window.clearTimeout(modalCloseClearTimer);
      finishClear();
    };
    modalOverlay.addEventListener('transitionend', onEnd);
    modalCloseClearTimer = window.setTimeout(() => {
      modalOverlay.removeEventListener('transitionend', onEnd);
      finishClear();
    }, 420);
  } else {
    finishClear();
  }

  // Closing during undo window confirms the removal
  if (pending && !skipPendingRemove) {
    removeTrainingProgramExercise(pending.exerciseId)
      .then(updated => {
        setUser(updated);
        if (getView() === 'training') refreshTrainingGrid();
      })
      .catch(err => {
        console.error(err);
        setUser(pending.prevUser);
        if (getView() === 'training') refreshTrainingGrid();
      });
  }
}

function syncShareButtonLabels() {
  if (!modalShare) return;
  modalShare.title = ui('copyLink');
  modalShare.setAttribute('aria-label', ui('copyLink'));
}

function resetShareFeedback() {
  modalShare?.classList.remove('is-copied');
  if (modalShareFeedback) {
    modalShareFeedback.hidden = true;
    modalShareFeedback.textContent = '';
  }
}

async function copyExerciseLink() {
  const id = modalOverlay.dataset.openId;
  if (!id || !modalShare) return;

  const link = exerciseShareUrl(id);
  try {
    await navigator.clipboard.writeText(link);
  } catch {
    const input = document.createElement('input');
    input.value = link;
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }

  modalShare.classList.add('is-copied');
  if (modalShareFeedback) {
    modalShareFeedback.hidden = false;
    modalShareFeedback.textContent = ui('linkCopied');
  }
  window.setTimeout(resetShareFeedback, 1400);
}

function renderModalMeta(exercise) {
  modalMeta.innerHTML = '';
  [
    [ui('bodyPart'), label(exercise.body_part || exercise.category)],
    [ui('equipment'), label(exercise.equipment)],
    [ui('targetMeta'), label(exercise.target)],
  ].forEach(([metaLabel, value]) => {
    if (!value) return;
    const chip = document.createElement('div');
    chip.className = 'meta-chip';
    chip.innerHTML = `<span class="meta-chip-label">${metaLabel}</span><span class="meta-chip-value">${value}</span>`;
    modalMeta.appendChild(chip);
  });
}

function renderModalMuscles(exercise) {
  modalMuscles.innerHTML = '';

  const primary = exercise.target ? [exercise.target] : [];
  const secondary = (exercise.secondary_muscles || []).filter(m => m !== exercise.target);

  if (!primary.length && !secondary.length) return;

  const header = document.createElement('div');
  header.className = 'modal-muscles-label';
  header.textContent = ui('muscles');
  modalMuscles.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'muscles-grid';

  const makeGroup = (title, names, isPrimary) => {
    const group = document.createElement('div');
    group.className = 'muscles-group';
    group.innerHTML = `<div class="muscles-group-label"></div><div class="muscle-tags"></div>`;
    group.querySelector('.muscles-group-label').textContent = title;
    const row = group.querySelector('.muscle-tags');
    names.forEach(name => {
      const tag = document.createElement('span');
      tag.className = isPrimary ? 'muscle-tag primary' : 'muscle-tag';
      tag.textContent = label(name);
      row.appendChild(tag);
    });
    return group;
  };

  if (primary.length) grid.appendChild(makeGroup(ui('primary'), primary, true));
  if (secondary.length) grid.appendChild(makeGroup(ui('secondary'), secondary, false));
  modalMuscles.appendChild(grid);
}

function renderModalInstructions(exercise) {
  modalInstr.innerHTML = '';

  const langs = [state.lang, state.lang === 'en' ? 'es' : 'en']
    .map(code => ({ code, steps: exercise.instruction_steps?.[code] ?? [] }))
    .filter(l => l.steps.length > 0);

  if (!langs.length) return;

  const instrLabel = document.createElement('span');
  instrLabel.className = 'modal-instructions-label';
  instrLabel.textContent = ui('instructions');
  modalInstr.appendChild(instrLabel);

  const list = document.createElement('ol');
  list.className = 'instructions-list';

  const renderSteps = (steps) => {
    list.innerHTML = '';
    steps.forEach((step, i) => {
      const li = document.createElement('li');
      li.className = 'instruction-step';
      li.innerHTML = `<span class="step-num">${i + 1}</span><span class="step-text"></span>`;
      li.querySelector('.step-text').textContent = step;
      list.appendChild(li);
    });
  };

  if (langs.length > 1) {
    const tabs = document.createElement('div');
    tabs.className = 'lang-tabs';
    const buttons = langs.map((l, i) => {
      const btn = document.createElement('button');
      btn.className = 'lang-tab' + (i === 0 ? ' active' : '');
      btn.textContent = LANG_NAMES[l.code] ?? l.code;
      btn.addEventListener('click', () => {
        buttons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderSteps(l.steps);
      });
      tabs.appendChild(btn);
      return btn;
    });
    modalInstr.appendChild(tabs);
  }

  renderSteps(langs[0].steps);
  modalInstr.appendChild(list);
}

// ── Events ─────────────────────────────────────────
let searchRequestId = 0;

function wireEvents() {
  searchEl.addEventListener('input', debounce(async () => {
    state.search = searchEl.value;
    searchClearEl.classList.toggle('visible', state.search.length > 0);

    const q = state.search.trim();

    // Training view: filter in-memory program only (no catalog API)
    if (getView() === 'training') {
      searchRequestId++;
      listRequestId++;
      refreshTrainingGrid();
      return;
    }

    if (isEasterEggQuery(q)) {
      searchRequestId++;
      listRequestId++;
      state.filtered = [];
      const egg = getEasterEgg(q);
      renderEasterEgg(gridEl, egg);
      countEl.textContent = egg?.kicker ?? q;
      spinnerEl.classList.remove('visible');
      return;
    }

    // Numeric query → fetch by id (e.g. "0001")
    if (isIdSearch(q)) {
      const requestId = ++searchRequestId;
      listRequestId++;
      try {
        const exercise = await getExercise(q);
        if (requestId !== searchRequestId) return;
        upsertExercise(exercise);
        state.filtered = [exercise];
        renderGrid();
        updateResultsBar();
        updateActiveBadges();
        spinnerEl.classList.remove('visible');
        return;
      } catch {
        if (requestId !== searchRequestId) return;
        state.filtered = [];
        renderGrid();
        updateResultsBar();
        return;
      }
    }

    searchRequestId++;
    await reloadExercises();
  }, 500));

  searchClearEl.addEventListener('click', () => {
    searchRequestId++;
    searchEl.value = '';
    state.search = '';
    searchClearEl.classList.remove('visible');
    reloadExercises();
  });

  document.querySelector('.sidebar-body').addEventListener('click', e => {
    const chip = e.target.closest('.chip[data-filter]');
    if (!chip) return;
    const { filter, value } = chip.dataset;
    const set = state.filters[filter];

    // One active value per filter group (matches API query params)
    if (set.has(value)) set.clear();
    else {
      set.clear();
      set.add(value);
    }

    document.querySelectorAll(`.chip[data-filter="${filter}"]`).forEach(c => {
      const on = set.has(c.dataset.value);
      c.classList.toggle('active', on);
      c.classList.remove('chip-pop');
      if (on && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        void c.offsetWidth;
        c.classList.add('chip-pop');
      }
    });
    syncFilterSectionHints();

    searchRequestId++;
    searchEl.value = '';
    state.search = '';
    searchClearEl.classList.remove('visible');

    reloadExercises();
  });

  activeFilEl.addEventListener('click', e => {
    const btn = e.target.closest('.active-badge-remove');
    if (!btn) return;
    const { filter, value } = btn.dataset;
    state.filters[filter].delete(value);
    document.querySelector(`.chip[data-filter="${filter}"][data-value="${value}"]`)
      ?.classList.remove('active');
    reloadExercises();
  });

  wireCardGrid(gridEl, { cardSelector: '.exercise-card', onOpen: openModal });
  wireCardGrid(document.getElementById('training-grid'), {
    cardSelector: '.training-card',
    onOpen: openModal,
  });
  wireCardGrid(document.getElementById('coach-plan-grid'), {
    cardSelector: '.training-card, .coach-plan-workout-item',
    onOpen: openModal,
  });
  wireCardGrid(document.getElementById('recommend-grid'), {
    cardSelector: '.recommend-card',
    onOpen: openModal,
  });

  modalClose.addEventListener('click', closeModal);
  modalShare?.addEventListener('click', e => {
    e.stopPropagation();
    copyExerciseLink();
  });
  modalAddPlan?.addEventListener('click', onPlanActionClick);
  modalRxBtn?.addEventListener('click', togglePrescriptionForm);
  modalRxForm?.addEventListener('submit', onPrescriptionSubmit);
  modalRxReps?.addEventListener('input', () => {
    const next = cleanReps(modalRxReps.value);
    if (modalRxReps.value !== next) modalRxReps.value = next;
  });
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  langToggle?.addEventListener('click', e => {
    const btn = e.target.closest('.lang-toggle-btn');
    if (!btn || btn.dataset.lang === state.lang) return;
    state.lang = btn.dataset.lang === 'en' ? 'en' : 'es';
    setStoredLang(state.lang);
    applyLanguage();
  });

  wodBtn?.addEventListener('click', async () => {
    if (wodBtn.disabled) return;
    wodBtn.disabled = true;
    try {
      const exercise = await getRandomExercise();
      upsertExercise(exercise);
      state.wod = exercise;
      openModal(exercise.id);
    } catch (err) {
      console.error(err);
    } finally {
      wodBtn.disabled = false;
    }
  });

  document.getElementById('my-plan-btn')?.addEventListener('click', () => {
    if (!isLoggedIn()) openAuth('login');
  });

  new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && hasMorePages() && !state.loading) {
      loadNextPage();
    }
  }, { rootMargin: '200px' }).observe(sentinelEl);
}

init().catch(err => {
  console.error(err);
  countEl.textContent = ui('loadFail');
});
