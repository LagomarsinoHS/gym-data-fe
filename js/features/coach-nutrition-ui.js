/**
 * Coach — Nutrición: pick an athlete, show read-only context card.
 * Markup: #nutrition-view
 * Workspace modes: profile (User.nutrition) | plan (nutritionPlans)
 */
import { getCoachAthleteNutrition, getCoachAthletes, putCoachAthleteNutrition } from '../api/users.js';
import { ageFromBirthDate } from '../utils/dates.js';
import { normalizeSearch, userProfile } from '../utils/helpers.js';
import { getLang, ui } from '../utils/labels.js';
import { athleteDisplayName } from './coach-athletes-store.js';
import {
  initCoachNutritionPlanUi,
  resetCoachNutritionPlanUi,
  syncCoachNutritionPlanLabels,
  syncCoachNutritionPlanUi,
} from './coach-nutrition-plan-ui.js';
import { formatHeightCm, formatWeight } from './progress-history-ui.js';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 500;

const PROFILE_FIELDS = [
  ['nutrition-daily-activity', 'dailyActivity'],
  ['nutrition-trainings-week', 'trainingsPerWeek'],
  ['nutrition-duration', 'avgDurationMin'],
  ['nutrition-steps', 'dailySteps'],
  ['nutrition-cardio', 'weeklyCardioMin'],
  ['nutrition-extra-activity', 'extraActivity'],
  ['nutrition-training-time', 'trainingTime'],
  ['nutrition-train-fasted', 'trainFasted'],
  ['nutrition-diet-type', 'dietType'],
  ['nutrition-notes', 'notes'],
];

const DEFAULT_MEAL_NAME_KEYS = [
  'nutritionProfileBreakfast',
  'nutritionProfileLunch',
  'nutritionProfileSnack',
  'nutritionProfileDinner',
];
const MIN_MEALS = 1;
const MAX_MEALS = 8;

const NUTRITION_TABS = ['summary', 'activity', 'habits', 'prefs', 'restrictions'];

const TAG_FIELDS = [
  {
    key: 'likes',
    listId: 'nutrition-likes-list',
    inputId: 'nutrition-likes-input',
    placeholderKey: 'nutritionProfileLikesPh',
    tagClass: 'nutrition-pref-tag',
  },
  {
    key: 'avoids',
    listId: 'nutrition-avoids-list',
    inputId: 'nutrition-avoids-input',
    placeholderKey: 'nutritionProfileAvoidsPh',
    tagClass: 'nutrition-pref-tag',
  },
  {
    key: 'restrictions',
    listId: 'nutrition-restrictions-list',
    inputId: 'nutrition-restrictions-input',
    placeholderKey: 'nutritionProfileAddTagPh',
    tagClass: 'nutrition-pref-tag',
  },
];

/** @type {any[]} */
let athletes = [];
let page = 0;
let pages = 0;
let loading = false;
let loadSeq = 0;
let loadError = null;
let hasFetched = false;
let searchQuery = '';
/** @type {any | null} */
let selectedAthlete = null;
/** @type {Record<string, any> | null} */
let nutritionDraft = null;
let profileAthleteId = null;
let nutritionLoadSeq = 0;
let nutritionLoading = false;
let nutritionLoadError = null;
let nutritionSaving = false;
let nutritionJustSaved = false;
let nutritionSavedTimer = 0;
let profileFormSyncedId = null;
let nutritionTab = 'summary';
/** @type {'profile' | 'plan'} */
let workspaceMode = 'profile';
let searchTimer = 0;
/** @type {(view: string) => void} */
let navigateTo = () => {};

let searchInput;
let searchClearBtn;
let pickerEl;
let loadingEl;
let emptyEl;
let emptyTitleEl;
let emptyLeadEl;
let emptyInviteBtn;
let listEl;
let loadMoreBtn;
let workspaceEl;
let headerEl;
let cardNameEl;
let cardMetaEl;
let cardGoalEl;
let cardSexEl;

