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

/** @param {{ page?: number, limit?: number, category?: string, equipment?: string, target?: string, body_part?: string }} opts */
export function getExercises({
  page = 1,
  limit = 50,
  category,
  equipment,
  target,
  body_part,
} = {}) {
  return request(EXERCISES, { page, limit, category, equipment, target, body_part });
}

export function getExercise(id) {
  return request(`${EXERCISES}/${id}`);
}

/** Random exercise — requires GET /exercises/random on the API (register before /:id). */
export function getRandomExercise() {
  return request(`${EXERCISES}/random`);
}

export function getLabels() {
  return request(`${EXERCISES}/labels`);
}
