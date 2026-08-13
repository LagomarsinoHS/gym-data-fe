import { get, post, postBinary, postMultipart, put, patch, deleteRequest } from './request.js';

const USERS = '/users';

// ── Me / profile ──────────────────────────────────────────────────────

/** GET /users/me — requires Bearer token */
export function getMe() {
  return get(`${USERS}/me`, {}, { auth: true });
}

/**
 * PATCH /users/me
 * Partial update: profile (name/body stats), goal, and/or password.
 */
export function updateProfile(body) {
  return patch(`${USERS}/me`, body, { auth: true });
}

/**
 * DELETE /users/me
 * Soft-delete the authenticated account. Body: { email }
 * Email must belong to the JWT user.
 */
export function deleteAccount(email) {
  return deleteRequest(`${USERS}/me`, { email }, { auth: true });
}

/**
 * POST /users/me/profile-photo (multipart)
 * Field: profilePhoto (jpeg/png/webp). Returns MeResponseDto.
 */
export function uploadProfilePhoto(file) {
  return postMultipart(
    `${USERS}/me/profile-photo`,
    buildProfilePhotoForm(file),
    { auth: true },
  );
}

/**
 * GET /users/me/pending-coach-invite
 * Returns { invite: null | PendingCoachInvite }.
 */
export function getPendingCoachInvite() {
  return get(`${USERS}/me/pending-coach-invite`, {}, { auth: true });
}

/**
 * POST /users/me/pending-coach-invite/respond
 * Athlete accepts or rejects pending invite. Body: { action: 'accept' | 'reject' }
 */
export function respondCoachInvite(action) {
  return post(
    `${USERS}/me/pending-coach-invite/respond`,
    { action },
    { auth: true },
  );
}

// ── Self training program ─────────────────────────────────────────────

/**
 * POST /users/training-program
 * Appends catalog exercises (by id). Skips duplicates. Body: { exerciseIds: string[] }
 * User id comes from JWT.
 */
export function addToTrainingProgram(exerciseIds) {
  return post(
    `${USERS}/training-program`,
    { exerciseIds },
    { auth: true },
  );
}

/**
 * PUT /users/training-program/remove
 * Body: { exerciseId: string }
 * User id comes from JWT.
 */
export function removeTrainingProgramExercise(exerciseId) {
  return put(
    `${USERS}/training-program/remove`,
    { exerciseId },
    { auth: true },
  );
}

/**
 * PUT /users/training-program/:exerciseId
 * Updates sets / reps / rest / notes for one program item.
 * User id comes from JWT.
 */
export function updateTrainingProgramExercise(exerciseId, updates) {
  return put(
    `${USERS}/training-program/${exerciseId}`,
    updates,
    { auth: true },
  );
}

// ── Coach athletes / invites / export ─────────────────────────────────

/**
 * POST /users/coach/invites
 * Invite an athlete by exact email. Body: { email }
 * Coach id comes from JWT.
 */
export function inviteCoachAthlete(email) {
  return post(
    `${USERS}/coach/invites`,
    { email },
    { auth: true },
  );
}

/**
 * GET /users/coach/athletes
 * Athletes linked to the authenticated coach (coachId === me).
 * Returns PaginatedResponse<CoachAthleteDto>: { data, page, limit, pages, total }
 * Optional search matches profile.firstName, profile.lastName, or email.
 */
export function getCoachAthletes({ page = 1, limit = 50, search } = {}) {
  return get(
    `${USERS}/coach/athletes`,
    { page, limit, search: search || undefined },
    { auth: true },
  );
}

/**
 * GET /users/coach/invites
 * Invite history for the coach. Optional status: pending | accepted | rejected | cancelled.
 * Returns PaginatedResponse: { data, page, limit, pages, total }
 */
export function getCoachInvites({ page = 1, limit = 20, status } = {}) {
  return get(
    `${USERS}/coach/invites`,
    { page, limit, status: status || undefined },
    { auth: true },
  );
}