export function initCoachNutritionUi({ navigateTo: nav } = {}) {
  if (typeof nav === 'function') navigateTo = nav;

  searchInput = document.getElementById('nutrition-search');
  searchClearBtn = document.getElementById('nutrition-search-clear');
  pickerEl = document.getElementById('nutrition-picker');
  loadingEl = document.getElementById('nutrition-loading');
  emptyEl = document.getElementById('nutrition-empty');
  emptyTitleEl = emptyEl?.querySelector('.nutrition-empty-title');
  emptyLeadEl = emptyEl?.querySelector('.nutrition-empty-lead');
  emptyInviteBtn = document.getElementById('nutrition-empty-invite');
  listEl = document.getElementById('nutrition-list');
  loadMoreBtn = document.getElementById('nutrition-load-more');
  workspaceEl = document.getElementById('nutrition-workspace');
  headerEl = document.getElementById('nutrition-header');
  cardNameEl = document.getElementById('nutrition-athlete-name');
  cardMetaEl = document.getElementById('nutrition-athlete-meta');
  cardGoalEl = document.getElementById('nutrition-athlete-goal');
  cardSexEl = document.getElementById('nutrition-athlete-sex');

  searchInput?.addEventListener('input', onSearchInput);
  searchClearBtn?.addEventListener('click', clearSearch);
  loadMoreBtn?.addEventListener('click', () => void loadMore());
  emptyInviteBtn?.addEventListener('click', () => navigateTo('students'));
  document.getElementById('nutrition-back')?.addEventListener('click', changeAthlete);
  document.getElementById('nutrition-profile-retry')?.addEventListener('click', () => {
    if (selectedAthlete) void selectAthlete(selectedAthlete);
  });
  document.querySelectorAll('#nutrition-mode-tabs [data-nutrition-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setWorkspaceMode(btn.dataset.nutritionMode));
  });
  initNutritionProfileForm();
  initCoachNutritionPlanUi();

  syncNutritionLabels();
}

export function syncNutritionLabels() {
  document.querySelectorAll('#nutrition-view [data-ui]').forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });
  const profileSection = document.getElementById('nutrition-profile');
  if (profileSection) profileSection.setAttribute('aria-label', ui('nutritionProfileTitle'));
  const tabsNav = document.querySelector('#nutrition-profile-form .nutrition-profile-tabs');
  if (tabsNav) tabsNav.setAttribute('aria-label', ui('nutritionTabList'));
  const modeNav = document.getElementById('nutrition-mode-tabs');
  if (modeNav) modeNav.setAttribute('aria-label', ui('nutritionModeList'));
  if (searchInput) searchInput.placeholder = ui('nutritionSearch');
  if (searchClearBtn) searchClearBtn.setAttribute('aria-label', ui('nutritionSearchClear'));
  const extraActivity = document.getElementById('nutrition-extra-activity');
  if (extraActivity) extraActivity.placeholder = ui('nutritionProfileExtraActivityPh');
  const notes = document.getElementById('nutrition-notes');
  if (notes) notes.placeholder = ui('nutritionProfileNotesPh');
  TAG_FIELDS.forEach(({ inputId, placeholderKey }) => {
    const input = document.getElementById(inputId);
    if (input) input.placeholder = ui(placeholderKey || 'nutritionProfileAddTagPh');
  });
  if (profileAthleteId && nutritionDraft) {
    renderAllTagLists(nutritionDraft);
    renderMeals(nutritionDraft);
    renderNutritionSummary(nutritionDraft);
    renderNutritionHighlights(nutritionDraft);
    syncNutritionTabUi();
  }
  syncSaveLabel();
  syncSearchClear();
  syncCoachNutritionPlanLabels();
  if (pickerEl && (hasFetched || selectedAthlete || loading)) render();
}

export async function syncNutritionView() {
  const viewEl = document.getElementById('nutrition-view');
  if (!viewEl || viewEl.hidden) return;

  syncNutritionLabels();
  if (selectedAthlete) {
    render();
    return;
  }
  if (!hasFetched && !loading) {
    await reload();
  } else {
    render();
  }
}

export function openAthleteNutrition(athlete) {
  if (!athlete?.id) return;
  void selectAthlete(athlete);
}

export function resetCoachNutritionUi() {
  window.clearTimeout(searchTimer);
  searchTimer = 0;
  athletes = [];
  page = 0;
  pages = 0;
  loading = false;
  loadSeq += 1;
  loadError = null;
  hasFetched = false;
  searchQuery = '';
  selectedAthlete = null;
  profileAthleteId = null;
  nutritionDraft = null;
  nutritionLoadSeq += 1;
  nutritionLoading = false;
  nutritionLoadError = null;
  nutritionSaving = false;
  clearNutritionSavedFlash();
  profileFormSyncedId = null;
  nutritionTab = 'summary';
  workspaceMode = 'profile';
  if (searchInput) searchInput.value = '';
  syncSearchClear();
  resetCoachNutritionPlanUi();
}

function onSearchInput() {
  syncSearchClear();
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    const next = searchInput?.value.trim() ?? '';
    if (next === searchQuery) return;
    searchQuery = next;
    void reload();
  }, SEARCH_DEBOUNCE_MS);
}

function clearSearch() {
  if (!searchInput) return;
  searchInput.value = '';
  syncSearchClear();
  if (!searchQuery) return;
  searchQuery = '';
  void reload();
}

function syncSearchClear() {
  searchClearBtn?.classList.toggle('visible', Boolean(searchInput?.value));
}

