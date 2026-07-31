/**
 * Mi entrenamiento grid — paints user.trainingProgram from GET /users/me.
 * Markup: #training-grid in index.html
 * Filters/search run in memory (no catalog API).
 * Cards are training-specific (not catalog exercise-card).
 */
import { fillCardMedia } from '../utils/cards.js';
import { normalizeSearch } from '../utils/helpers.js';
import { exerciseName, label, ui } from '../utils/labels.js';
import { setView } from './session-ui.js';

/**
 * @param {object|null} user
 * @param {{ category?: string, equipment?: string, target?: string, search?: string, highlightId?: string }} [filters]
 */
export function renderTrainingProgram(user, filters = {}) {
  renderProgramIntoGrid({
    gridId: 'training-grid',
    items: user?.trainingProgram,
    filters,
    emptyKey: 'trainingEmpty',
    showCatalogCta: true,
  });
}

/**
 * Plan del coach — paints user.coachTrainingProgram (same item shape as trainingProgram for now).
 * Markup: #coach-plan-grid
 */
export function renderCoachTrainingProgram(user, filters = {}) {
  renderProgramIntoGrid({
    gridId: 'coach-plan-grid',
    items: user?.coachTrainingProgram,
    filters,
    emptyKey: 'coachPlanProgramEmpty',
    showCatalogCta: false,
  });
}

function renderProgramIntoGrid({
  gridId,
  items,
  filters = {},
  emptyKey,
  showCatalogCta,
}) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  grid.innerHTML = '';

  const assigned = (items || []).filter(item => item?.exercise);
  const program = assigned
    .filter(item => matchesTrainingFilters(item, filters))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (!program.length) {
    grid.appendChild(createTrainingEmptyState(!assigned.length, { emptyKey, showCatalogCta }));
    return;
  }

  const highlightId = filters.highlightId != null ? String(filters.highlightId) : '';
  const frag = document.createDocumentFragment();
  program.forEach(item => {
    const card = createProgramCard(item);
    if (highlightId && card.dataset.id === highlightId) {
      card.classList.add('is-updated');
    }
    frag.appendChild(card);
  });
  grid.appendChild(frag);
}

/** @param {boolean} planEmpty true = no exercises in plan; false = filters/search hid all */
function createTrainingEmptyState(planEmpty, { emptyKey = 'trainingEmpty', showCatalogCta = true } = {}) {
  const empty = document.createElement('div');
  empty.className = 'empty-state';

  if (!planEmpty) {
    empty.innerHTML = `<p>🔍</p><p>${ui('empty')}</p>`;
    return empty;
  }

  if (!showCatalogCta) {
    empty.innerHTML = `
      <p>📋</p>
      <p>${ui(emptyKey)}</p>
    `;
    return empty;
  }

  empty.innerHTML = `
    <p>📋</p>
    <p>${ui(emptyKey)}</p>
    <button type="button" class="empty-state-cta" id="training-go-catalog">${ui('goToCatalog')}</button>
  `;
  empty.querySelector('#training-go-catalog')?.addEventListener('click', () => setView('catalog'));
  return empty;
}

function matchesTrainingFilters(item, { category, equipment, target, search } = {}) {
  const ex = item.exercise;
  if (category && ex.category !== category) return false;
  if (equipment && ex.equipment !== equipment) return false;
  if (target && ex.target !== target) return false;

  const q = normalizeSearch(search);
  if (!q) return true;

  const haystack = normalizeSearch([
    exerciseName(ex, 'en'),
    exerciseName(ex, 'es'),
    ex.id,
    item.exerciseId,
    item.notes,
    label(ex.category),
    label(ex.equipment),
  ]
    .filter(Boolean)
    .join(' '));

  return haystack.includes(q);
}

function createProgramCard(item) {
  const ex = item.exercise;
  const id = String(ex.id || item.exerciseId || '');
  const lines = prescriptionLines(item);
  const note = String(item.notes || '').trim();

  const article = document.createElement('article');
  article.className = 'training-card';
  if (id) article.dataset.id = id;
  article.innerHTML = `
    <div class="training-card-media">
      <img class="card-thumb" loading="lazy" alt="" />
      <img class="card-gif" alt="" />
    </div>
    <div class="training-card-body">
      <h3 class="training-card-name"></h3>
      <div class="card-tags">
        <span class="tag tag-cat"></span>
        <span class="tag tag-equip"></span>
      </div>
      <div class="training-rx-slot">
        <ul class="training-rx" hidden></ul>
        <p class="training-rx-empty" hidden></p>
      </div>
      <p class="training-card-note is-empty"></p>
    </div>`;

  fillCardMedia(article, ex, { nameSelector: '.training-card-name' });

  if (lines.length) {
    const rx = article.querySelector('.training-rx');
    rx.hidden = false;
    lines.forEach(({ ico, text }) => {
      const li = document.createElement('li');
      const icoEl = document.createElement('span');
      icoEl.className = 'training-rx-ico';
      icoEl.setAttribute('aria-hidden', 'true');
      icoEl.textContent = ico;
      const textEl = document.createElement('span');
      textEl.textContent = text;
      li.append(icoEl, textEl);
      rx.appendChild(li);
    });
  } else {
    const empty = article.querySelector('.training-rx-empty');
    empty.hidden = false;
    empty.textContent = ui('programBare');
  }

  const noteEl = article.querySelector('.training-card-note');
  if (note) {
    noteEl.classList.remove('is-empty');
    noteEl.textContent = note;
    noteEl.title = note;
  } else {
    noteEl.classList.add('is-empty');
    noteEl.textContent = '\u00a0';
    noteEl.removeAttribute('title');
  }

  return article;
}

export function prescriptionLines(item) {
  const lines = [];
  if (item?.sets != null) lines.push({ ico: '🏋️', text: String(item.sets) });
  if (item?.reps) lines.push({ ico: '🔁', text: String(item.reps) });
  if (item?.rest != null) lines.push({ ico: '⏱️', text: `${item.rest}s` });
  return lines;
}