/**
 * PUT /users/coach/athletes/:athleteId/training-program
 * Replaces the athlete's coachTrainingProgram (full sessions array).
 * Body: { coachTrainingProgram } — items with exerciseId only (no populated exercise).
 * Returns enriched athlete (MeResponseDto) with catalog exercises populated.
 */
export function putCoachAthleteTrainingProgram(athleteId, coachTrainingProgram) {
  return put(
    `${USERS}/coach/athletes/${athleteId}/training-program`,
    { coachTrainingProgram },
    { auth: true },
  );
}

/**
 * GET /users/coach/athletes/:athleteId/nutrition
 * Coach-managed nutrition profile. Empty defaults if never saved.
 * Not included in GET /users/me.
 */
export function getCoachAthleteNutrition(athleteId) {
  return get(
    `${USERS}/coach/athletes/${athleteId}/nutrition`,
    {},
    { auth: true },
  );
}

/**
 * PUT /users/coach/athletes/:athleteId/nutrition
 * Replaces the athlete nutrition profile. Returns AthleteNutritionDto.
 */
export function putCoachAthleteNutrition(athleteId, nutrition) {
  return put(
    `${USERS}/coach/athletes/${athleteId}/nutrition`,
    nutrition,
    { auth: true },
  );
}

/**
 * POST /users/coach/training-program/export
 * Exports coach training programs (xlsx | pdf | zip) as a binary file.
 * Body: { athleteIds: string[], locale?: 'es'|'en', format?: 'xlsx'|'pdf' }
 * athleteIds: [] = all athletes; [id] = one athlete.
 * Expects binary body + Content-Disposition filename (and Content-Type).
 * Returns { blob, filename, contentType }.
 */
export function exportCoachTrainingProgram(athleteIds, locale, format = 'xlsx') {
  return postBinary(
    `${USERS}/coach/training-program/export`,
    { athleteIds, locale, format },
    { auth: true },
  );
}

// ── Progress photos ───────────────────────────────────────────────────

/**
 * GET /users/:userId/progress-photos
 * Authz: self or assigned coach. Optional year filter.
 * Returns { currentWeightKg, years: [{ year, months: [{ month, yearMonth, weightKg, front, back }] }] }
 */
export function getProgressPhotos(userId, { year } = {}) {
  return get(
    `${USERS}/${userId}/progress-photos`,
    { year: year || undefined },
    { auth: true },
  );
}

/**
 * POST /users/:userId/progress-photos/analyze
 * Coach + paid plan. Body: { yearMonths: [YYYY-MM, YYYY-MM], locale? }
 * Returns { sections: Array<{ title, blocks }> }
 */
export function analyzeProgressPhotos(userId, { yearMonths, locale } = {}) {
  return post(
    `${USERS}/${userId}/progress-photos/analyze`,
    {
      yearMonths,
      locale: locale || undefined,
    },
    { auth: true },
  );
}

/**
 * POST /users/me/progress-photos (multipart)
 * Fields: weightKg (required) + front? and/or back? image files.
 * Optional yearMonth (YYYY-MM); omitted → current month on the API.
 */
export function uploadProgressPhotos({
  weightKg,
  frontFile,
  backFile,
  yearMonth,
} = {}) {
  return postMultipart(
    `${USERS}/me/progress-photos`,
    buildProgressPhotosForm({ weightKg, frontFile, backFile, yearMonth }),
    { auth: true },
  );
}

// ── Internals ─────────────────────────────────────────────────────────

function buildProfilePhotoForm(file) {
  const form = new FormData();
  form.append('profilePhoto', file);
  return form;
}

function buildProgressPhotosForm({
  weightKg,
  frontFile,
  backFile,
  yearMonth,
} = {}) {
  const form = new FormData();
  form.append('weightKg', String(weightKg));
  if (yearMonth) form.append('yearMonth', String(yearMonth));
  if (frontFile) form.append('front', frontFile);
  if (backFile) form.append('back', backFile);
  return form;
}
