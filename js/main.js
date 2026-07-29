import { getExercises, getExercise, getLabels, getRandomExercise } from './api/exercises.js';
import { getEasterEgg, isEasterEggQuery, renderEasterEgg } from './features/easter-egg.js';
import { initFooter } from './features/footer.js';
import { EQUIP_INITIAL, VALUE_LABELS_ES } from './constants.js';
import { debounce } from './utils/helpers.js';
import { assetUrl } from './utils/assets.js';
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

  applyLanguage();
  await reloadExercises();
  wireEvents();
  initFooter();
}

function isIdSearch(q = state.search) {
  return /^\d+$/.test(String(q).trim());
}

function filterQueryParams() {
  const params = {};
  FILTER_KEYS.forEach(key => {
    if (state.filters[key].size) params[key] = [...state.filters[key]][0];
  });

  const q = state.search.trim();
  if (q && !isIdSearch(q) && !isEasterEggQuery(q)) {
    params.search = q;
  }
  return params;
}

function hasMorePages() {
  return state.page < state.pages;
}

let listRequestId = 0;

async function reloadExercises() {
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

async function loadNextPage() {
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

function buildSearchIndex(ex) {
  const terms = [
    ex.id,
    exerciseName(ex, 'en'),
    exerciseName(ex, 'es'),
    ex.category, VALUE_LABELS_ES[ex.category],
    ex.body_part, VALUE_LABELS_ES[ex.body_part],
    ex.target, VALUE_LABELS_ES[ex.target],
    ex.equipment, VALUE_LABELS_ES[ex.equipment],
    ex.muscle_group, VALUE_LABELS_ES[ex.muscle_group],
  ];
  ex.secondary_muscles.forEach(m => {
    terms.push(m, VALUE_LABELS_ES[m]);
  });
  ex._idx = terms.filter(Boolean).join(' ').toLowerCase();
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

function upsertExercise(ex) {
  buildSearchIndex(ex);
  const i = state.exercises.findIndex(e => String(e.id) === String(ex.id));
  if (i >= 0) state.exercises[i] = ex;
  else state.exercises.push(ex);
}

function dedupeById(list) {
  const seen = new Set();
  return list.filter(ex => {
    const id = String(ex.id);
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
  exercises.forEach(ex => frag.appendChild(createCard(ex)));
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

function createCard(ex) {
  const article = document.createElement('article');
  article.className = 'exercise-card';
  article.dataset.id = ex.id;
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

  const thumb = article.querySelector('.card-thumb');
  const name = exerciseName(ex);
  thumb.src = assetUrl(ex.image);
  thumb.alt = name;
  article.querySelector('.card-gif').dataset.src = assetUrl(ex.gif_url);
  article.querySelector('.card-name').textContent = name;
  article.querySelector('.tag-cat').textContent = label(ex.category);
  article.querySelector('.tag-equip').textContent = label(ex.equipment);
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

async function openModal(id) {
  const requestId = ++modalRequestId;

  modalOverlay.classList.add('open');
  modalOverlay.dataset.openId = id;
  document.body.style.overflow = 'hidden';
  modalClose.focus();

  const cached = state.exercises.find(e => String(e.id) === String(id))
    || (state.wod && String(state.wod.id) === String(id) ? state.wod : null);
  if (cached) fillModal(cached);

  try {
    const ex = await getExercise(id);
    if (requestId !== modalRequestId) return;
    fillModal(ex);
  } catch (err) {
    console.error(err);
    if (requestId !== modalRequestId) return;
    if (!cached) closeModal();
  }
}

function fillModal(ex) {
  const name = exerciseName(ex);
  modalTitle.textContent = name;
  modalGif.src = assetUrl(ex.gif_url);
  modalGif.alt = name;

  renderModalMeta(ex);
  renderModalMuscles(ex);
  renderModalInstructions(ex);
}

function closeModal() {
  modalRequestId++;
  modalOverlay.classList.remove('open');
  delete modalOverlay.dataset.openId;
  document.body.style.overflow = '';
  modalGif.src = '';
}

function renderModalMeta(ex) {
  modalMeta.innerHTML = '';
  [
    [ui('bodyPart'), label(ex.body_part)],
    [ui('equipment'), label(ex.equipment)],
    [ui('targetMeta'), label(ex.target)],
  ].forEach(([metaLabel, value]) => {
    const chip = document.createElement('div');
    chip.className = 'meta-chip';
    chip.innerHTML = `<span class="meta-chip-label">${metaLabel}</span><span class="meta-chip-value">${value}</span>`;
    modalMeta.appendChild(chip);
  });
}

function renderModalMuscles(ex) {
  modalMuscles.innerHTML = '';

  const primary = ex.target ? [ex.target] : [];
  const secondary = ex.secondary_muscles.filter(m => m !== ex.target);

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

function renderModalInstructions(ex) {
  modalInstr.innerHTML = '';

  const langs = [state.lang, state.lang === 'en' ? 'es' : 'en']
    .map(code => ({ code, steps: ex.instruction_steps[code] ?? [] }))
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
        const ex = await getExercise(q);
        if (requestId !== searchRequestId) return;
        upsertExercise(ex);
        state.filtered = [ex];
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

  gridEl.addEventListener('mouseover', e => {
    const card = e.target.closest('.exercise-card');
    if (!card) return;
    const gif = card.querySelector('.card-gif');
    if (gif?.dataset.src && !gif.src) gif.src = gif.dataset.src;
  });

  gridEl.addEventListener('click', e => {
    const card = e.target.closest('.exercise-card');
    if (card) openModal(card.dataset.id);
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
      const ex = await getRandomExercise();
      upsertExercise(ex);
      state.wod = ex;
      openModal(ex.id);
    } catch (err) {
      console.error(err);
    } finally {
      wodBtn.disabled = false;
    }
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
