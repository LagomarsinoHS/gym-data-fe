/**
 * Coach progress-photos view: year/month selects → front/back images.
 * Images render only after both year and month are chosen.
 * Opened from Mis alumnos via openProgressPhotos(athleteId).
 */
import { getProgressPhotos } from '../api/users.js';
import { getLang, ui } from '../utils/labels.js';
import {
  athleteDisplayName,
  findAthlete,
  store,
} from './coach-athletes-store.js';
import {
  closeProgressPhotoLightbox,
  initProgressPhotoLightbox,
  openProgressPhotoLightbox,
} from './progress-photo-lightbox.js';

const YEAR_RANGE_START = 2020;

/** @type {{ years: Array<{ year: number, months: any[] }>, currentWeightKg?: number | null } | null} */
let photosPayload = null;
/** @type {Map<string, { yearMonth: string, weightKg?: number | null, front: any, back: any }> | null} */
let photosByYearMonth = null;
let selectedYear = null;
let selectedYearMonth = null;
let loadSeq = 0;
let loading = false;
let loadError = null;

let backBtn;
let athleteCardEl;
let athleteNameEl;
let athleteEmailEl;
let athleteCurrentWeightEl;
let athleteMonthWeightEl;
let filtersEl;
let resultsEl;

function currentUtcYear() {
  return Number(
    new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date()),
  );
}

function yearOptions() {
  const end = currentUtcYear();
  const years = [];
  for (let y = end; y >= YEAR_RANGE_START; y -= 1) years.push(y);
  return years;
}

function yearMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function indexPhotosByYearMonth(payload) {
  /** @type {Map<string, { yearMonth: string, front: any, back: any }>} */
  const map = new Map();
  for (const yearEntry of payload?.years || []) {
    for (const monthEntry of yearEntry.months || []) {
      if (monthEntry?.yearMonth) map.set(monthEntry.yearMonth, monthEntry);
    }
  }
  return map;
}

export function initProgressPhotosUi() {
  initProgressPhotoLightbox();
  backBtn = document.getElementById('progress-photos-back');
  athleteCardEl = document.getElementById('progress-photos-athlete-card');
  athleteNameEl = document.getElementById('progress-photos-athlete-name');
  athleteEmailEl = document.getElementById('progress-photos-athlete-email');
  athleteCurrentWeightEl = document.getElementById('progress-photos-athlete-current-weight');
  athleteMonthWeightEl = document.getElementById('progress-photos-athlete-month-weight');
  filtersEl = document.getElementById('progress-photos-filters');
  resultsEl = document.getElementById('progress-photos-results');

  backBtn?.addEventListener('click', () => {
    closeProgressPhotoLightbox();
    const returnTo =
      store.progressReturnView === 'avances' ? 'avances' : 'students';
    store.progressAthleteId = null;
    store.progressAthleteSnapshot = null;
    store.progressReturnView = 'students';
    photosPayload = null;
    photosByYearMonth = null;
    selectedYear = null;
    selectedYearMonth = null;
    loadError = null;
    store.navigateTo(returnTo);
  });
}

export function openProgressPhotos(athleteId, opts = {}) {
  const id = String(athleteId || '');
  if (!id) return;
  const returnTo = opts.returnTo === 'avances' ? 'avances' : 'students';
  store.progressAthleteId = id;
  store.progressReturnView = returnTo;
  store.progressAthleteSnapshot = opts.athlete || findAthlete(id);
  photosPayload = null;
  photosByYearMonth = null;
  selectedYear = null;
  selectedYearMonth = null;
  loadError = null;
  closeProgressPhotoLightbox();
  store.navigateTo('progress-photos');
}

export function syncProgressPhotosView() {
  const viewEl = document.getElementById('progress-photos-view');
  if (!viewEl || viewEl.hidden) {
    closeProgressPhotoLightbox();
    return;
  }

  syncProgressPhotosLabels();
  updateAthleteCard();
  void ensurePhotosLoaded().then(() => renderProgressPhotosBody());
}