function changeAthlete() {
  nutritionLoadSeq += 1;
  nutritionLoading = false;
  nutritionLoadError = null;
  nutritionSaving = false;
  clearNutritionSavedFlash();
  nutritionDraft = null;
  selectedAthlete = null;
  profileAthleteId = null;
  profileFormSyncedId = null;
  nutritionTab = 'summary';
  workspaceMode = 'profile';
  searchQuery = '';
  if (searchInput) searchInput.value = '';
  syncSearchClear();
  resetCoachNutritionPlanUi();
  void reload();
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
      search: searchQuery || undefined,
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
    if (seq === loadSeq) {
      loading = false;
      hasFetched = true;
    }
    render();
  }
}

async function selectAthlete(athlete) {
  const id = String(athlete?.id || '');
  if (!id) return;

  selectedAthlete = athlete;
  profileAthleteId = null;
  nutritionDraft = null;
  nutritionLoadError = null;
  nutritionSaving = false;
  clearNutritionSavedFlash();
  nutritionLoading = true;
  profileFormSyncedId = null;
  nutritionTab = 'summary';
  workspaceMode = 'profile';
  hideProfileStatus();
  const seq = ++nutritionLoadSeq;
  render();

  try {
    const data = await getCoachAthleteNutrition(id);
    if (seq !== nutritionLoadSeq) return;
    nutritionDraft = normalizeNutrition(data);
    profileAthleteId = id;
  } catch (err) {
    if (seq !== nutritionLoadSeq) return;
    nutritionLoadError = err;
  } finally {
    if (seq === nutritionLoadSeq) nutritionLoading = false;
    render();
  }
}

function setWorkspaceMode(mode) {
  const next = mode === 'plan' ? 'plan' : 'profile';
  if (workspaceMode === next) return;
  workspaceMode = next;
  render();
}

function render() {
  if (!pickerEl || !workspaceEl) return;

  const hasSelection = Boolean(selectedAthlete);
  pickerEl.hidden = hasSelection;
  workspaceEl.hidden = !hasSelection;
  if (headerEl) headerEl.hidden = hasSelection;

  if (hasSelection) {
    fillAthleteCard(selectedAthlete);
    syncWorkspaceModeUi();
    syncNutritionProfileUi();
    syncCoachNutritionPlanUi({
      athleteId: String(selectedAthlete.id || '') || null,
      active: workspaceMode === 'plan',
    });
    return;
  }

  profileAthleteId = null;
  nutritionDraft = null;
  hideProfileStatus();
  resetCoachNutritionPlanUi();
  syncWorkspaceModeUi();

  const bootLoading = loading && athletes.length === 0;
  if (loadingEl) loadingEl.hidden = !bootLoading;

  if (bootLoading) {
    if (emptyEl) emptyEl.hidden = true;
    if (listEl) listEl.hidden = true;
    if (loadMoreBtn) loadMoreBtn.hidden = true;
    return;
  }

  if (loadError && athletes.length === 0) {
    showEmpty(ui('nutritionLoadFail'), '', { invite: false });
    if (listEl) listEl.hidden = true;
    if (loadMoreBtn) loadMoreBtn.hidden = true;
    return;
  }

  if (athletes.length === 0) {
    const searching = Boolean(searchQuery);
    showEmpty(
      ui(searching ? 'nutritionSearchEmptyTitle' : 'nutritionEmptyTitle'),
      ui(searching ? 'nutritionSearchEmptyLead' : 'nutritionEmptyLead'),
      { invite: !searching },
    );
    if (listEl) listEl.hidden = true;
    if (loadMoreBtn) loadMoreBtn.hidden = true;
    return;
  }

  if (emptyEl) emptyEl.hidden = true;
  if (listEl) {
    listEl.hidden = false;
    listEl.replaceChildren(...athletes.map(createAthleteRow));
  }
  if (loadMoreBtn) {
    const hasMore = pages > 0 ? page < pages : false;
    loadMoreBtn.hidden = !hasMore;
    loadMoreBtn.disabled = loading;
  }
}

function showEmpty(title, lead, { invite }) {
  if (!emptyEl) return;
  emptyEl.hidden = false;
  if (emptyTitleEl) emptyTitleEl.textContent = title;
  if (emptyLeadEl) emptyLeadEl.textContent = lead;
  if (emptyInviteBtn) emptyInviteBtn.hidden = !invite;
}

function defaultMeals() {
  return DEFAULT_MEAL_NAME_KEYS.map(nameKey => ({ nameKey, name: '', time: '' }));
}

