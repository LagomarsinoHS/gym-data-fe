/**
 * Mi entrenamiento grid — paints user.trainingProgram from GET /users/me.
 * Markup: #training-grid in index.html
 * Filters/search run in memory (no catalog API).
 * Cards are training-specific (not catalog exercise-card).
 */
import { assetUrl } from '../utils/assets.js';
import { fillCardMedia } from '../utils/cards.js';
import { normalizeSearch, sortByOrder } from '../utils/helpers.js';
import { exerciseName, label, ui } from '../utils/labels.js';
import { prescriptionLines, prescriptionNote } from '../utils/prescription.js';
import { setView } from './session-ui.js';

export { prescriptionLines, prescriptionNote };

/** Which coach-plan session accordion is open (athlete view). */
let openCoachPlanSessionId = null;

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
 * Plan del coach — paints user.coachTrainingProgram as sessions.
 * Markup: #coach-plan-grid
 */
export function renderCoachTrainingProgram(user) {
  const root = document.getElementById('coach-plan-grid');
  if (!root) return;

  root.replaceChildren();
  root.classList.remove('training-grid');
  root.classList.add('coach-plan-sessions');

  const prog = Array.isArray(user?.coachTrainingProgram) ? user.coachTrainingProgram : [];
  if (!prog.length) {
    root.appendChild(createTrainingEmptyState(true, {
      emptyKey: 'coachPlanProgramEmpty',
      showCatalogCta: false,
    }));
    return;
  }

  const sessions = sortByOrder(prog);
  const frag = document.createDocumentFragment();
  sessions.forEach((session, index) => {
    frag.appendChild(createCoachPlanSession(session, { index }));
  });
  root.appendChild(frag);
}

function createCoachPlanSession(session, { index = 0 } = {}) {
  const id = String(session?.id || '');
  const name = String(session?.name || '').trim() || '—';
  const items = sortByOrder([...(session?.items || [])].filter(item => item?.exercise));
  const sets = totalCoachSessionSets(items);
  const sessionNumber = (session?.order ?? index) + 1;

  const section = document.createElement('section');
  section.className = 'coach-plan-session';
  if (id) section.dataset.sessionId = id;

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'coach-plan-session-header';
  header.setAttribute('aria-expanded', 'false');

  const indexEl = document.createElement('span');
  indexEl.className = 'coach-plan-session-index';
  indexEl.textContent = String(sessionNumber).padStart(2, '0');
  indexEl.setAttribute('aria-label', ui('sessionIndex', sessionNumber));

  const title = document.createElement('span');
  title.className = 'coach-plan-session-title';
  title.textContent = name;

  const meta = document.createElement('span');
  meta.className = 'coach-plan-session-meta';
  meta.append(
    createCoachPlanMetaChip(items.length, ui('sessionExercisesUnit', items.length)),
  );
  if (items.length) {
    meta.append(
      createCoachPlanMetaChip(sets, ui('sessionSetsUnit', sets), true),
    );
  }

  const chevron = document.createElement('span');
  chevron.className = 'coach-plan-session-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  header.append(indexEl, title, meta, chevron);

  const body = document.createElement('div');
  body.className = 'coach-plan-session-body';

  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'coach-plan-session-empty';
    empty.textContent = ui('sessionEmptyItems');
    body.append(empty);
  } else {
    const list = document.createElement('div');
    list.className = 'coach-plan-workout-list';
    items.forEach((item, itemIndex) => {
      list.appendChild(createCoachPlanWorkoutItem(item, itemIndex));
    });
    body.append(list);
  }

  header.addEventListener('click', () => toggleCoachPlanSession(section));
  section.append(header, body);

  if (openCoachPlanSessionId && openCoachPlanSessionId === id) {
    openCoachPlanSession(section);
  }

  return section;
}

