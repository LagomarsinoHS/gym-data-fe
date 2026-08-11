/**
 * Shared in-memory state for coach Mis alumnos + session plan editing.
 * Single owner of athletes / dirty / editor pointers so UI modules stay thin.
 */
import { userProfile } from '../utils/helpers.js';

/** Virtual athlete id for coachTemplates edit via the session editor. */
export const TEMPLATES_SCOPE_ID = '__coach_templates__';

export const store = {
  athletes: [],
  athletesLoaded: false,
  loadingAthletes: false,
  page: 0,
  pages: 0,
  total: 0,
  loadSeq: 0,
  searchQuery: '',
  openAthleteId: null,
  openSessionId: null,
  editorAthleteId: null,
  editorSessionId: null,
  /** Athlete id for the progress-photos coach view. */
  progressAthleteId: null,
  /** Where progress-photos back navigates: 'students' | 'avances'. */
  progressReturnView: 'students',
  /** Fallback athlete fields when not present in store.athletes. */
  progressAthleteSnapshot: null,
  sessionAssignTarget: null,
  dirtyAthleteIds: new Set(),
  savingAthleteIds: new Set(),
  /** @type {Map<string, string>} */
  saveErrorByAthleteId: new Map(),
  /** Coach reusable session templates (same shape as coachTrainingProgram). */
  templates: [],
  templatesLoaded: false,
  loadingTemplates: false,
  navigateTo: () => {},
  openExercise: () => {},
  /** Re-render Mis alumnos list (wired by students-ui). */
  refreshList: () => {},
  /** Re-render plantillas list (wired by coach-templates-ui). */
  refreshTemplatesList: () => {},
  /** Open apply-template modal (wired by coach-templates-ui). */
  requestApplyTemplate: null,
  /** Open use-templates modal for an athlete (wired by coach-templates-ui). */
  requestUseTemplatesForAthlete: null,
};

/** Stable proxy so `athlete.coachTrainingProgram = …` updates store.templates. */
let templatesAthleteProxy = null;

export function isTemplatesScope(athleteId) {
  return String(athleteId || '') === TEMPLATES_SCOPE_ID;
}

export function getTemplatesAthlete() {
  if (!Array.isArray(store.templates)) store.templates = [];
  if (!templatesAthleteProxy) {
    templatesAthleteProxy = {
      id: TEMPLATES_SCOPE_ID,
      email: '',
      profile: { firstName: '', lastName: '' },
      get coachTrainingProgram() {
        return store.templates;
      },
      set coachTrainingProgram(value) {
        store.templates = Array.isArray(value) ? value : [];
      },
    };
  }
  return templatesAthleteProxy;
}

export function findAthlete(athleteId) {
  if (isTemplatesScope(athleteId)) return getTemplatesAthlete();
  const id = String(athleteId || '');
  return (
    store.athletes.find(a => String(a?.id) === id)
    || (String(store.progressAthleteSnapshot?.id) === id
      ? store.progressAthleteSnapshot
      : null)
  );
}

export function findSession(athleteId, sessionId) {
  const athlete = findAthlete(athleteId);
  if (!athlete) return null;
  return getAthleteSessions(athlete).find(s => String(s?.id) === String(sessionId)) || null;
}

export function athleteDisplayName(athlete) {
  if (isTemplatesScope(athlete?.id)) return '';
  const profile = userProfile(athlete);
  const first = String(profile.firstName || '').trim();
  const last = String(profile.lastName || '').trim();
  const email = String(athlete?.email || '').trim();
  return [first, last].filter(Boolean).join(' ') || email || '—';
}

export function getAthleteSessions(athlete) {
  const prog = athlete?.coachTrainingProgram;
  if (!Array.isArray(prog)) return [];
  return [...prog].sort((a, b) => (a?.order ?? 0) - (b?.order ?? 0));
}

export function ensureAthleteSessions(athlete) {
  if (!Array.isArray(athlete.coachTrainingProgram)) {
    athlete.coachTrainingProgram = [];
  }
  return athlete.coachTrainingProgram;
}

export function isAthleteDirty(athleteId) {
  return store.dirtyAthleteIds.has(String(athleteId || ''));
}

export function markAthleteDirty(athleteId) {
  const id = String(athleteId || '');
  if (!id) return;
  store.dirtyAthleteIds.add(id);
  store.saveErrorByAthleteId.delete(id);
}

export function clearAthleteDirty(athleteId) {
  const id = String(athleteId || '');
  store.dirtyAthleteIds.delete(id);
  store.saveErrorByAthleteId.delete(id);
}

export function resetCoachAthletesStore() {
  store.loadSeq += 1;
  store.athletes = [];
  store.athletesLoaded = false;
  store.loadingAthletes = false;
  store.page = 0;
  store.pages = 0;
  store.total = 0;
  store.searchQuery = '';
  store.openAthleteId = null;
  store.openSessionId = null;
  store.editorAthleteId = null;
  store.editorSessionId = null;
  store.progressAthleteId = null;
  store.progressReturnView = 'students';
  store.progressAthleteSnapshot = null;
  store.sessionAssignTarget = null;
  store.dirtyAthleteIds.clear();
  store.savingAthleteIds.clear();
  store.saveErrorByAthleteId.clear();
  store.templates = [];
  store.templatesLoaded = false;
  store.loadingTemplates = false;
  templatesAthleteProxy = null;
}
