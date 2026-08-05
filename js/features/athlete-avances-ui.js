/**
 * Athlete Avances: upload form (front/back/weight) + year/month history.
 * Markup: #athlete-avances-view
 */
import { getProgressPhotos, uploadProgressPhotos } from '../api/users.js';
import { getLang, ui } from '../utils/labels.js';
import {
  closeProgressPhotoLightbox,
  initProgressPhotoLightbox,
  openProgressPhotoLightbox,
} from './progress-photo-lightbox.js';

const YEAR_RANGE_START = 2020;
const WEIGHT_MIN = 20;
const WEIGHT_MAX = 400;

/** @type {{ years: Array<{ year: number, months: any[] }>, currentWeightKg?: number | null } | null} */
let photosPayload = null;
/** @type {Map<string, { yearMonth: string, weightKg?: number | null, front: any, back: any }> | null} */
let photosByYearMonth = null;
let selectedYear = null;
let selectedYearMonth = null;
let loadSeq = 0;
let loading = false;
let loadError = null;
let saving = false;
let loadedUserId = null;

/** @type {() => object | null} */
let getUser = () => null;
/** @type {() => Promise<unknown>} */
let refreshUser = async () => {};

let formEl;
let frontInput;
let backInput;
let frontPreviewEl;
let backPreviewEl;
let weightInput;
let saveBtn;
let formStatusEl;
let currentWeightWrap;
let currentWeightValueEl;
let filtersEl;
let resultsEl;

/** @type {string | null} */
let frontPreviewUrl = null;
/** @type {string | null} */
let backPreviewUrl = null;

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

function formatWeight(weight) {
  if (weight == null || weight === '') return '—';
  if (typeof weight === 'number' && Number.isFinite(weight)) {
    return `${weight} kg`;
  }
  const text = String(weight).trim();
  return text || '—';
}

export function initAthleteAvancesUi(opts = {}) {
  if (typeof opts.getUser === 'function') getUser = opts.getUser;
  if (typeof opts.refreshUser === 'function') refreshUser = opts.refreshUser;

  initProgressPhotoLightbox();
  formEl = document.getElementById('athlete-avances-form');
  frontInput = document.getElementById('athlete-avances-front');
  backInput = document.getElementById('athlete-avances-back');
  frontPreviewEl = document.getElementById('athlete-avances-front-preview');
  backPreviewEl = document.getElementById('athlete-avances-back-preview');
  weightInput = document.getElementById('athlete-avances-weight');
  saveBtn = document.getElementById('athlete-avances-save');
  formStatusEl = document.getElementById('athlete-avances-form-status');
  currentWeightWrap = document.getElementById('athlete-avances-current-weight');
  currentWeightValueEl = document.getElementById('athlete-avances-current-weight-value');
  filtersEl = document.getElementById('athlete-avances-filters');
  resultsEl = document.getElementById('athlete-avances-results');

  formEl?.addEventListener('submit', event => {
    event.preventDefault();
    void onSave();
  });

  frontInput?.addEventListener('change', () => {
    updatePhotoPreview('front');
    syncSaveEnabled();
  });
  backInput?.addEventListener('change', () => {
    updatePhotoPreview('back');
    syncSaveEnabled();
  });
  weightInput?.addEventListener('input', syncSaveEnabled);
  weightInput?.addEventListener('change', syncSaveEnabled);
  syncSaveEnabled();
}

export function syncAthleteAvancesLabels() {
  document.querySelectorAll('#athlete-avances-view [data-ui]').forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });
  if (saveBtn && saving) {
    const label = saveBtn.querySelector('[data-ui]');
    if (label) label.textContent = ui('athleteAvancesSaving');
  }
}

export function syncAthleteAvancesView() {
  const viewEl = document.getElementById('athlete-avances-view');
  if (!viewEl || viewEl.hidden) {
    closeProgressPhotoLightbox();
    return;
  }

  syncAthleteAvancesLabels();
  updateCurrentWeightDisplay();
  void ensurePhotosLoaded().then(() => renderHistoryBody());
}

function updateCurrentWeightDisplay() {
  const fromPayload = photosPayload?.currentWeightKg;
  const fromUser = getUser()?.currentWeightKg;
  const weight = fromPayload != null ? fromPayload : fromUser;
  const hasWeight = weight != null && weight !== '';

  if (currentWeightWrap) currentWeightWrap.hidden = !hasWeight;
  if (currentWeightValueEl) {
    currentWeightValueEl.textContent = formatWeight(weight);
  }
}

function resetHistoryCache() {
  photosPayload = null;
  photosByYearMonth = null;
  loadError = null;
  loading = false;
  loadedUserId = null;
}

