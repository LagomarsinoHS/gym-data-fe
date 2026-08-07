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
  const equipmentParam = Array.isArray(equipment)
    ? equipment.filter(Boolean).join(',')
    : equipment;

  return get(
    `${EXERCISES}/recommend`,
    { zone, equipment: equipmentParam, locale },
    { auth: true },
  );
}
