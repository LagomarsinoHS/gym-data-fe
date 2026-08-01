/**
 * Coach — Mis alumnos: list shell + invite modal (email exacto).
 * Markup: #students-view, #add-student-overlay
 * API: POST /users/coach/invites · GET /users/coach/athletes
 */
import { getCoachAthletes, inviteCoachAthlete } from '../api/users.js';
import { ui } from '../utils/labels.js';

const SUCCESS_CLOSE_MS = 1200;
const ATHLETE_PAGE_SIZE = 5;
const SEARCH_DEBOUNCE_MS = 500;

let overlay;
let form;
let emailInput;
let statusEl;
let submitBtn;
let submitLabel;
let submitFill;
let loadMoreBtn;
let searchInput;
let searchClearBtn;
let downloadWrap;
let downloadBtn;
let downloadMenu;
let downloadAllBtn;
let closeTimer = 0;
let searchTimer = 0;
let athletes = [];
let athletesLoaded = false;
let loadingAthletes = false;
let page = 0;
let pages = 0;
let total = 0;
let loadSeq = 0;
let openAthleteId = null;
let searchQuery = '';

export function initStudentsUi() {
  overlay = document.getElementById('add-student-overlay');
  form = document.getElementById('add-student-form');
  emailInput = document.getElementById('add-student-email');
  statusEl = document.getElementById('add-student-status');
  submitBtn = document.getElementById('add-student-submit');
  submitLabel = submitBtn?.querySelector('.recommend-submit-label');
  submitFill = document.getElementById('add-student-submit-fill');
  loadMoreBtn = document.getElementById('students-load-more');
  searchInput = document.getElementById('students-search');
  searchClearBtn = document.getElementById('students-search-clear');
  downloadWrap = document.getElementById('students-download');
  downloadBtn = document.getElementById('students-download-btn');
  downloadMenu = document.getElementById('students-download-menu');
  downloadAllBtn = document.getElementById('students-download-all');
  if (!overlay || !form) return;

  document.getElementById('students-add-btn')?.addEventListener('click', openAddStudentModal);
  document.getElementById('students-empty-add-btn')?.addEventListener('click', openAddStudentModal);
  document.getElementById('add-student-close')?.addEventListener('click', closeAddStudentModal);
  loadMoreBtn?.addEventListener('click', () => void loadMoreAthletes());
  searchInput?.addEventListener('input', onSearchInput);
  searchClearBtn?.addEventListener('click', clearStudentsSearch);
  downloadBtn?.addEventListener('click', e => {
    e.stopPropagation();
    toggleDownloadMenu();
  });
  downloadAllBtn?.addEventListener('click', onDownloadAll);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeAddStudentModal();
  });
  form.addEventListener('submit', onSubmit);

  document.addEventListener('click', e => {
    if (!downloadWrap?.classList.contains('is-open')) return;
    if (downloadWrap.contains(e.target)) return;
    closeDownloadMenu();
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && downloadWrap?.classList.contains('is-open')) {
      e.stopImmediatePropagation();
      closeDownloadMenu();
      return;
    }
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeAddStudentModal();
    }
  });

  syncStudentsLabels();
}

/**
 * Fetch linked athletes for the authenticated coach (page 1, limit 5).
 * Cached in memory until force refresh, logout, search change, or session restore.
 * @param {{ force?: boolean }} [opts]
 */
export async function loadCoachAthletes({ force = false } = {}) {
  if (force) resetStudentsSearch({ keepInput: false });

  const shouldFetch = force || !athletesLoaded || athletes.length === 0;

  if (!shouldFetch) {
    renderStudentsList();
    return athletes;
  }

  return fetchAthletesPage(1, { replace: true });
}

async function loadMoreAthletes() {
  if (loadingAthletes || !hasMoreAthletes()) return;
  return fetchAthletesPage(page + 1, { replace: false });
}

