/**
 * App entry: catálogo, filtros, grid, modal de ejercicio, WOD, idioma.
 * Markup: index.html (#exercise-grid, #modal-overlay, …).
 * Features: auth-ui.js, footer.js, easter-egg.js.
 */
import { isLoggedIn } from './api/token.js';
import { getEasterEgg, isEasterEggQuery, renderEasterEgg } from './features/easter-egg.js';
import { initFooter } from './features/footer.js';
import { initAuthUi, openAuth, syncAuthLabels } from './features/auth-ui.js';
import {
  initSessionUi,
  restoreSession,
  setView,
  syncSessionLabels,
  getUser,
  getView,
} from './features/session-ui.js';
import { renderTrainingProgram } from './features/training-ui.js';
import { getExercises, getExercise, getLabels, getRandomExercise } from './api/exercises.js';
import { EQUIP_INITIAL } from './constants.js';
import { debounce } from './utils/helpers.js';
import { assetUrl } from './utils/assets.js';
import { fillCardMedia, wireCardGrid } from './utils/cards.js';
import { setLang, ui, label, exerciseName } from './utils/labels.js';

const FILTER_KEYS = ['category', 'equipment', 'target'];
const LANG_NAMES = { en: 'English', es: 'Español' };
const PAGE_SIZE = 12;

// ── State ──────────────────────────────────────────
const state = {
  exercises: [],
  filtered: [],
  labels: { category: [], equipment: [], target: [] },
  wod: null,
  search: '',
  lang: 'es',
  filters: {
    category: new Set(),
    equipment: new Set(),
    target: new Set(),
  },
  page: 0,
  pages: 0,
  total: 0,
  loading: false,
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
const modalTitle = document.getElementById('modal-title');
const modalGif = document.getElementById('modal-gif');
const modalMeta = document.getElementById('modal-meta');
const modalMuscles = document.getElementById('modal-muscles');
const modalInstr = document.getElementById('modal-instructions');
const modalClose = document.getElementById('modal-close');
const langToggle = document.getElementById('lang-toggle');
const wodBtn = document.getElementById('wod-btn');

// ── Boot ───────────────────────────────────────────
async function init() {
  countEl.textContent = ui('loading');

  const labels = await getLabels();
  state.labels = {
    category: labels.category,
    equipment: labels.equipment,
    target: labels.target,
  };

  initSessionUi({
    onViewChange(view) {
      if (view === 'training') refreshTrainingGrid();
      else if (view === 'catalog') reloadExercises();
    },
  });
  initAuthUi({
    onAuthSuccess: async () => {
      await restoreSession();
      setView('training');
    },
  });

  applyLanguage();
  await restoreSession();
  await reloadExercises();
  wireEvents();
  initFooter();
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
  gridEl.innerHTML = '';
  updateActiveBadges();
  await loadNextPage();
}

function refreshTrainingGrid() {
  renderTrainingProgram(getUser(), activeFilters());
  updateActiveBadges();
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

function applyLanguage() {
  setLang(state.lang);

  document.querySelectorAll('[data-ui]').forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });
  searchEl.placeholder = ui('search');

  buildFilterOptions();
  syncActiveChips();
  syncGrid();

  syncAuthLabels();
  syncSessionLabels();
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
}

function renderChips(containerId, values, filterKey, initialLimit = null) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  const toShow = initialLimit ? values.slice(0, initialLimit) : values;
  const rest = initialLimit ? values.slice(initialLimit) : [];

  toShow.forEach(val => container.appendChild(makeChip(val, filterKey)));
  if (rest.length === 0) return;

  const hiddenWrap = document.createElement('div');
  hiddenWrap.className = 'chip-overflow';
  rest.forEach(val => hiddenWrap.appendChild(makeChip(val, filterKey)));
  container.appendChild(hiddenWrap);

  // Keep overflow open if a selected filter is hidden
  if (rest.some(val => state.filters[filterKey]?.has(val))) {
    hiddenWrap.classList.add('open');
    return;
  }

  const moreBtn = document.createElement('button');
  moreBtn.className = 'chip filter-show-more';
  moreBtn.textContent = ui('more', rest.length);
  moreBtn.addEventListener('click', () => {
    hiddenWrap.classList.add('open');
    moreBtn.remove();
  });
  container.appendChild(moreBtn);
}

function makeChip(value, filterKey) {
  const btn = document.createElement('button');
  btn.className = 'chip';
  btn.textContent = label(value);
  btn.dataset.filter = filterKey;
  btn.dataset.value = value; // English key for filtering
  return btn;
}

function dedupeById(list) {
  const seen = new Set();
  return list.filter(exercise => {
    const id = String(exercise.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
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
  exercises.forEach(exercise => frag.appendChild(createCard(exercise)));
  gridEl.appendChild(frag);
}

function renderGrid() {
  gridEl.innerHTML = '';

  if (state.filtered.length === 0) {
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

  if (!hasAny) return;

  const clearAll = document.createElement('button');
  clearAll.className = 'clear-all';
  clearAll.textContent = ui('clearAll');
  clearAll.addEventListener('click', clearAllFilters);
  activeFilEl.appendChild(clearAll);
}

// ── Modal ──────────────────────────────────────────
let modalRequestId = 0;

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

  modalOverlay.classList.add('open');
  modalOverlay.dataset.openId = id;
  document.body.style.overflow = 'hidden';
  modalClose.focus();

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
  renderModalMuscles(exercise);
  renderModalInstructions(exercise);
}

function closeModal() {
  modalRequestId++;
  modalOverlay.classList.remove('open');
  delete modalOverlay.dataset.openId;
  document.body.style.overflow = '';
  modalGif.src = '';
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
      c.classList.toggle('active', set.has(c.dataset.value));
    });

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

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', e => {
    if (e.target === modalOverlay) closeModal();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeModal();
  });

  langToggle?.addEventListener('click', e => {
    const btn = e.target.closest('.lang-toggle-btn');
    if (!btn || btn.dataset.lang === state.lang) return;
    state.lang = btn.dataset.lang;
    document.querySelectorAll('.lang-toggle-btn').forEach(b => {
      const active = b.dataset.lang === state.lang;
      b.classList.toggle('active', active);
      b.setAttribute('aria-pressed', String(active));
    });
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
