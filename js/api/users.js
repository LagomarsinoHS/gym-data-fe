import { get, post, postBinary, put } from './client.js';

const USERS = '/users';

/** GET /users/me — requires Bearer token */
export function getMe() {
  return get(`${USERS}/me`, {}, { auth: true });
}

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
 * POST /users/coach/invites/respond
 * Athlete accepts or rejects pending invite. Body: { action: 'accept' | 'reject' }
 */
export function respondCoachInvite(action) {
  return post(
    `${USERS}/coach/invites/respond`,
    { action },
    { auth: true },
  );
}

/**
 * GET /users/coach/athletes
 * Athletes linked to the authenticated coach (coachId === me).
 * Returns PaginatedResponse<CoachAthleteDto>: { data, page, limit, pages, total }
 * Optional search matches firstName, lastName, or email.
 */
export function getCoachAthletes({ page = 1, limit = 50, search } = {}) {
  return get(
    `${USERS}/coach/athletes`,
    { page, limit, search: search || undefined },
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
 * POST /users/coach/training-program/export
 * Exports coach training programs (xlsx or zip) as a binary file.
 * Body: { athleteIds: string[], locale: 'es' | 'en' }
 * athleteIds: [] = all athletes; [id] = one athlete.
 * Expects binary body + Content-Disposition filename (and Content-Type).
 * Returns { blob, filename, contentType }.
 */
export function exportCoachTrainingProgram(athleteIds, locale) {
  return postBinary(
    `${USERS}/coach/training-program/export`,
    { athleteIds, locale },
    { auth: true },
  );
}
