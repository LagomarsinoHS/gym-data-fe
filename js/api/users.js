import { get, post, put } from './client.js';

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
