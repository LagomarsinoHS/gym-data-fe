import { get } from './request.js';

const EXERCISES = '/exercises';

export function getExercises({
  page = 1,
  limit = 50,
  category,
  equipment,
  target,
  bodyPart,
  muscleGroup,
  search,
} = {}) {
  return get(EXERCISES, {
    page,
    limit,
    category,
    equipment,
    target,
    bodyPart,
    muscleGroup,
    search,
  });
}

export function getExercise(id) {
  return get(`${EXERCISES}/${id}`);
}

export function getRandomExercise() {
  return get(`${EXERCISES}/random`);
}

export function getLabels() {
  return get(`${EXERCISES}/labels`);
}

/**
 * GET /exercises/recommend?zone=&equipment=barbell,cable&locale=es
 * Requires auth (Pro). equipment: 1–2 values (comma-separated).
 */
export function getRecommendedExercises({ zone, equipment, locale } = {}) {
  return get(
    `${EXERCISES}/recommend`,
    {
      zone,
      equipment: toEquipmentParam(equipment),
      locale,
    },
    { auth: true },
  );
}

// ── Internals ─────────────────────────────────────────────────────────

function toEquipmentParam(equipment) {
  if (Array.isArray(equipment)) {
    return equipment.filter(Boolean).join(',');
  }
  return equipment;
}
