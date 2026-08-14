/**
 * Athlete Avances: upload form (front/back/weight) + timeline/compare history.
 * Markup: #athlete-avances-view
 */
import { getProgressPhotos, uploadProgressPhotos } from '../api/users.js';
import { mapApiError } from '../utils/api-errors.js';
import { getLang, ui } from '../utils/labels.js';
import {
  currentYearMonthUtc,
  isValidYearMonth,
  normalizeYearMonth,
} from '../utils/year-month.js';
import {
  bindProgressCompareControls,
  createProgressHistoryRenderer,
  formatWeight,
  updateProgressCompareBar,
} from './progress-history-ui.js';
import {
  closeProgressPhotoLightbox,
} from './progress-photo-lightbox.js';

const WEIGHT_MIN = 20;
const WEIGHT_MAX = 400;

/** @type {{ years: Array<{ year: number, months: any[] }>, currentWeightKg?: number | null } | null} */
let photosPayload = null;
let loadSeq = 0;
let loading = false;
let loadError = null;
let saving = false;
let loadedUserId = null;
/** Year displayed inside the custom month panel. */
let pickerViewYear = null;
let monthPanelOpen = false;

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
let yearMonthInput;
let monthHintEl;
let monthTriggerBtn;
let monthTriggerLabel;
let monthPanelEl;
let monthYearLabelEl;
let monthGridEl;
let monthPrevYearBtn;
let monthNextYearBtn;
let saveBtn;
let formStatusEl;
let toastEl;
let toastTitleEl;
let toastDetailEl;
let toastHideTimer = null;
let currentWeightWrap;
let currentWeightValueEl;
let compareBar;
let compareBtn;
let compareConfirmBtn;
let resultsEl;

/** @type {string | null} */
let frontPreviewUrl = null;
/** @type {string | null} */
let backPreviewUrl = null;

const history = createProgressHistoryRenderer({
  getPerson: () => getUser(),
  getEmptyLead: () => ui('progressPhotosEmptyLeadAthlete'),
});

export function initAthleteAvancesUi(opts = {}) {
  if (typeof opts.getUser === 'function') getUser = opts.getUser;
  if (typeof opts.refreshUser === 'function') refreshUser = opts.refreshUser;

  formEl = document.getElementById('athlete-avances-form');
  frontInput = document.getElementById('athlete-avances-front');
  backInput = document.getElementById('athlete-avances-back');
  frontPreviewEl = document.getElementById('athlete-avances-front-preview');
  backPreviewEl = document.getElementById('athlete-avances-back-preview');
  weightInput = document.getElementById('athlete-avances-weight');
  yearMonthInput = document.getElementById('athlete-avances-year-month');
  monthHintEl = document.getElementById('athlete-avances-month-hint');
  monthTriggerBtn = document.getElementById('athlete-avances-month-trigger');
  monthTriggerLabel = document.getElementById('athlete-avances-month-trigger-label');
  monthPanelEl = document.getElementById('athlete-avances-month-panel');
  monthYearLabelEl = document.getElementById('athlete-avances-month-year-label');
  monthGridEl = document.getElementById('athlete-avances-month-grid');
  monthPrevYearBtn = document.getElementById('athlete-avances-month-prev-year');
  monthNextYearBtn = document.getElementById('athlete-avances-month-next-year');
  saveBtn = document.getElementById('athlete-avances-save');
  formStatusEl = document.getElementById('athlete-avances-form-status');
  toastEl = document.getElementById('athlete-avances-toast');
  toastTitleEl = document.getElementById('athlete-avances-toast-title');
  toastDetailEl = document.getElementById('athlete-avances-toast-detail');
  currentWeightWrap = document.getElementById('athlete-avances-current-weight');
  currentWeightValueEl = document.getElementById('athlete-avances-current-weight-value');
  compareBar = document.getElementById('athlete-avances-compare-bar');
  compareBtn = document.getElementById('athlete-avances-compare-btn');
  compareConfirmBtn = document.getElementById('athlete-avances-compare-confirm-btn');
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

  monthTriggerBtn?.addEventListener('click', () => {
    if (saving) return;
    if (monthPanelOpen) closeMonthPanel();
    else openMonthPanel();
  });
  monthPrevYearBtn?.addEventListener('click', () => {
    if (pickerViewYear == null) return;
    pickerViewYear -= 1;
    renderMonthPanel();
  });
  monthNextYearBtn?.addEventListener('click', () => {
    if (pickerViewYear == null) return;
    const maxYear = Number(currentYearMonthUtc().slice(0, 4));
    if (pickerViewYear >= maxYear) return;
    pickerViewYear += 1;
    renderMonthPanel();
  });
  monthGridEl?.addEventListener('click', event => {
    const btn = event.target.closest('[data-month]');
    if (!btn || btn.disabled) return;
    const month = String(btn.dataset.month || '').padStart(2, '0');
    if (!pickerViewYear || !month) return;
    setYearMonthValue(`${pickerViewYear}-${month}`);
    closeMonthPanel();
  });

  document.addEventListener('click', event => {
    if (!monthPanelOpen) return;
    const root = document.getElementById('athlete-avances-month-picker-ui');
    if (root && !root.contains(event.target)) closeMonthPanel();
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && monthPanelOpen) {
      event.stopPropagation();
      closeMonthPanel();
    }
  });

  bindProgressCompareControls({
    history,
    compareBtn,
    compareConfirmBtn,
    onRender: renderHistoryBody,
  });

  syncYearMonthBounds();
  syncMonthHint();
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
  if (monthPrevYearBtn) monthPrevYearBtn.setAttribute('aria-label', ui('athleteAvancesPrevYear'));
  if (monthNextYearBtn) monthNextYearBtn.setAttribute('aria-label', ui('athleteAvancesNextYear'));
  if (monthPanelEl) monthPanelEl.setAttribute('aria-label', ui('athleteAvancesMonth'));
  syncMonthTriggerLabel();
  if (monthPanelOpen) renderMonthPanel();
  syncMonthHint();
}