async function fetchAthletesPage(nextPage, { replace }) {
  if (loadingAthletes) return athletes;

  const seq = ++loadSeq;
  loadingAthletes = true;
  syncLoadMoreBtn();

  try {
    const payload = await getCoachAthletes({
      page: nextPage,
      limit: ATHLETE_PAGE_SIZE,
      search: searchQuery || undefined,
    });
    if (seq !== loadSeq) return athletes;

    const items = normalizeAthletes(payload);
    page = Number(payload?.page) || nextPage;
    pages = Number(payload?.pages) || 0;
    total = Number(payload?.total) || 0;
    athletes = replace ? items : athletes.concat(items);
    athletesLoaded = true;
  } catch (err) {
    console.error(err);
    if (seq === loadSeq && replace) {
      athletes = [];
      athletesLoaded = false;
      page = 0;
      pages = 0;
      total = 0;
    }
  } finally {
    if (seq === loadSeq) loadingAthletes = false;
    renderStudentsList();
  }

  return athletes;
}

function normalizeAthletes(payload) {
  return Array.isArray(payload?.data) ? payload.data : [];
}

function hasMoreAthletes() {
  return page > 0 && page < pages;
}

function onSearchInput() {
  syncSearchClear();
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    const next = searchInput?.value.trim() ?? '';
    if (next === searchQuery) return;
    searchQuery = next;
    openAthleteId = null;
    athletesLoaded = false;
    void fetchAthletesPage(1, { replace: true });
  }, SEARCH_DEBOUNCE_MS);
}

function clearStudentsSearch() {
  if (!searchInput) return;
  searchInput.value = '';
  syncSearchClear();
  if (!searchQuery) return;
  searchQuery = '';
  openAthleteId = null;
  athletesLoaded = false;
  void fetchAthletesPage(1, { replace: true });
}

function resetStudentsSearch({ keepInput = false } = {}) {
  window.clearTimeout(searchTimer);
  searchTimer = 0;
  searchQuery = '';
  if (!keepInput && searchInput) searchInput.value = '';
  syncSearchClear();
}

function syncSearchClear() {
  searchClearBtn?.classList.toggle('visible', Boolean(searchInput?.value));
}

export function clearCoachAthletesCache() {
  loadSeq += 1;
  athletes = [];
  athletesLoaded = false;
  loadingAthletes = false;
  page = 0;
  pages = 0;
  total = 0;
  openAthleteId = null;
  resetStudentsSearch({ keepInput: false });
}

export function getStudents() {
  return athletes;
}

export function openAddStudentModal() {
  if (!overlay) return;
  clearCloseTimer();
  setStatus('');
  form?.reset();
  resetSubmitBtn();
  overlay.classList.add('open');
  emailInput?.focus();
}

export function closeAddStudentModal() {
  clearCloseTimer();
  overlay?.classList.remove('open');
  setStatus('');
  resetSubmitBtn();
}

export function syncStudentsLabels() {
  document.querySelectorAll('#students-view [data-ui], #add-student-overlay [data-ui]')
    .forEach(el => {
      el.textContent = ui(el.dataset.ui);
    });

  if (emailInput) emailInput.placeholder = ui('inviteEmailPlaceholder');
  if (searchInput) searchInput.placeholder = ui('studentsSearch');
  if (submitBtn && !submitBtn.classList.contains('is-sent') && submitLabel) {
    submitLabel.textContent = ui('addStudentSubmit');
  }

  syncSearchClear();
  if (athletesLoaded) renderStudentsList();
}