function normalizeNutrition(data) {
  const meals = Array.isArray(data?.meals) ? data.meals : [];
  return {
    dailyActivity: data?.dailyActivity ?? '',
    trainingsPerWeek: data?.trainingsPerWeek ?? '',
    avgDurationMin: data?.avgDurationMin ?? '',
    dailySteps: data?.dailySteps ?? '',
    weeklyCardioMin: data?.weeklyCardioMin ?? '',
    extraActivity: data?.extraActivity ?? '',
    trainingTime: data?.trainingTime ?? '',
    trainFasted: data?.trainFasted ?? '',
    meals: meals.length
      ? meals.map(meal => ({
          name: meal?.name || '',
          time: meal?.time || '',
          nameKey: null,
        }))
      : defaultMeals(),
    likes: Array.isArray(data?.likes) ? [...data.likes] : [],
    avoids: Array.isArray(data?.avoids) ? [...data.avoids] : [],
    dietType: data?.dietType ?? '',
    restrictions: Array.isArray(data?.restrictions) ? [...data.restrictions] : [],
    notes: data?.notes ?? '',
  };
}

function toNullableNumber(value) {
  if (value === '' || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function buildNutritionPayload(profile) {
  const meals = (profile.meals || [])
    .map((meal, index) => ({
      name: String(meal.name || mealDisplayName(meal, index)).trim(),
      time: String(meal.time || '').trim() || null,
    }))
    .filter(meal => meal.name);

  return {
    dailyActivity: profile.dailyActivity || null,
    trainingsPerWeek: toNullableNumber(profile.trainingsPerWeek),
    avgDurationMin: toNullableNumber(profile.avgDurationMin),
    dailySteps: toNullableNumber(profile.dailySteps),
    weeklyCardioMin: toNullableNumber(profile.weeklyCardioMin),
    extraActivity: String(profile.extraActivity || '').trim() || null,
    trainingTime: profile.trainingTime || null,
    trainFasted: profile.trainFasted || null,
    meals,
    likes: profile.likes || [],
    avoids: profile.avoids || [],
    dietType: profile.dietType || null,
    restrictions: profile.restrictions || [],
    notes: String(profile.notes || '').trim() || null,
  };
}

function initNutritionProfileForm() {
  const form = document.getElementById('nutrition-profile-form');
  form?.addEventListener('submit', e => e.preventDefault());

  PROFILE_FIELDS.forEach(([elId, key]) => {
    document.getElementById(elId)?.addEventListener('input', () => {
      if (!profileAthleteId || !nutritionDraft) return;
      const el = document.getElementById(elId);
      if (!el) return;
      nutritionDraft[key] = el.type === 'number'
        ? (el.value === '' ? '' : Number(el.value))
        : el.value;
      renderNutritionHighlights(nutritionDraft);
      hideProfileStatus();
    });
  });

  TAG_FIELDS.forEach(field => {
    if (field.addId) {
      document.getElementById(field.addId)?.addEventListener('click', () => addTag(field));
    }
    const input = document.getElementById(field.inputId);
    const list = document.getElementById(field.listId);
    input?.addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        e.preventDefault();
        addTag(field);
        return;
      }
      if (e.key !== 'Backspace' || String(input.value || '')) return;
      if (!profileAthleteId || !nutritionDraft) return;
      const tags = Array.isArray(nutritionDraft[field.key]) ? nutritionDraft[field.key] : [];
      if (!tags.length) return;
      e.preventDefault();
      nutritionDraft[field.key] = tags.slice(0, -1);
      renderTagList(field, nutritionDraft[field.key]);
      hideProfileStatus();
      input.focus();
    });
    list?.addEventListener('click', e => {
      if (e.target.closest('.nutrition-tag-remove')) return;
      input?.focus();
    });
  });

  document.getElementById('nutrition-profile-save')?.addEventListener('click', () => {
    void saveNutritionProfile();
  });

  document.querySelectorAll('#nutrition-profile-form [data-nutrition-tab]').forEach(btn => {
    btn.addEventListener('click', () => setNutritionTab(btn.dataset.nutritionTab));
  });
  document.querySelectorAll('#nutrition-summary [data-open-tab]').forEach(card => {
    card.addEventListener('click', () => setNutritionTab(card.dataset.openTab));
  });
  document.addEventListener('keydown', onNutritionEscape);
}

function syncWorkspaceModeUi() {
  document.querySelectorAll('#nutrition-mode-tabs [data-nutrition-mode]').forEach((btn) => {
    const selected = btn.dataset.nutritionMode === workspaceMode;
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    btn.classList.toggle('is-active', selected);
  });
  const profileEl = document.getElementById('nutrition-profile');
  if (profileEl) profileEl.hidden = workspaceMode !== 'profile';
}

function syncNutritionProfileUi() {
  const profileLoadingEl = document.getElementById('nutrition-profile-loading');
  const errorEl = document.getElementById('nutrition-profile-load-error');
  const form = document.getElementById('nutrition-profile-form');
  const saveBtn = document.getElementById('nutrition-profile-save');

  if (workspaceMode !== 'profile') {
    if (profileLoadingEl) profileLoadingEl.hidden = true;
    if (errorEl) errorEl.hidden = true;
    if (form) form.hidden = true;
    return;
  }

  const showForm = Boolean(profileAthleteId && nutritionDraft && !nutritionLoading && !nutritionLoadError);
  if (profileLoadingEl) profileLoadingEl.hidden = !nutritionLoading;
  if (errorEl) errorEl.hidden = !nutritionLoadError || nutritionLoading;
  if (form) form.hidden = !showForm;
  if (saveBtn) saveBtn.disabled = nutritionSaving || !showForm;
  syncSaveLabel();

  if (showForm && profileFormSyncedId !== profileAthleteId) {
    applyProfileToForm(nutritionDraft);
    profileFormSyncedId = profileAthleteId;
  }
  if (showForm) syncNutritionTabUi();
}