export function syncAthleteAvancesView() {
  const viewEl = document.getElementById('athlete-avances-view');
  if (!viewEl || viewEl.hidden) {
    closeProgressPhotoLightbox();
    hideSaveToast();
    closeMonthPanel();
    return;
  }

  syncYearMonthBounds();
  syncAthleteAvancesLabels();
  updateCurrentWeightDisplay();
  void ensurePhotosLoaded().then(() => renderHistoryBody());
}

function formatMonthLabel(yearMonth) {
  const match = String(yearMonth || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(yearMonth || '');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  const raw = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function syncYearMonthBounds() {
  setYearMonthValue(normalizeYearMonth(yearMonthInput?.value), { silent: true });
}

function setYearMonthValue(yearMonth, { silent = false } = {}) {
  const value = normalizeYearMonth(yearMonth);
  if (yearMonthInput) yearMonthInput.value = value;
  syncMonthTriggerLabel();
  if (!silent) {
    syncMonthHint();
    syncSaveEnabled();
  }
}

function syncMonthTriggerLabel() {
  if (!monthTriggerLabel) return;
  const value = String(yearMonthInput?.value || '').trim();
  const current = currentYearMonthUtc();
  if (!isValidYearMonth(value)) {
    monthTriggerLabel.textContent = ui('athleteAvancesMonthCurrent');
    return;
  }
  monthTriggerLabel.textContent =
    value === current ? ui('athleteAvancesMonthCurrent') : formatMonthLabel(value);
}

function monthShortLabels() {
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  return Array.from({ length: 12 }, (_, index) => {
    const raw = new Intl.DateTimeFormat(locale, {
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2020, index, 1)));
    const cleaned = raw.replace(/\.$/, '');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  });
}

function openMonthPanel() {
  if (!monthPanelEl || !monthTriggerBtn) return;
  const selected = String(yearMonthInput?.value || currentYearMonthUtc());
  pickerViewYear = Number(selected.slice(0, 4)) || Number(currentYearMonthUtc().slice(0, 4));
  monthPanelOpen = true;
  monthPanelEl.hidden = false;
  monthTriggerBtn.setAttribute('aria-expanded', 'true');
  renderMonthPanel();
}

function closeMonthPanel() {
  monthPanelOpen = false;
  if (monthPanelEl) monthPanelEl.hidden = true;
  monthTriggerBtn?.setAttribute('aria-expanded', 'false');
}

function renderMonthPanel() {
  if (!monthGridEl || pickerViewYear == null) return;
  const current = currentYearMonthUtc();
  const maxYear = Number(current.slice(0, 4));
  const maxMonth = Number(current.slice(5, 7));
  const selected = String(yearMonthInput?.value || '');
  const labels = monthShortLabels();

  if (monthYearLabelEl) monthYearLabelEl.textContent = String(pickerViewYear);
  if (monthPrevYearBtn) monthPrevYearBtn.disabled = false;
  if (monthNextYearBtn) monthNextYearBtn.disabled = pickerViewYear >= maxYear;

  monthGridEl.innerHTML = '';
  labels.forEach((label, index) => {
    const monthNum = index + 1;
    const month = String(monthNum).padStart(2, '0');
    const value = `${pickerViewYear}-${month}`;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'month-picker-month';
    btn.dataset.month = month;
    btn.textContent = label;
    btn.disabled = pickerViewYear > maxYear || (pickerViewYear === maxYear && monthNum > maxMonth);
    if (value === selected) btn.classList.add('is-selected');
    monthGridEl.appendChild(btn);
  });
}

function selectedYearMonth() {
  const value = String(yearMonthInput?.value || '').trim();
  return isValidYearMonth(value) ? value : null;
}

function syncMonthHint() {
  if (!monthHintEl) return;
  const yearMonth = selectedYearMonth() || currentYearMonthUtc();
  monthHintEl.textContent = ui('athleteAvancesMonthHintFor').replace(
    '{month}',
    formatMonthLabel(yearMonth),
  );
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
  }
  renderHistoryBody();

  try {
    const payload = await getProgressPhotos(userId);
    if (seq !== loadSeq) return;
    photosPayload = payload && Array.isArray(payload.years) ? payload : { years: [] };
  } catch (err) {
    if (seq !== loadSeq) return;
    loadError = err;
    photosPayload = null;
  } finally {
    if (seq === loadSeq) loading = false;
    renderHistoryBody();
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

function clearFormInputs() {
  clearPhotoInputs();
  if (weightInput) weightInput.value = '';
  syncYearMonthBounds();
  syncMonthHint();
  syncSaveEnabled();
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
  return hasPhotoSelected() && parsedWeightKg() != null && Boolean(selectedYearMonth());
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

function hideSaveToast() {
  if (toastHideTimer != null) {
    clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }
  if (!toastEl || toastEl.hidden) return;

  toastEl.classList.remove('is-visible');
  toastEl.classList.add('is-leaving');

  const finish = () => {
    toastEl.hidden = true;
    toastEl.classList.remove('is-leaving');
    if (toastTitleEl) toastTitleEl.textContent = '';
    if (toastDetailEl) toastDetailEl.textContent = '';
  };

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    finish();
    return;
  }

  window.setTimeout(finish, 280);
}

function showSaveToast(yearMonth = null) {
  if (!toastEl || !toastTitleEl || !toastDetailEl) return;

  if (toastHideTimer != null) {
    clearTimeout(toastHideTimer);
    toastHideTimer = null;
  }

  const month = yearMonth || selectedYearMonth() || currentYearMonthUtc();
  toastTitleEl.textContent = ui('athleteAvancesSaveOk');
  toastDetailEl.textContent = ui('athleteAvancesSaveOkDetailMonth').replace(
    '{month}',
    formatMonthLabel(month),
  );

  toastEl.hidden = false;
  toastEl.classList.remove('is-leaving');
  toastEl.classList.remove('is-visible');
  // Force reflow so the enter transition always runs.
  void toastEl.offsetWidth;
  requestAnimationFrame(() => {
    toastEl.classList.add('is-visible');
  });

  toastHideTimer = window.setTimeout(() => {
    toastHideTimer = null;
    hideSaveToast();
  }, 3400);
}

function setSaving(next) {
  saving = next;
  if (frontInput) frontInput.disabled = next;
  if (backInput) backInput.disabled = next;
  if (weightInput) weightInput.disabled = next;
  if (monthTriggerBtn) monthTriggerBtn.disabled = next;
  if (monthPrevYearBtn) monthPrevYearBtn.disabled = next;
  if (monthNextYearBtn) monthNextYearBtn.disabled = next;
  if (next) closeMonthPanel();
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
  const yearMonth = selectedYearMonth();

  setSaving(true);
  setFormStatus('');
  hideSaveToast();

  try {
    await uploadProgressPhotos({ weightKg, frontFile, backFile, yearMonth });
    clearFormInputs();
    showSaveToast(yearMonth);
    await refreshUser().catch(() => {});
    resetHistoryCache();
    history.resetCompareState();
    await ensurePhotosLoaded({ force: true });
    renderHistoryBody();
    updateCurrentWeightDisplay();
  } catch (err) {
    setFormStatus(mapApiError(err, { fallback: 'athleteAvancesSaveFail' }), { isError: true });
  } finally {
    setSaving(false);
  }
}

function renderHistoryBody() {
  if (!resultsEl) return;
  updateCurrentWeightDisplay();

  history.render({
    resultsEl,
    payload: photosPayload,
    loading,
    loadError,
    onStateChange({
      viewMode,
      selectedYearMonths,
      comparableMonths,
      loading: isLoading,
      loadError: err,
    }) {
      updateProgressCompareBar({
        compareBar,
        compareBtn,
        compareConfirmBtn,
        viewMode,
        selectedYearMonths,
        comparableMonths,
        loading: isLoading,
        loadError: err,
      });
    },
  });
}