function renderStudentsList() {
  const empty = document.getElementById('students-empty');
  const list = document.getElementById('students-list');
  const emptyTitle = empty?.querySelector('.students-empty-title');
  const emptyLead = empty?.querySelector('.students-empty-lead');
  const emptyAdd = document.getElementById('students-empty-add-btn');
  if (!empty || !list) return;

  const has = athletes.length > 0;
  const searching = Boolean(searchQuery);
  empty.hidden = has;
  list.hidden = !has;
  list.replaceChildren();

  if (!has) {
    openAthleteId = null;
    if (emptyTitle) {
      emptyTitle.dataset.ui = searching ? 'studentsSearchEmptyTitle' : 'studentsEmptyTitle';
      emptyTitle.textContent = ui(emptyTitle.dataset.ui);
    }
    if (emptyLead) {
      emptyLead.dataset.ui = searching ? 'studentsSearchEmptyLead' : 'studentsEmptyLead';
      emptyLead.textContent = ui(emptyLead.dataset.ui);
    }
    if (emptyAdd) emptyAdd.hidden = searching;
    syncLoadMoreBtn();
    return;
  }

  if (emptyAdd) emptyAdd.hidden = false;

  const frag = document.createDocumentFragment();
  for (const athlete of athletes) {
    frag.appendChild(createStudentRow(athlete));
  }
  list.appendChild(frag);
  syncLoadMoreBtn();
}

function syncLoadMoreBtn() {
  if (!loadMoreBtn) loadMoreBtn = document.getElementById('students-load-more');
  if (!loadMoreBtn) return;

  const show = athletes.length > 0 && hasMoreAthletes();
  loadMoreBtn.hidden = !show;
  loadMoreBtn.disabled = loadingAthletes;
  const label = loadMoreBtn.querySelector('[data-ui="studentsLoadMore"]');
  if (label) label.textContent = ui('studentsLoadMore');
}

function toggleDownloadMenu() {
  if (downloadWrap?.classList.contains('is-open')) closeDownloadMenu();
  else openDownloadMenu();
}

function openDownloadMenu() {
  if (!downloadWrap || !downloadMenu || !downloadBtn) return;
  downloadWrap.classList.add('is-open');
  downloadMenu.hidden = false;
  downloadBtn.setAttribute('aria-expanded', 'true');
}

function closeDownloadMenu() {
  if (!downloadWrap || !downloadMenu || !downloadBtn) return;
  downloadWrap.classList.remove('is-open');
  downloadMenu.hidden = true;
  downloadBtn.setAttribute('aria-expanded', 'false');
}

function onDownloadAll() {
  closeDownloadMenu();
  // Shell: Excel export TBD (docs/TODO.md)
}

function createStudentRow(athlete) {
  const id = String(athlete?.id || '');
  const first = String(athlete?.firstName || '').trim();
  const last = String(athlete?.lastName || '').trim();
  const email = String(athlete?.email || '').trim();
  const full = [first, last].filter(Boolean).join(' ') || email || '—';

  const row = document.createElement('div');
  row.className = 'student-row';
  if (id) row.dataset.id = id;

  const header = document.createElement('button');
  header.type = 'button';
  header.className = 'student-row-header';
  header.setAttribute('aria-expanded', 'false');

  const avatar = document.createElement('span');
  avatar.className = 'student-row-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    || email.charAt(0).toUpperCase()
    || '?';

  const meta = document.createElement('span');
  meta.className = 'student-row-meta';

  const nameEl = document.createElement('span');
  nameEl.className = 'student-row-name';
  nameEl.textContent = full;
  meta.append(nameEl);

  const chevron = document.createElement('span');
  chevron.className = 'student-row-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  header.append(avatar, meta, chevron);

  const body = document.createElement('div');
  body.className = 'student-row-body';

  const emailLine = document.createElement('div');
  emailLine.className = 'student-row-detail-line';

  const downloadOne = document.createElement('button');
  downloadOne.type = 'button';
  downloadOne.className = 'student-row-download';
  downloadOne.textContent = '⏬';
  downloadOne.setAttribute('aria-label', ui('studentsDownloadPlan'));
  downloadOne.title = ui('studentsDownloadPlan');
  downloadOne.addEventListener('click', e => {
    e.stopPropagation();
    onDownloadAthlete(id);
  });

  emailLine.append(createDetail(ui('email'), email || '—'), downloadOne);

  body.append(
    createDetail(ui('firstName'), first || '—'),
    createDetail(ui('lastName'), last || '—'),
    emailLine,
  );

  header.addEventListener('click', () => toggleStudentRow(row));
  row.append(header, body);

  if (openAthleteId && openAthleteId === id) openStudentRow(row);

  return row;
}

