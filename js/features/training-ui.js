/**
 * Mi entrenamiento grid — paints user.trainingProgram from GET /users/me.
 * Markup: #training-grid in index.html
 * Filters/search run in memory (no catalog API).
 * Cards are training-specific (not catalog exercise-card).
 */
import { fillCardMedia } from '../utils/cards.js';
import { normalizeSearch } from '../utils/helpers.js';
import { exerciseName, label, ui } from '../utils/labels.js';

/**
 * @param {object|null} user
 * @param {{ category?: string, equipment?: string, target?: string, search?: string }} [filters]
 */
export function renderTrainingProgram(user, filters = {}) {
  const grid = document.getElementById('training-grid');
  if (!grid) return;

  grid.innerHTML = '';

  const program = [...(user?.trainingProgram || [])]
    .filter(item => item?.exercise)
    .filter(item => matchesTrainingFilters(item, filters))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (!program.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `<p>📋</p><p>${ui('trainingEmpty')}</p>`;
    grid.appendChild(empty);
    return;
  }

  const frag = document.createDocumentFragment();
  program.forEach(item => frag.appendChild(createProgramCard(item)));
  grid.appendChild(frag);
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
      <ul class="training-rx" hidden></ul>
      <p class="training-rx-empty" hidden></p>
      <p class="training-card-note" hidden></p>
    </div>`;

  fillCardMedia(article, ex, { nameSelector: '.training-card-name' });

  if (lines.length) {
    const rx = article.querySelector('.training-rx');
    rx.hidden = false;
    lines.forEach(text => {
      const li = document.createElement('li');
      li.textContent = text;
      rx.appendChild(li);
    });
  } else {
    const empty = article.querySelector('.training-rx-empty');
    empty.hidden = false;
    empty.textContent = ui('programBare');
  }

  if (note) {
    const noteEl = article.querySelector('.training-card-note');
    noteEl.hidden = false;
    noteEl.textContent = note;
  }

  return article;
}

function prescriptionLines(item) {
  const lines = [];
  if (item.sets != null) lines.push(ui('programSets', item.sets));
  if (item.reps) lines.push(ui('programReps', item.reps));
  if (item.rest != null) lines.push(ui('programRest', item.rest));
  return lines;
}