function createCoachPlanMetaChip(value, unit, emphasize = false) {
  const chip = document.createElement('span');
  chip.className = emphasize
    ? 'coach-plan-meta-chip coach-plan-meta-chip--sets'
    : 'coach-plan-meta-chip';

  const num = document.createElement('strong');
  num.textContent = String(value);
  const labelEl = document.createElement('span');
  labelEl.textContent = unit;
  chip.append(num, labelEl);
  return chip;
}

function createCoachPlanWorkoutItem(item, index = 0) {
  const ex = item.exercise;
  const id = String(ex?.id || item.exerciseId || '');
  const name = exerciseName(ex) || id || '—';
  const lines = prescriptionLines(item);
  const note = prescriptionNote(item);

  const row = document.createElement('article');
  row.className = 'coach-plan-workout-item';
  row.style.setProperty('--item-i', String(index));
  if (id) row.dataset.id = id;

  const media = document.createElement('div');
  media.className = 'coach-plan-workout-media';
  const imageSrc = assetUrl(ex?.image || ex?.gif_url);
  if (imageSrc) {
    const thumb = document.createElement('img');
    thumb.className = 'coach-plan-workout-thumb';
    thumb.alt = name;
    thumb.loading = 'lazy';
    thumb.src = imageSrc;
    thumb.addEventListener('error', () => {
      thumb.remove();
      media.classList.add('is-fallback');
      media.textContent = name.slice(0, 1).toUpperCase() || '?';
    }, { once: true });
    media.append(thumb);
  } else {
    media.classList.add('is-fallback');
    media.textContent = name.slice(0, 1).toUpperCase() || '?';
  }

  const main = document.createElement('div');
  main.className = 'coach-plan-workout-main';

  const nameEl = document.createElement('h4');
  nameEl.className = 'coach-plan-workout-name';
  nameEl.textContent = name;

  const rx = document.createElement('div');
  rx.className = 'coach-plan-workout-rx';
  if (lines.length) {
    for (const line of lines) {
      const chip = document.createElement('span');
      chip.className = 'coach-plan-workout-chip';
      chip.textContent = `${line.ico} ${line.text}`;
      rx.append(chip);
    }
  } else {
    const bare = document.createElement('span');
    bare.className = 'coach-plan-workout-bare';
    bare.textContent = ui('programBare');
    rx.append(bare);
  }

  main.append(nameEl, rx);
  if (note) {
    const noteEl = document.createElement('p');
    noteEl.className = 'coach-plan-workout-note';
    noteEl.textContent = note;
    noteEl.title = note;
    main.append(noteEl);
  }

  row.append(media, main);
  return row;
}

function toggleCoachPlanSession(section) {
  const opening = !section.classList.contains('is-open');
  const root = section.closest('.coach-plan-sessions');
  root?.querySelectorAll('.coach-plan-session.is-open').forEach(other => {
    if (other !== section) closeCoachPlanSession(other);
  });
  if (opening) openCoachPlanSession(section);
  else closeCoachPlanSession(section);
}

function openCoachPlanSession(section) {
  const header = section.querySelector('.coach-plan-session-header');
  section.classList.add('is-open');
  if (header) header.setAttribute('aria-expanded', 'true');
  openCoachPlanSessionId = section.dataset.sessionId || null;
}

function closeCoachPlanSession(section) {
  const header = section.querySelector('.coach-plan-session-header');
  section.classList.remove('is-open');
  if (header) header.setAttribute('aria-expanded', 'false');
  if (openCoachPlanSessionId && section.dataset.sessionId === openCoachPlanSessionId) {
    openCoachPlanSessionId = null;
  }
}

function totalCoachSessionSets(items) {
  return (items || []).reduce((sum, item) => {
    const n = Number(item?.sets);
    return sum + (Number.isFinite(n) && n > 0 ? Math.floor(n) : 0);
  }, 0);
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
  const program = sortByOrder(
    assigned.filter(item => matchesTrainingFilters(item, filters)),
  );

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
