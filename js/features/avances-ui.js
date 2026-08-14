/**
 * Coach — Avances: pick an athlete, then open progress-photos.
 * Markup: #avances-view
 *
 * Note: openProgressPhotos is injected in init to avoid a circular import
 * (avances → progress-photos → session → avances).
 */
import { ui } from '../utils/labels.js';
import { athleteDisplayName } from './coach-athletes-store.js';
import { createCoachAthletePicker } from './coach-athlete-picker.js';

const PAGE_SIZE = 10;

let listEl;
let loadingEl;
let emptyEl;
let loadMoreBtn;
/** @type {(athleteId: string, opts?: object) => void} */
let openProgressPhotos = () => {};

const picker = createCoachAthletePicker({
  pageSize: PAGE_SIZE,
  getElements: () => ({
    listEl: listEl || document.getElementById('avances-list'),
    loadingEl: loadingEl || document.getElementById('avances-loading'),
    emptyEl: emptyEl || document.getElementById('avances-empty'),
    loadMoreBtn: loadMoreBtn || document.getElementById('avances-load-more'),
  }),
  renderRow: createAthleteRow,
  emptyKeys: {
    loadFail: 'avancesLoadFail',
    empty: { title: 'avancesEmptyTitle', lead: 'avancesEmptyLead' },
  },
});

export function initAvancesUi(opts = {}) {
  if (typeof opts.openProgressPhotos === 'function') {
    openProgressPhotos = opts.openProgressPhotos;
  }

  listEl = document.getElementById('avances-list');
  loadingEl = document.getElementById('avances-loading');
  emptyEl = document.getElementById('avances-empty');
  loadMoreBtn = document.getElementById('avances-load-more');
  loadMoreBtn?.addEventListener('click', () => void picker.loadMore());
}

export function resetAvancesUi() {
  picker.reset();
}

export function syncAvancesLabels() {
  document.querySelectorAll('#avances-view [data-ui]').forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });
  picker.syncLabels();
}

export async function syncAvancesView() {
  const viewEl = document.getElementById('avances-view');
  if (!viewEl || viewEl.hidden) return;

  syncAvancesLabels();
  await picker.ensureLoaded();
}

function createAthleteRow(athlete) {
  const id = String(athlete?.id || '');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'avances-athlete-btn';
  btn.addEventListener('click', () => {
    if (!id) return;
    openProgressPhotos(id, { returnTo: 'avances', athlete });
  });

  const name = document.createElement('span');
  name.className = 'avances-athlete-name';
  name.textContent = athleteDisplayName(athlete);

  const email = document.createElement('span');
  email.className = 'avances-athlete-email';
  email.textContent = String(athlete?.email || '').trim() || '—';

  const chevron = document.createElement('span');
  chevron.className = 'avances-athlete-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';

  btn.append(name, email, chevron);
  return btn;
}
