/**
 * Coach — Avances: pick an athlete, then open progress-photos.
 * Markup: #avances-view
 */
import { getCoachAthletes } from '../api/users.js';
import { ui } from '../utils/labels.js';
import { athleteDisplayName } from './coach-athletes-store.js';
import { openProgressPhotos } from './progress-photos-ui.js';

const PAGE_SIZE = 10;

/** @type {any[]} */
let athletes = [];
let page = 0;
let pages = 0;
let loading = false;
let loadSeq = 0;
let loadError = null;

let listEl;
let loadingEl;
let emptyEl;
let loadMoreBtn;

export function initAvancesUi() {
  listEl = document.getElementById('avances-list');
  loadingEl = document.getElementById('avances-loading');
  emptyEl = document.getElementById('avances-empty');
  loadMoreBtn = document.getElementById('avances-load-more');

  loadMoreBtn?.addEventListener('click', () => void loadMore());
}

export function syncAvancesLabels() {
  document.querySelectorAll('#avances-view [data-ui]').forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });
}

export async function syncAvancesView() {
  const viewEl = document.getElementById('avances-view');
  if (!viewEl || viewEl.hidden) return;

  syncAvancesLabels();
  if (!athletes.length && !loading) {
    await reload();
  } else {
    render();
  }
}

async function reload() {
  athletes = [];
  page = 0;
  pages = 0;
  loadError = null;
  await fetchPage(1, { replace: true });
}

async function loadMore() {
  if (loading || page >= pages) return;
  await fetchPage(page + 1, { replace: false });
}

async function fetchPage(nextPage, { replace }) {
  const seq = ++loadSeq;
  loading = true;
  loadError = null;
  render();

  try {
    const payload = await getCoachAthletes({
      page: nextPage,
      limit: PAGE_SIZE,
    });
    if (seq !== loadSeq) return;

    const items = Array.isArray(payload?.data) ? payload.data : [];
    page = Number(payload?.page) || nextPage;
    pages = Number(payload?.pages) || 0;
    athletes = replace ? items : athletes.concat(items);
  } catch (err) {
    if (seq !== loadSeq) return;
    loadError = err;
    if (replace) athletes = [];
  } finally {
    if (seq === loadSeq) loading = false;
    render();
  }
}

function render() {
  if (!listEl || !loadingEl || !emptyEl) return;

  const bootLoading = loading && athletes.length === 0;
  loadingEl.hidden = !bootLoading;

  if (bootLoading) {
    emptyEl.hidden = true;
    listEl.hidden = true;
    if (loadMoreBtn) loadMoreBtn.hidden = true;
    return;
  }

  if (loadError && athletes.length === 0) {
    emptyEl.hidden = false;
    listEl.hidden = true;
    const title = emptyEl.querySelector('.avances-empty-title');
    const lead = emptyEl.querySelector('.avances-empty-lead');
    if (title) title.textContent = ui('avancesLoadFail');
    if (lead) lead.textContent = '';
    if (loadMoreBtn) loadMoreBtn.hidden = true;
    return;
  }

  if (athletes.length === 0) {
    emptyEl.hidden = false;
    listEl.hidden = true;
    const title = emptyEl.querySelector('.avances-empty-title');
    const lead = emptyEl.querySelector('.avances-empty-lead');
    if (title) title.textContent = ui('avancesEmptyTitle');
    if (lead) lead.textContent = ui('avancesEmptyLead');
    if (loadMoreBtn) loadMoreBtn.hidden = true;
    return;
  }

  emptyEl.hidden = true;
  listEl.hidden = false;
  listEl.replaceChildren(...athletes.map(createAthleteRow));

  if (loadMoreBtn) {
    const hasMore = pages > 0 ? page < pages : false;
    loadMoreBtn.hidden = !hasMore;
    loadMoreBtn.disabled = loading;
  }
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
