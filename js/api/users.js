import { get, put } from './client.js';

const USERS = '/users';

/** GET /users/me — requires Bearer token */
export function getMe() {
  return get(`${USERS}/me`, {}, { auth: true });
}

/**
 * PUT /users/:userId/training-program
 * Replaces program exercise list. Body: { exerciseIds: string[] }
 */
export function putTrainingProgram(userId, exerciseIds) {
  return put(
    `${USERS}/${userId}/training-program`,
    { exerciseIds },
    { auth: true },
  );
}

/**
 * PUT /users/:userId/training-program/remove
 * Body: { exerciseId: string }
 */
export function removeTrainingProgramExercise(userId, exerciseId) {
  return put(
    `${USERS}/${userId}/training-program/remove`,
    { exerciseId },
    { auth: true },
  );
}