async function ensurePhotosLoaded({ force = false } = {}) {
  const user = getUser();
  const userId = user?.id;
  if (!userId) return;
  if (!force && photosPayload && loadedUserId === userId) return;
  if (!force && loading && loadedUserId === userId) return;

  const seq = ++loadSeq;
  loading = true;
  loadError = null;
  loadedUserId = userId;
  if (force) {
    photosPayload = null;
    photosByYearMonth = null;
  }
  renderHistoryBody();

  try {
    const payload = await getProgressPhotos(userId);
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

function updatePhotoPreview(side) {
  const input = side === 'front' ? frontInput : backInput;
  const previewEl = side === 'front' ? frontPreviewEl : backPreviewEl;
  const slot = input?.closest('.athlete-avances-photo-slot');
  const file = input?.files?.[0] || null;

  const prevUrl = side === 'front' ? frontPreviewUrl : backPreviewUrl;
  if (prevUrl) URL.revokeObjectURL(prevUrl);

  if (!file || !previewEl) {
    if (side === 'front') frontPreviewUrl = null;
    else backPreviewUrl = null;
    if (previewEl) {
      previewEl.hidden = true;
      previewEl.removeAttribute('src');
      previewEl.alt = '';
    }
    slot?.classList.remove('has-preview');
    return;
  }

  const url = URL.createObjectURL(file);
  if (side === 'front') frontPreviewUrl = url;
  else backPreviewUrl = url;

  previewEl.src = url;
  previewEl.alt = side === 'front' ? ui('progressPhotosFront') : ui('progressPhotosBackSide');
  previewEl.hidden = false;
  slot?.classList.add('has-preview');
}

function clearPhotoInputs() {
  if (frontInput) frontInput.value = '';
  if (backInput) backInput.value = '';
  updatePhotoPreview('front');
  updatePhotoPreview('back');
}

function hasPhotoSelected() {
  return Boolean(frontInput?.files?.[0] || backInput?.files?.[0]);
}

function parsedWeightKg() {
  const weightKg = Number(weightInput?.value);
  if (!Number.isFinite(weightKg) || weightKg < WEIGHT_MIN || weightKg > WEIGHT_MAX) {
    return null;
  }
  return weightKg;
}

function isFormReady() {
  return hasPhotoSelected() && parsedWeightKg() != null;
}

function syncSaveEnabled() {
  if (!saveBtn) return;
  saveBtn.disabled = saving || !isFormReady();
}

function setFormStatus(message, { isError = false } = {}) {
  if (!formStatusEl) return;
  if (!message) {
    formStatusEl.hidden = true;
    formStatusEl.textContent = '';
    formStatusEl.classList.remove('is-error', 'is-ok');
    return;
  }
  formStatusEl.hidden = false;
  formStatusEl.textContent = message;
  formStatusEl.classList.toggle('is-error', isError);
  formStatusEl.classList.toggle('is-ok', !isError);
}

function setSaving(next) {
  saving = next;
  if (frontInput) frontInput.disabled = next;
  if (backInput) backInput.disabled = next;
  if (weightInput) weightInput.disabled = next;
  frontInput?.closest('.athlete-avances-photo-slot')?.classList.toggle('is-disabled', next);
  backInput?.closest('.athlete-avances-photo-slot')?.classList.toggle('is-disabled', next);
  syncSaveEnabled();
  syncAthleteAvancesLabels();
}

async function onSave() {
  if (saving || !isFormReady()) return;

  const frontFile = frontInput?.files?.[0] || null;
  const backFile = backInput?.files?.[0] || null;
  const weightKg = parsedWeightKg();
  if (weightKg == null) return;

  setSaving(true);
  setFormStatus('');

  try {
    await uploadProgressPhotos({ weightKg, frontFile, backFile });
    clearPhotoInputs();
    setFormStatus(ui('athleteAvancesSaveOk'));
    await refreshUser().catch(() => {});
    resetHistoryCache();
    await ensurePhotosLoaded({ force: true });
    renderHistoryBody();
    updateCurrentWeightDisplay();
  } catch (err) {
    const message =
      (typeof err?.message === 'string' && err.message.trim()) ||
      ui('athleteAvancesSaveFail');
    setFormStatus(message, { isError: true });
  } finally {
    setSaving(false);
  }
}

function renderHistoryBody() {
  if (!filtersEl || !resultsEl) return;
  filtersEl.replaceChildren();
  resultsEl.replaceChildren();
  updateCurrentWeightDisplay();

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

function createMonthWeightRow(monthEntry) {
  const weight = monthEntry?.weightKg;
  if (weight == null || weight === '') return null;

  const row = document.createElement('div');
  row.className = 'athlete-avances-month-weight-row';

  const pill = document.createElement('span');
  pill.className = 'athlete-avances-month-weight-pill';
  const label =
    ui('athleteAvancesMonthWeightPill') ||
    (getLang() === 'en' ? 'Weight' : 'Peso');
  pill.textContent = `${label}: ${formatWeight(weight)}`;

  row.append(pill);
  return row;
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
    renderHistoryBody();
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
    renderHistoryBody();
  });

  field.append(label, select);
  return field;
}

function createPhotosSection() {
  if (selectedYear == null || !selectedYearMonth) return null;

  const monthEntry = photosByYearMonth?.get(selectedYearMonth) || null;
  const hasFront = Boolean(monthEntry?.front?.url);
  const hasBack = Boolean(monthEntry?.back?.url);

  const panel = document.createElement('section');
  panel.className = 'athlete-avances-month-panel';

  const weightRow = createMonthWeightRow(monthEntry);
  if (weightRow) panel.append(weightRow);

  if (!hasFront && !hasBack) {
    panel.append(createNoDataState());
    return panel;
  }

  const grid = document.createElement('div');
  grid.className = 'progress-photos-grid';
  grid.append(
    createPhotoCard(ui('progressPhotosFront'), monthEntry?.front, 'front'),
    createPhotoCard(ui('progressPhotosBackSide'), monthEntry?.back, 'back'),
  );
  panel.append(grid);
  return panel;
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
      const user = getUser();
      openProgressPhotoLightbox({
        url: photo.url,
        title,
        side,
        firstName: user?.firstName,
        lastName: user?.lastName,
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
