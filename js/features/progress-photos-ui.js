/**
 * Coach progress-photos view: chronological timeline + compare
 * (2 months side-by-side, 3+ dual carousels).
 * Opened from Mis alumnos / Avances via openProgressPhotos(athleteId).
 * Data: GET /users/:userId/progress-photos (single fetch; images lazy-load).
 */
import { analyzeProgressPhotos, getProgressPhotos } from '../api/users.js';
import { getLang, ui } from '../utils/labels.js';
import {
  athleteDisplayName,
  findAthlete,
  store,
} from './coach-athletes-store.js';
import {
  createProgressHistoryRenderer,
  formatWeight,
  updateProgressCompareBar,
} from './progress-history-ui.js';
import {
  closeProgressPhotoLightbox,
  initProgressPhotoLightbox,
} from './progress-photo-lightbox.js';
import { canAccessProgressAiAnalysis } from './session-ui.js';

/** @type {{ years: Array<{ year: number, months: any[] }>, currentWeightKg?: number | null } | null} */
let photosPayload = null;
let loadSeq = 0;
let loading = false;
let loadError = null;

/** @type {{ loading: boolean, text: string | null, error: string | null }} */
let analyzeAiState = { loading: false, text: null, error: null };
let analyzeSeq = 0;

let backBtn;
let compareBar;
let compareBtn;
let compareConfirmBtn;
let athleteCardEl;
let athleteNameEl;
let athleteEmailEl;
let athleteCurrentWeightEl;
let resultsEl;

const history = createProgressHistoryRenderer({
  getPerson: () => findAthlete(store.progressAthleteId),
  analyzeWithAi: {
    canAccess: () => canAccessProgressAiAnalysis(),
    getState: () => analyzeAiState,
    onAnalyze: yearMonths => {
      void runAnalyzeWithAi(yearMonths);
    },
  },
});

export function initProgressPhotosUi() {
  initProgressPhotoLightbox();
  backBtn = document.getElementById('progress-photos-back');
  compareBar = document.getElementById('progress-photos-compare-bar');
  compareBtn = document.getElementById('progress-photos-compare-btn');
  compareConfirmBtn = document.getElementById('progress-photos-compare-confirm-btn');
  athleteCardEl = document.getElementById('progress-photos-athlete-card');
  athleteNameEl = document.getElementById('progress-photos-athlete-name');
  athleteEmailEl = document.getElementById('progress-photos-athlete-email');
  athleteCurrentWeightEl = document.getElementById('progress-photos-athlete-current-weight');
  resultsEl = document.getElementById('progress-photos-results');

  backBtn?.addEventListener('click', () => {
    closeProgressPhotoLightbox();
    const returnTo =
      store.progressReturnView === 'avances' ? 'avances' : 'students';
    store.progressAthleteId = null;
    store.progressAthleteSnapshot = null;
    store.progressReturnView = 'students';
    history.resetCompareState();
    clearAnalyzeAiState();
    photosPayload = null;
    loadError = null;
    store.navigateTo(returnTo);
  });

  compareBtn?.addEventListener('click', () => {
    if (history.getViewMode() === 'timeline') {
      clearAnalyzeAiState();
      history.enterPickMode();
      renderProgressPhotosBody();
      return;
    }
    if (history.getViewMode() === 'pick') {
      clearAnalyzeAiState();
      history.exitToTimeline();
    }
  });

  compareConfirmBtn?.addEventListener('click', () => {
    if (!history.enterCompareMode()) return;
    clearAnalyzeAiState();
    renderProgressPhotosBody();
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
  loadError = null;
  clearAnalyzeAiState();
  history.resetCompareState();
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

function clearAnalyzeAiState() {
  analyzeSeq += 1;
  analyzeAiState = { loading: false, text: null, error: null };
}

async function runAnalyzeWithAi(yearMonths) {
  const athleteId = store.progressAthleteId;
  if (!athleteId || !canAccessProgressAiAnalysis()) return;
  if (!Array.isArray(yearMonths) || yearMonths.length !== 2) return;

  const seq = ++analyzeSeq;
  analyzeAiState = { loading: true, text: null, error: null };
  renderProgressPhotosBody();

  try {
    const res = await analyzeProgressPhotos(athleteId, {
      yearMonths,
      locale: getLang() === 'en' ? 'en' : 'es',
    });
    if (seq !== analyzeSeq) return;
    analyzeAiState = {
      loading: false,
      text: String(res?.analysis || '').trim() || null,
      error: String(res?.analysis || '').trim()
        ? null
        : ui('progressPhotosAnalyzeAiFail'),
    };
  } catch (err) {
    if (seq !== analyzeSeq) return;
    analyzeAiState = {
      loading: false,
      text: null,
      error:
        (typeof err?.message === 'string' && err.message.trim()) ||
        ui('progressPhotosAnalyzeAiFail'),
    };
  }

  renderProgressPhotosBody();
}

function updateAthleteCard() {
  if (!athleteCardEl) return;
  const athlete = findAthlete(store.progressAthleteId);
  if (!athlete) {
    athleteCardEl.hidden = true;
    return;
  }

  athleteCardEl.hidden = false;
  athleteCardEl.classList.toggle('is-chip', history.getViewMode() === 'compare');
  if (athleteNameEl) athleteNameEl.textContent = athleteDisplayName(athlete);
  if (athleteEmailEl) {
    athleteEmailEl.textContent = String(athlete.email || '').trim() || '—';
  }

  if (athleteCurrentWeightEl) {
    athleteCurrentWeightEl.textContent = formatWeight(photosPayload?.currentWeightKg);
  }
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
  } catch (err) {
    if (seq !== loadSeq) return;
    loadError = err;
    photosPayload = null;
  } finally {
    if (seq === loadSeq) loading = false;
  }
}

function renderProgressPhotosBody() {
  if (!resultsEl) return;
  updateAthleteCard();

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
      updateAthleteCard();
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
