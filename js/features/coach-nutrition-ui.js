/**
 * Coach — Nutrición: pick an athlete, show read-only context card.
 * Markup: #nutrition-view
 * Workspace modes: profile (User.nutrition) | plan (nutritionPlans)
 */
import { getCoachAthleteNutrition } from '../api/users.js';
import { ageFromBirthDate } from '../utils/dates.js';
import { debounce, userProfile } from '../utils/helpers.js';
import { ui } from '../utils/labels.js';
import { formatGoal, formatHeightCm, formatSex, formatWeight } from '../utils/profile-labels.js';
import { createCoachAthletePicker } from './coach-athlete-picker.js';
import { athleteDisplayName } from './coach-athletes-store.js';
import {
  configureCoachNutritionProfileUi,
  hideCoachNutritionProfileStatus,
  initCoachNutritionProfileUi,
  normalizeNutrition,
  resetCoachNutritionProfileTab,
  resetCoachNutritionProfileUi,
  syncCoachNutritionProfileLabels,
  syncCoachNutritionProfileUi,
} from './coach-nutrition-profile-ui.js';
import {
  initCoachNutritionPlanUi,
  resetCoachNutritionPlanUi,
  syncCoachNutritionPlanLabels,
  syncCoachNutritionPlanUi,
} from './coach-nutrition-plan-ui.js';

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 500;

/** @type {any | null} */
let selectedAthlete = null;
/** @type {Record<string, any> | null} */
let nutritionDraft = null;
let profileAthleteId = null;
let nutritionLoadSeq = 0;
let nutritionLoading = false;
let nutritionLoadError = null;
/** @type {'profile' | 'plan'} */
let workspaceMode = 'profile';
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

let searchQuery = '';

function getProfileContext() {
  return {
    profileAthleteId,
    nutritionDraft,
    nutritionLoading,
    nutritionLoadError,
    workspaceMode,
    selectedAthleteId: String(selectedAthlete?.id || ''),
  };
}

const athletePicker = createCoachAthletePicker({
  pageSize: PAGE_SIZE,
  getElements: () => ({
    listEl: listEl || document.getElementById('nutrition-list'),
    loadingEl: loadingEl || document.getElementById('nutrition-loading'),
    emptyEl: emptyEl || document.getElementById('nutrition-empty'),
    loadMoreBtn: loadMoreBtn || document.getElementById('nutrition-load-more'),
    emptyTitleEl:
      emptyTitleEl || document.querySelector('#nutrition-empty .nutrition-empty-title'),
    emptyLeadEl:
      emptyLeadEl || document.querySelector('#nutrition-empty .nutrition-empty-lead'),
    emptyInviteBtn: emptyInviteBtn || document.getElementById('nutrition-empty-invite'),
  }),
  renderRow: createAthleteRow,
  emptyKeys: {
    loadFail: 'nutritionLoadFail',
    empty: { title: 'nutritionEmptyTitle', lead: 'nutritionEmptyLead', invite: true },
    searchEmpty: { title: 'nutritionSearchEmptyTitle', lead: 'nutritionSearchEmptyLead', invite: false },
  },
  search: {
    enabled: true,
    getQuery: () => searchQuery,
  },
});

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

  configureCoachNutritionProfileUi({
    getContext: getProfileContext,
    onDraftSaved: (draft, athleteId) => {
      nutritionDraft = draft;
      profileAthleteId = athleteId;
    },
  });

  searchInput?.addEventListener('input', onSearchInput);
  searchClearBtn?.addEventListener('click', clearSearch);
  loadMoreBtn?.addEventListener('click', () => void athletePicker.loadMore());
  emptyInviteBtn?.addEventListener('click', () => navigateTo('students'));
  document.getElementById('nutrition-back')?.addEventListener('click', changeAthlete);
  document.getElementById('nutrition-profile-retry')?.addEventListener('click', () => {
    if (selectedAthlete) void selectAthlete(selectedAthlete);
  });
  document.querySelectorAll('#nutrition-mode-tabs [data-nutrition-mode]').forEach((btn) => {
    btn.addEventListener('click', () => setWorkspaceMode(btn.dataset.nutritionMode));
  });
  initCoachNutritionProfileUi();
  initCoachNutritionPlanUi();

  syncNutritionLabels();
}

