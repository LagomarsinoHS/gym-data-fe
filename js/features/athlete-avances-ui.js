/**
 * Athlete Avances: upload form (front/back/weight) + timeline/compare history.
 * Markup: #athlete-avances-view
 */
import { getProgressPhotos, uploadProgressPhotos } from '../api/users.js';
import { ui } from '../utils/labels.js';
import {
  createProgressHistoryRenderer,
  formatWeight,
  updateProgressCompareBar,
} from './progress-history-ui.js';
import {
  closeProgressPhotoLightbox,
  initProgressPhotoLightbox,
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

  compareBtn?.addEventListener('click', () => {
    if (history.getViewMode() === 'timeline') {
      history.enterPickMode();
      renderHistoryBody();
      return;
    }
    if (history.getViewMode() === 'pick') {
      history.exitToTimeline();
    }
  });

  compareConfirmBtn?.addEventListener('click', () => {
    if (!history.enterCompareMode()) return;
    renderHistoryBody();
  });

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
    clearFormInputs();
    setFormStatus(ui('athleteAvancesSaveOk'));
    await refreshUser().catch(() => {});
    resetHistoryCache();
    history.resetCompareState();
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
