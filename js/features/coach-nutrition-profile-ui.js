/**
 * Coach — Nutrición: athlete profile form (tabs, tags, meals, summary, save).
 * Markup: #nutrition-profile, #nutrition-profile-form
 * Parent: coach-nutrition-ui.js (picker, workspace modes, athlete card).
 */
import { putCoachAthleteNutrition } from '../api/users.js';
import { getLang, ui } from '../utils/labels.js';

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

let profileFormSyncedId = null;
let nutritionTab = 'summary';
let nutritionSaving = false;
let nutritionJustSaved = false;
let nutritionSavedTimer = 0;

/** @type {() => { profileAthleteId: string|null, nutritionDraft: Record<string, unknown>|null, nutritionLoading: boolean, nutritionLoadError: unknown, workspaceMode: 'profile'|'plan', selectedAthleteId: string }} */
let getContext = () => ({
  profileAthleteId: null,
  nutritionDraft: null,
  nutritionLoading: false,
  nutritionLoadError: null,
  workspaceMode: 'profile',
  selectedAthleteId: '',
});

/** @type {(draft: Record<string, unknown>) => void} */
let onDraftSaved = () => {};

export function configureCoachNutritionProfileUi({ getContext: ctx, onDraftSaved: saved }) {
  if (typeof ctx === 'function') getContext = ctx;
  if (typeof saved === 'function') onDraftSaved = saved;
}

export function initCoachNutritionProfileUi() {
  const form = document.getElementById('nutrition-profile-form');
  form?.addEventListener('submit', e => e.preventDefault());

  PROFILE_FIELDS.forEach(([elId, key]) => {
    document.getElementById(elId)?.addEventListener('input', () => {
      const { profileAthleteId, nutritionDraft } = getContext();
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
      const { profileAthleteId, nutritionDraft } = getContext();
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

export function resetCoachNutritionProfileUi() {
  nutritionSaving = false;
  clearNutritionSavedFlash();
  profileFormSyncedId = null;
  nutritionTab = 'summary';
  hideProfileStatus();
}

export function syncCoachNutritionProfileLabels() {
  const extraActivity = document.getElementById('nutrition-extra-activity');
  if (extraActivity) extraActivity.placeholder = ui('nutritionProfileExtraActivityPh');
  const notes = document.getElementById('nutrition-notes');
  if (notes) notes.placeholder = ui('nutritionProfileNotesPh');
  TAG_FIELDS.forEach(({ inputId, placeholderKey }) => {
    const input = document.getElementById(inputId);
    if (input) input.placeholder = ui(placeholderKey || 'nutritionProfileAddTagPh');
  });

  const { profileAthleteId, nutritionDraft } = getContext();
  if (profileAthleteId && nutritionDraft) {
    renderAllTagLists(nutritionDraft);
    renderMeals(nutritionDraft);
    renderNutritionSummary(nutritionDraft);
    renderNutritionHighlights(nutritionDraft);
    syncNutritionTabUi();
  }
  syncSaveLabel();
}

export function syncCoachNutritionProfileUi() {
  const {
    profileAthleteId,
    nutritionDraft,
    nutritionLoading,
    nutritionLoadError,
    workspaceMode,
  } = getContext();

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

export function normalizeNutrition(data) {
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

export function hideCoachNutritionProfileStatus() {
  hideProfileStatus();
}

export function resetCoachNutritionProfileTab() {
  nutritionTab = 'summary';
}

function defaultMeals() {
  return DEFAULT_MEAL_NAME_KEYS.map(nameKey => ({ nameKey, name: '', time: '' }));
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
  const { nutritionDraft, nutritionLoading } = getContext();
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
  const { nutritionDraft } = getContext();
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
  const { profileAthleteId, nutritionDraft } = getContext();
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
  const { profileAthleteId, nutritionDraft } = getContext();
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
      const { profileAthleteId, nutritionDraft } = getContext();
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

function addTag(field) {
  const input = document.getElementById(field.inputId);
  const value = String(input?.value || '').trim();
  const { profileAthleteId, nutritionDraft } = getContext();
  if (!value || !profileAthleteId || !nutritionDraft) return;
  const profile = nutritionDraft;
  const list = Array.isArray(profile[field.key]) ? profile[field.key] : [];
  profile[field.key] = [...list, value];
  renderTagList(field, profile[field.key]);
  if (input) {
    input.value = '';
    input.focus();
  }
  hideProfileStatus();
}

async function saveNutritionProfile() {
  const { selectedAthleteId, nutritionDraft, nutritionLoadError } = getContext();
  const athleteId = String(selectedAthleteId || '');
  if (!athleteId || !nutritionDraft || nutritionSaving) return;

  nutritionSaving = true;
  hideProfileStatus();
  syncCoachNutritionProfileUi();

  try {
    const saved = await putCoachAthleteNutrition(athleteId, buildNutritionPayload(nutritionDraft));
    if (String(getContext().selectedAthleteId || '') !== athleteId) return;
    const normalized = normalizeNutrition(saved);
    onDraftSaved(normalized, athleteId);
    profileFormSyncedId = null;
    applyProfileToForm(normalized);
    profileFormSyncedId = athleteId;
    hideProfileStatus();
    setNutritionTab('summary');
    flashNutritionSaved();
  } catch {
    if (String(getContext().selectedAthleteId || '') !== athleteId) return;
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