function onDownloadAthlete(_athleteId) {
  // Shell: Excel export TBD (docs/TODO.md)
}

function createDetail(label, value) {
  const row = document.createElement('div');
  row.className = 'student-row-detail';

  const labelEl = document.createElement('span');
  labelEl.className = 'student-row-detail-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'student-row-detail-value';
  valueEl.textContent = value;

  row.append(labelEl, valueEl);
  return row;
}

function toggleStudentRow(row) {
  const opening = !row.classList.contains('is-open');
  document.querySelectorAll('#students-list .student-row.is-open').forEach(other => {
    if (other !== row) closeStudentRow(other);
  });
  if (opening) openStudentRow(row);
  else closeStudentRow(row);
}

function openStudentRow(row) {
  const header = row.querySelector('.student-row-header');
  row.classList.add('is-open');
  if (header) header.setAttribute('aria-expanded', 'true');
  openAthleteId = row.dataset.id || null;
}

function closeStudentRow(row) {
  const header = row.querySelector('.student-row-header');
  row.classList.remove('is-open');
  if (header) header.setAttribute('aria-expanded', 'false');
  if (openAthleteId && row.dataset.id === openAthleteId) openAthleteId = null;
}

function clearCloseTimer() {
  if (!closeTimer) return;
  window.clearTimeout(closeTimer);
  closeTimer = 0;
}

function resetSubmitBtn() {
  if (!submitBtn) return;
  submitBtn.disabled = false;
  submitBtn.classList.remove('is-sent');
  if (submitLabel) {
    submitLabel.dataset.ui = 'addStudentSubmit';
    submitLabel.textContent = ui('addStudentSubmit');
  }
  stopSubmitFill();
}

function stopSubmitFill() {
  if (!submitFill) return;
  submitFill.hidden = true;
  submitFill.style.animation = 'none';
  submitFill.style.width = '0%';
}

function startSubmitFill() {
  if (!submitFill) return;
  submitFill.hidden = false;
  submitFill.style.width = '';
  submitFill.style.animation = 'none';
  void submitFill.offsetWidth;
  submitFill.style.animation = '';
}

function setStatus(message, kind = '') {
  if (!statusEl) return;
  if (!message) {
    statusEl.hidden = true;
    statusEl.textContent = '';
    statusEl.classList.remove('is-error', 'is-ok');
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle('is-error', kind === 'error');
  statusEl.classList.toggle('is-ok', kind === 'ok');
}

function inviteErrorMessage(err) {
  const status = err?.status;
  const raw = Array.isArray(err?.message) ? err.message.join(' ') : String(err?.message || '');
  const lower = raw.toLowerCase();

  if (status === 404) return ui('inviteNotFound');
  if (status === 409) {
    if (lower.includes('pending')) return ui('invitePending');
    return ui('inviteHasCoach');
  }
  return ui('inviteFail');
}

async function onSubmit(e) {
  e.preventDefault();
  const email = emailInput?.value.trim() ?? '';
  if (!email) return;

  clearCloseTimer();
  setStatus('');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await inviteCoachAthlete(email);
    void loadCoachAthletes({ force: true });
    if (submitBtn) {
      submitBtn.classList.add('is-sent');
      submitBtn.disabled = true;
    }
    if (submitLabel) {
      submitLabel.dataset.ui = 'inviteSent';
      submitLabel.textContent = ui('inviteSent');
    }
    startSubmitFill();
    closeTimer = window.setTimeout(() => {
      closeTimer = 0;
      closeAddStudentModal();
    }, SUCCESS_CLOSE_MS);
  } catch (err) {
    console.error(err);
    setStatus(inviteErrorMessage(err), 'error');
    resetSubmitBtn();
  }
}
