import { get } from './client.js';

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