function syncSaveLabel() {
  const label = document.getElementById('nutrition-profile-save-label');
  const saveBtn = document.getElementById('nutrition-profile-save');
  if (!label) return;
  if (nutritionJustSaved) {
    label.textContent = ui('nutritionProfileSaved');
    saveBtn?.classList.add('is-saved');
    return;
  }
  saveBtn?.classList.remove('is-saved');
  label.textContent = ui(nutritionSaving ? 'nutritionProfileSaving' : 'nutritionProfileSave');
}

function clearNutritionSavedFlash() {
  window.clearTimeout(nutritionSavedTimer);
  nutritionSavedTimer = 0;
  nutritionJustSaved = false;
  document.getElementById('nutrition-profile-save')?.classList.remove('is-saved');
}

function flashNutritionSaved() {
  window.clearTimeout(nutritionSavedTimer);
  nutritionJustSaved = true;
  syncSaveLabel();
  nutritionSavedTimer = window.setTimeout(() => {
    nutritionJustSaved = false;
    nutritionSavedTimer = 0;
    syncSaveLabel();
  }, 1500);
}

function applyProfileToForm(profile) {
  PROFILE_FIELDS.forEach(([elId, key]) => {
    const el = document.getElementById(elId);
    if (!el) return;
    el.value = profile[key] == null ? '' : String(profile[key]);
  });
  renderMeals(profile);
  renderAllTagLists(profile);
  renderNutritionSummary(profile);
  renderNutritionHighlights(profile);
}

function setNutritionTab(tab) {
  nutritionTab = NUTRITION_TABS.includes(tab) ? tab : 'summary';
  syncNutritionTabUi();
}

function isNutritionEditOpen() {
  const view = document.getElementById('nutrition-view');
  const workspace = document.getElementById('nutrition-workspace');
  return Boolean(
    view && !view.hidden
    && workspace && !workspace.hidden
    && nutritionDraft
    && !nutritionLoading
    && nutritionTab !== 'summary',
  );
}

function onNutritionEscape(e) {
  if (e.key !== 'Escape' || e.defaultPrevented) return;
  if (!isNutritionEditOpen()) return;
  if (document.body.classList.contains('nav-drawer-open')) return;
  if (document.getElementById('modal-overlay')?.classList.contains('open')) return;
  e.preventDefault();
  setNutritionTab('summary');
}

function syncNutritionTabUi() {
  const isSummary = nutritionTab === 'summary';
  document.querySelectorAll('#nutrition-profile-form [data-nutrition-tab]').forEach(btn => {
    btn.setAttribute('aria-selected', btn.dataset.nutritionTab === nutritionTab ? 'true' : 'false');
  });
  const summary = document.getElementById('nutrition-summary');
  if (summary) summary.hidden = !isSummary;
  document.querySelectorAll('#nutrition-profile-form [data-nutrition-panel]').forEach(panel => {
    panel.hidden = isSummary || panel.dataset.nutritionPanel !== nutritionTab;
  });
  if (isSummary && nutritionDraft) renderNutritionSummary(nutritionDraft);
}

function summaryFact(label, value) {
  const row = document.createElement('div');
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  dd.textContent = value || '—';
  row.append(dt, dd);
  return row;
}

function summaryTags(container, tags) {
  if (!container) return;
  const items = Array.isArray(tags) ? tags.filter(Boolean) : [];
  if (items.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'nutrition-summary-empty';
    empty.textContent = '—';
    container.replaceChildren(empty);
    return;
  }
  container.replaceChildren(
    ...items.map(tag => {
      const pill = document.createElement('span');
      pill.className = 'nutrition-summary-tag';
      pill.textContent = tag;
      return pill;
    }),
  );
}

function formatSummaryNumber(value, unitKey) {
  if (value === '' || value == null) return '—';
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return unitKey ? `${n} ${ui(unitKey)}` : String(n);
}