export function syncProgressPhotosLabels() {
  document.querySelectorAll('#progress-photos-view [data-ui]').forEach(el => {
    if (el.dataset.ui === 'progressPhotosBack') {
      el.textContent =
        store.progressReturnView === 'avances'
          ? ui('navAvances')
          : ui('progressPhotosBack');
      return;
    }
    el.textContent = ui(el.dataset.ui);
  });
}

function updateAthleteCard() {
  if (!athleteCardEl) return;
  const athlete = findAthlete(store.progressAthleteId);
  if (!athlete) {
    athleteCardEl.hidden = true;
    return;
  }

  athleteCardEl.hidden = false;
  if (athleteNameEl) athleteNameEl.textContent = athleteDisplayName(athlete);
  if (athleteEmailEl) {
    athleteEmailEl.textContent = String(athlete.email || '').trim() || '—';
  }

  if (athleteCurrentWeightEl) {
    athleteCurrentWeightEl.textContent = formatWeight(photosPayload?.currentWeightKg);
  }

  if (athleteMonthWeightEl) {
    const monthEntry = selectedYearMonth
      ? photosByYearMonth?.get(selectedYearMonth)
      : null;
    athleteMonthWeightEl.textContent = formatWeight(monthEntry?.weightKg);
  }
}

function formatWeight(weight) {
  if (weight == null || weight === '') return '—';
  if (typeof weight === 'number' && Number.isFinite(weight)) {
    return `${weight} kg`;
  }
  const text = String(weight).trim();
  return text || '—';
}

async function ensurePhotosLoaded() {
  const athleteId = store.progressAthleteId;
  if (!athleteId) return;
  if (photosPayload || loading) return;

  const seq = ++loadSeq;
  loading = true;
  loadError = null;
  renderProgressPhotosBody();

  try {
    const payload = await getProgressPhotos(athleteId);
    if (seq !== loadSeq) return;
    photosPayload = payload && Array.isArray(payload.years) ? payload : { years: [] };
    photosByYearMonth = indexPhotosByYearMonth(photosPayload);
  } catch (err) {
    if (seq !== loadSeq) return;
    loadError = err;
    photosPayload = null;
    photosByYearMonth = null;
  } finally {
    if (seq === loadSeq) loading = false;
  }
}

function renderProgressPhotosBody() {
  if (!filtersEl || !resultsEl) return;
  filtersEl.replaceChildren();
  resultsEl.replaceChildren();
  updateAthleteCard();

  if (loading) {
    const p = document.createElement('p');
    p.className = 'progress-photos-status';
    p.textContent = ui('progressPhotosLoading');
    resultsEl.append(p);
    return;
  }

  if (loadError) {
    const p = document.createElement('p');
    p.className = 'progress-photos-status is-error';
    p.textContent = ui('progressPhotosLoadFail');
    resultsEl.append(p);
    return;
  }

  if (!photosPayload) return;

  filtersEl.append(createFiltersRow());
  const photosSection = createPhotosSection();
  if (photosSection) resultsEl.append(photosSection);
}

function createFiltersRow() {
  const row = document.createElement('div');
  row.className = 'progress-photos-filters';

  row.append(createYearSelect(), createMonthSelect());
  return row;
}

function createYearSelect() {
  const field = document.createElement('label');
  field.className = 'progress-photos-field';

  const label = document.createElement('span');
  label.className = 'progress-photos-section-label';
  label.textContent = ui('progressPhotosYears');

  const select = document.createElement('select');
  select.className = 'progress-photos-select';
  select.setAttribute('aria-label', ui('progressPhotosYears'));

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = ui('progressPhotosPickYear');
  placeholder.disabled = true;
  placeholder.selected = selectedYear == null;
  select.append(placeholder);

  for (const year of yearOptions()) {
    const opt = document.createElement('option');
    opt.value = String(year);
    opt.textContent = String(year);
    if (year === selectedYear) opt.selected = true;
    select.append(opt);
  }

  select.addEventListener('change', () => {
    const value = select.value;
    selectedYear = value ? Number(value) : null;
    selectedYearMonth = null;
    renderProgressPhotosBody();
  });

  field.append(label, select);
  return field;
}