const debouncedNutritionSearch = debounce(() => {
  const next = searchInput?.value.trim() ?? '';
  if (next === searchQuery) return;
  searchQuery = next;
  void athletePicker.reload();
}, SEARCH_DEBOUNCE_MS);

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
  syncCoachNutritionProfileLabels();
  syncCoachNutritionPlanLabels();
  athletePicker.syncLabels();
  if (pickerEl && (athletePicker.hasFetched() || selectedAthlete || athletePicker.isLoading())) render();
}

export async function syncNutritionView() {
  const viewEl = document.getElementById('nutrition-view');
  if (!viewEl || viewEl.hidden) return;

  syncNutritionLabels();
  if (selectedAthlete) {
    render();
    return;
  }
  await athletePicker.ensureLoaded();
}

export function openAthleteNutrition(athlete) {
  if (!athlete?.id) return;
  void selectAthlete(athlete);
}

export function resetCoachNutritionUi() {
  athletePicker.reset();
  searchQuery = '';
  selectedAthlete = null;
  profileAthleteId = null;
  nutritionDraft = null;
  nutritionLoadSeq += 1;
  nutritionLoading = false;
  nutritionLoadError = null;
  workspaceMode = 'profile';
  if (searchInput) searchInput.value = '';
  syncSearchClear();
  resetCoachNutritionProfileUi();
  resetCoachNutritionPlanUi();
}

function onSearchInput() {
  syncSearchClear();
  debouncedNutritionSearch();
}

function clearSearch() {
  if (!searchInput) return;
  searchInput.value = '';
  syncSearchClear();
  if (!searchQuery) return;
  searchQuery = '';
  void athletePicker.reload();
}

function syncSearchClear() {
  searchClearBtn?.classList.toggle('visible', Boolean(searchInput?.value));
}

function changeAthlete() {
  nutritionLoadSeq += 1;
  nutritionLoading = false;
  nutritionLoadError = null;
  nutritionDraft = null;
  selectedAthlete = null;
  profileAthleteId = null;
  workspaceMode = 'profile';
  searchQuery = '';
  if (searchInput) searchInput.value = '';
  syncSearchClear();
  resetCoachNutritionProfileUi();
  resetCoachNutritionProfileTab();
  resetCoachNutritionPlanUi();
  // Show picker / hide workspace before the athletes refetch settles.
  render();
  void athletePicker.reload();
}

async function selectAthlete(athlete) {
  const id = String(athlete?.id || '');
  if (!id) return;

  selectedAthlete = athlete;
  profileAthleteId = null;
  nutritionDraft = null;
  nutritionLoadError = null;
  nutritionLoading = true;
  resetCoachNutritionProfileUi();
  resetCoachNutritionProfileTab();
  workspaceMode = 'profile';
  hideCoachNutritionProfileStatus();
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
    syncCoachNutritionProfileUi();
    syncCoachNutritionPlanUi({
      athleteId: String(selectedAthlete.id || '') || null,
      active: workspaceMode === 'plan',
    });
    return;
  }

  profileAthleteId = null;
  nutritionDraft = null;
  hideCoachNutritionProfileStatus();
  resetCoachNutritionPlanUi();
  syncWorkspaceModeUi();
  athletePicker.render();
}

function syncWorkspaceModeUi() {
  document.querySelectorAll('#nutrition-mode-tabs [data-nutrition-mode]').forEach((btn) => {
    const selected = btn.dataset.nutritionMode === workspaceMode;
    btn.setAttribute('aria-selected', selected ? 'true' : 'false');
    btn.classList.toggle('is-active', selected);
  });
  const profileEl = document.getElementById('nutrition-profile');
  if (profileEl) profileEl.hidden = workspaceMode !== 'profile';
  const highlightsEl = document.getElementById('nutrition-highlights');
  if (highlightsEl) highlightsEl.hidden = workspaceMode === 'plan';
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
