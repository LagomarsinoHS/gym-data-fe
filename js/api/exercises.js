const PROD_API = 'https://gym-data-8d3l.onrender.com';
const DEV_API = 'http://localhost:3000';

const isLocal =
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

const API_BASE = isLocal ? DEV_API : PROD_API;
const EXERCISES = '/exercises';

async function request(path, params = {}) {
  const url = new URL(path, API_BASE);
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') url.searchParams.set(key, value);
  });

  const res = await fetch(url);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json();
}

/**
 * Query params aligned with backend Joi (camelCase).
 * @param {{ page?: number, limit?: number, category?: string, equipment?: string, target?: string, bodyPart?: string, muscleGroup?: string, search?: string }} opts
 */
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
  return request(EXERCISES, {
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
  return request(`${EXERCISES}/${id}`);
}

/** Random exercise — register /random before /:id on the API. */
export function getRandomExercise() {
  return request(`${EXERCISES}/random`);
}

export function getLabels() {
  return request(`${EXERCISES}/labels`);
}