function createMonthSelect() {
  const field = document.createElement('label');
  field.className = 'progress-photos-field';

  const label = document.createElement('span');
  label.className = 'progress-photos-section-label';
  label.textContent = ui('progressPhotosMonths');

  const select = document.createElement('select');
  select.className = 'progress-photos-select';
  select.setAttribute('aria-label', ui('progressPhotosMonths'));

  const yearPicked = selectedYear != null;
  select.disabled = !yearPicked;

  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = ui('progressPhotosPickMonth');
  placeholder.disabled = true;
  placeholder.selected = !selectedYearMonth;
  select.append(placeholder);

  if (yearPicked) {
    for (let month = 1; month <= 12; month += 1) {
      const key = yearMonthKey(selectedYear, month);
      const opt = document.createElement('option');
      opt.value = key;
      opt.textContent = monthLabel(month);
      if (key === selectedYearMonth) opt.selected = true;
      select.append(opt);
    }
  }

  select.addEventListener('change', () => {
    selectedYearMonth = select.value || null;
    renderProgressPhotosBody();
  });

  field.append(label, select);
  return field;
}

function createPhotosSection() {
  if (selectedYear == null || !selectedYearMonth) return null;

  const monthEntry = photosByYearMonth?.get(selectedYearMonth) || null;
  const hasFront = Boolean(monthEntry?.front?.url);
  const hasBack = Boolean(monthEntry?.back?.url);

  const section = document.createElement('section');
  section.className = 'progress-photos-section';

  if (!hasFront && !hasBack) {
    section.append(createNoDataState());
    return section;
  }

  const grid = document.createElement('div');
  grid.className = 'progress-photos-grid';
  grid.append(
    createPhotoCard(ui('progressPhotosFront'), monthEntry?.front, 'front'),
    createPhotoCard(ui('progressPhotosBackSide'), monthEntry?.back, 'back'),
  );
  section.append(grid);
  return section;
}

function createNoDataState() {
  const wrap = document.createElement('div');
  wrap.className = 'progress-photos-no-data';

  const pill = document.createElement('span');
  pill.className = 'progress-photos-no-data-pill';
  pill.textContent = ui('progressPhotosNoData');

  wrap.append(pill);
  return wrap;
}

function createPhotoCard(title, photo, side) {
  const card = document.createElement('article');
  card.className = 'progress-photos-card';

  const heading = document.createElement('h4');
  heading.className = 'progress-photos-card-title';
  heading.textContent = title;
  card.append(heading);

  if (photo?.url) {
    const img = document.createElement('img');
    img.className = 'progress-photos-card-img';
    img.src = photo.url;
    img.alt = title;
    img.loading = 'lazy';
    img.tabIndex = 0;
    img.setAttribute('role', 'button');
    img.setAttribute('aria-label', title);
    const open = () => {
      const athlete = findAthlete(store.progressAthleteId);
      openProgressPhotoLightbox({
        url: photo.url,
        title,
        side,
        firstName: athlete?.firstName,
        lastName: athlete?.lastName,
      });
    };
    img.addEventListener('click', open);
    img.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        open();
      }
    });
    card.append(img);
  } else {
    const empty = document.createElement('div');
    empty.className = 'progress-photos-card-empty';
    empty.textContent = ui('progressPhotosNoPhoto');
    card.append(empty);
  }

  return card;
}

function monthLabel(monthNumber) {
  const month = Number(monthNumber);
  if (!month || month < 1 || month > 12) return String(monthNumber ?? '');
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  return new Intl.DateTimeFormat(locale, {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(2000, month - 1, 1)));
}