function formatTimeDisplay(value) {
  const raw = String(value || '').trim();
  if (!raw) return '—';
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const date = new Date(1970, 0, 1, Number(match[1]), Number(match[2]));
  return date.toLocaleTimeString(getLang() === 'es' ? 'es-CL' : 'en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDailyActivity(value) {
  switch (String(value || '')) {
    case 'sedentary':
      return ui('nutritionActivitySedentary');
    case 'standing':
      return ui('nutritionActivityStanding');
    case 'active':
      return ui('nutritionActivityActive');
    case 'demanding':
      return ui('nutritionActivityDemanding');
    default:
      return '';
  }
}

function formatDietType(value) {
  switch (String(value || '')) {
    case 'none':
      return ui('nutritionDietNone');
    case 'vegetarian':
      return ui('nutritionDietVegetarian');
    case 'vegan':
      return ui('nutritionDietVegan');
    case 'other':
      return ui('nutritionDietOther');
    default:
      return '';
  }
}

function setHighlightValue(id, value, { fasted } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = value || '—';
  el.classList.toggle('is-fasted', Boolean(fasted));
}

function renderNutritionHighlights(profile) {
  const data = profile || {};
  const fasted = String(data.trainFasted || '');
  setHighlightValue('nutrition-highlight-activity', formatDailyActivity(data.dailyActivity) || '—');
  setHighlightValue('nutrition-highlight-trainings', formatSummaryNumber(data.trainingsPerWeek));
  setHighlightValue(
    'nutrition-highlight-duration',
    formatSummaryNumber(data.avgDurationMin, 'nutritionProfileDurationUnit'),
  );
  setHighlightValue('nutrition-highlight-steps', formatSummaryNumber(data.dailySteps));
  setHighlightValue('nutrition-highlight-training', formatTimeDisplay(data.trainingTime));
  setHighlightValue(
    'nutrition-highlight-fasted',
    fasted === 'fasted'
      ? ui('nutritionProfileTrainFastedYes')
      : fasted === 'after_meal'
        ? ui('nutritionProfileTrainAfterMeal')
        : '—',
    { fasted: fasted === 'fasted' },
  );
}

function renderNutritionSummary(profile) {
  const activityEl = document.getElementById('nutrition-summary-activity');
  if (activityEl) {
    activityEl.replaceChildren(
      summaryFact(ui('nutritionSummaryActivity'), formatDailyActivity(profile.dailyActivity) || '—'),
      summaryFact(ui('nutritionProfileTrainingsWeek'), formatSummaryNumber(profile.trainingsPerWeek)),
      summaryFact(ui('nutritionProfileDuration'), formatSummaryNumber(profile.avgDurationMin, 'nutritionProfileDurationUnit')),
      summaryFact(ui('nutritionProfileSteps'), formatSummaryNumber(profile.dailySteps)),
      summaryFact(ui('nutritionProfileCardio'), formatSummaryNumber(profile.weeklyCardioMin, 'nutritionProfileCardioUnit')),
      summaryFact(ui('nutritionProfileExtraActivity'), String(profile.extraActivity || '').trim() || '—'),
    );
  }

  const habitsEl = document.getElementById('nutrition-summary-habits');
  if (habitsEl) {
    const meals = Array.isArray(profile.meals) ? profile.meals : [];
    habitsEl.replaceChildren(
      ...meals.map((meal, index) =>
        summaryFact(mealDisplayName(meal, index), formatTimeDisplay(meal.time)),
      ),
    );
  }

  const fastedEl = document.getElementById('nutrition-summary-fasted');
  if (fastedEl) {
    const fasted = String(profile.trainFasted || '');
    if (!fasted) {
      fastedEl.hidden = true;
      fastedEl.textContent = '';
      fastedEl.classList.remove('is-fasted', 'is-after-meal');
    } else {
      fastedEl.hidden = false;
      fastedEl.textContent = fasted === 'fasted'
        ? ui('nutritionSummaryTrainsFasted')
        : ui('nutritionSummaryTrainsAfterMeal');
      fastedEl.classList.toggle('is-fasted', fasted === 'fasted');
      fastedEl.classList.toggle('is-after-meal', fasted === 'after_meal');
    }
  }

  const likes = Array.isArray(profile.likes) ? profile.likes.filter(Boolean) : [];
  const avoids = Array.isArray(profile.avoids) ? profile.avoids.filter(Boolean) : [];
  const hasPrefs = likes.length > 0 || avoids.length > 0;
  const prefsEmpty = document.getElementById('nutrition-summary-prefs-empty');
  const prefsCols = document.getElementById('nutrition-summary-prefs-cols');
  if (prefsEmpty) {
    prefsEmpty.hidden = hasPrefs;
    prefsEmpty.textContent = ui('nutritionPrefsSummaryEmpty');
  }
  if (prefsCols) prefsCols.hidden = !hasPrefs;
  if (hasPrefs) {
    summaryTags(document.getElementById('nutrition-summary-likes'), likes);
    summaryTags(document.getElementById('nutrition-summary-avoids'), avoids);
  }
  summaryTags(document.getElementById('nutrition-summary-restrictions'), profile.restrictions);

  const dietEl = document.getElementById('nutrition-summary-diet');
  if (dietEl) {
    const diet = formatDietType(profile.dietType);
    if (!diet) {
      dietEl.hidden = true;
      dietEl.textContent = '';
    } else {
      dietEl.hidden = false;
      dietEl.textContent = diet;
    }
  }

  const notesEl = document.getElementById('nutrition-summary-notes');
  if (notesEl) {
    const notes = String(profile.notes || '').trim();
    notesEl.hidden = !notes;
    notesEl.textContent = notes;
  }
}

function addMeal() {
  if (!profileAthleteId || !nutritionDraft) return;
  const profile = nutritionDraft;
  if (!Array.isArray(profile.meals)) profile.meals = [];
  if (profile.meals.length >= MAX_MEALS) return;
  const index = profile.meals.length;
  profile.meals.push({
    nameKey: DEFAULT_MEAL_NAME_KEYS[index] || null,
    time: '',
  });
  renderMeals(profile);
  renderNutritionHighlights(profile);
  hideProfileStatus();
}

function removeMeal(index) {
  if (!profileAthleteId || !nutritionDraft) return;
  const profile = nutritionDraft;
  if (!Array.isArray(profile.meals) || profile.meals.length <= MIN_MEALS) return;
  profile.meals.splice(index, 1);
  renderMeals(profile);
  hideProfileStatus();
}

function mealDisplayName(meal, index) {
  const custom = String(meal?.name || '').trim();
  if (custom) return custom;
  if (meal?.nameKey) return ui(meal.nameKey);
  return ui('nutritionProfileMealN', index + 1);
}

function renderMeals(profile) {
  const list = document.getElementById('nutrition-meals-list');
  if (!list) return;
  const meals = Array.isArray(profile.meals) ? profile.meals : [];
  const canRemove = meals.length > MIN_MEALS;

  const mealEls = meals.map((meal, index) => {
    const field = document.createElement('div');
    field.className = 'nutrition-profile-field nutrition-meal-card';

    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.className = 'nutrition-meal-name';
    nameInput.value = mealDisplayName(meal, index);
    nameInput.placeholder = ui('nutritionProfileMealNamePh');
    nameInput.autocomplete = 'off';
    nameInput.addEventListener('input', () => {
      meal.name = nameInput.value;
      meal.nameKey = null;
      hideProfileStatus();
    });

    if (canRemove) {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'nutrition-meal-remove';
      removeBtn.setAttribute('aria-label', ui('nutritionProfileRemoveMeal'));
      removeBtn.textContent = '×';
      removeBtn.addEventListener('click', () => removeMeal(index));
      field.append(removeBtn);
    }

    const timeLabel = document.createElement('span');
    timeLabel.className = 'nutrition-profile-label';
    timeLabel.textContent = ui('nutritionProfileMealTime');

    const timeInput = document.createElement('input');
    timeInput.type = 'time';
    timeInput.className = 'nutrition-meal-time';
    timeInput.value = meal.time || '';
    timeInput.addEventListener('input', () => {
      meal.time = timeInput.value;
      hideProfileStatus();
    });

    field.append(nameInput, timeLabel, timeInput);
    return field;
  });

  if (meals.length < MAX_MEALS) {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'nutrition-meal-add';
    addBtn.setAttribute('aria-label', ui('nutritionProfileAddMeal'));
    addBtn.textContent = '+';
    addBtn.addEventListener('click', addMeal);
    mealEls.push(addBtn);
  }

  list.replaceChildren(...mealEls);
}

function renderAllTagLists(profile) {
  TAG_FIELDS.forEach(field => renderTagList(field, profile[field.key] || []));
}

function renderTagList(field, tags) {
  const list = document.getElementById(field.listId);
  if (!list) return;
  const input = document.getElementById(field.inputId);
  const items = Array.isArray(tags) ? tags : [];
  const chips = items.map((tag, index) => {
    const chip = document.createElement('span');
    chip.className = field.tagClass || 'nutrition-tag';
    chip.textContent = tag;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'nutrition-tag-remove';
    remove.setAttribute('aria-label', `${ui('nutritionProfileRemoveTag')} ${tag}`);
    remove.textContent = '×';
    remove.addEventListener('click', () => {
      if (!profileAthleteId || !nutritionDraft) return;
      const profile = nutritionDraft;
      profile[field.key] = (profile[field.key] || []).filter((_, i) => i !== index);
      renderTagList(field, profile[field.key]);
      hideProfileStatus();
      document.getElementById(field.inputId)?.focus();
    });

    chip.append(remove);
    return chip;
  });
  list.replaceChildren(...chips);
  if (input) {
    input.placeholder = items.length ? '' : ui(field.placeholderKey || 'nutritionProfileAddTagPh');
    list.append(input);
  }
}

function formatFoodTag(text) {
  const normalized = normalizeSearch(text).replace(/\s+/g, ' ');
  if (!normalized) return '';
  return normalized.replace(/(^|\s)\S/g, ch => ch.toUpperCase());
}

function addTag(field) {
  const input = document.getElementById(field.inputId);
  const value = formatFoodTag(input?.value);
  if (!value || !profileAthleteId || !nutritionDraft) return;
  const profile = nutritionDraft;
  const list = Array.isArray(profile[field.key]) ? profile[field.key] : [];
  const exists = list.some(item => normalizeSearch(item) === normalizeSearch(value));
  if (!exists) {
    profile[field.key] = [...list, value];
    renderTagList(field, profile[field.key]);
  }
  if (input) {
    input.value = '';
    input.focus();
  }
  hideProfileStatus();
}

async function saveNutritionProfile() {
  const athleteId = String(selectedAthlete?.id || '');
  if (!athleteId || !nutritionDraft || nutritionSaving) return;

  nutritionSaving = true;
  hideProfileStatus();
  syncNutritionProfileUi();

  try {
    const saved = await putCoachAthleteNutrition(athleteId, buildNutritionPayload(nutritionDraft));
    if (String(selectedAthlete?.id || '') !== athleteId) return;
    nutritionDraft = normalizeNutrition(saved);
    profileFormSyncedId = null;
    applyProfileToForm(nutritionDraft);
    profileFormSyncedId = athleteId;
    hideProfileStatus();
    setNutritionTab('summary');
    flashNutritionSaved();
  } catch {
    if (String(selectedAthlete?.id || '') !== athleteId) return;
    showProfileStatus(ui('nutritionProfileSaveFail'), true);
  } finally {
    nutritionSaving = false;
    if (!nutritionJustSaved) syncSaveLabel();
    const saveBtn = document.getElementById('nutrition-profile-save');
    if (saveBtn) saveBtn.disabled = !nutritionDraft || Boolean(nutritionLoadError);
  }
}

function showProfileStatus(message, isError = false) {
  const status = document.getElementById('nutrition-profile-status');
  if (!status) return;
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle('is-error', Boolean(isError));
}

function hideProfileStatus() {
  const status = document.getElementById('nutrition-profile-status');
  if (!status) return;
  status.hidden = true;
  status.textContent = '';
  status.classList.remove('is-error');
}

function fillAthleteCard(athlete) {
  const profile = userProfile(athlete);
  if (cardNameEl) cardNameEl.textContent = athleteDisplayName(athlete);

  const age = ageFromBirthDate(profile.birthDate);
  const weightText = formatWeight(athlete?.currentWeightKg);
  const parts = [
    age != null ? ui('nutritionAgeYears', age) : '',
    weightText !== '—' ? weightText : '',
    formatHeightCm(profile.heightCm) || '',
  ].filter(Boolean);
  if (cardMetaEl) {
    if (!parts.length) {
      cardMetaEl.textContent = '—';
    } else {
      cardMetaEl.replaceChildren(
        ...parts.flatMap((part, index) => {
          const nodes = [];
          if (index) {
            const dot = document.createElement('span');
            dot.className = 'nutrition-athlete-meta-dot';
            dot.setAttribute('aria-hidden', 'true');
            nodes.push(dot);
          }
          const value = document.createElement('strong');
          value.textContent = part;
          nodes.push(value);
          return nodes;
        }),
      );
    }
  }
  if (cardGoalEl) cardGoalEl.textContent = formatGoal(athlete?.goal) || '—';
  if (cardSexEl) cardSexEl.textContent = formatSex(profile.sex) || '—';
}

function createAthleteRow(athlete) {
  const id = String(athlete?.id || '');
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'nutrition-athlete-btn';
  btn.addEventListener('click', () => void selectAthlete(athlete));
  if (!id) btn.disabled = true;

  const name = document.createElement('span');
  name.className = 'nutrition-athlete-btn-name';
  name.textContent = athleteDisplayName(athlete);

  const email = document.createElement('span');
  email.className = 'nutrition-athlete-btn-email';
  email.textContent = String(athlete?.email || '').trim() || '—';

  const chevron = document.createElement('span');
  chevron.className = 'nutrition-athlete-btn-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  chevron.textContent = '›';

  btn.append(name, email, chevron);
  return btn;
}

function formatSex(sex) {
  switch (String(sex || '')) {
    case 'male':
      return ui('profileSexMale');
    case 'female':
      return ui('profileSexFemale');
    case 'other':
      return ui('profileSexOther');
    case 'prefer_not_to_say':
      return ui('profileSexPreferNot');
    default:
      return '';
  }
}

function formatGoal(goal) {
  switch (String(goal || '')) {
    case 'strength':
      return ui('profileGoalStrength');
    case 'hypertrophy':
      return ui('profileGoalHypertrophy');
    case 'fat_loss':
      return ui('profileGoalFatLoss');
    case 'general':
      return ui('profileGoalGeneral');
    default:
      return '';
  }
}
