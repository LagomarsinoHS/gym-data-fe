import { get } from "@/api/request";
import type { Exercise, ExerciseLabels, ExercisePage } from "@/types/exercise";

const EXERCISES = "/exercises";

export function getExercises(params: {
  page?: number;
  limit?: number;
  category?: string;
  equipment?: string;
  target?: string;
  search?: string;
}) {
  return get(EXERCISES, params) as Promise<ExercisePage>;
}

export function getExercise(id: string) {
  return get(`${EXERCISES}/${id}`) as Promise<Exercise>;
}

export function getRandomExercise() {
  return get(`${EXERCISES}/random`) as Promise<Exercise>;
}

export function getLabels() {
  return get(`${EXERCISES}/labels`) as Promise<ExerciseLabels>;
}

export function getRecommendedExercises(params: {
  zone: string;
  equipment: string;
  locale: string;
}) {
  return get(`${EXERCISES}/recommend`, params, { auth: true }) as Promise<{
    zone: string;
    equipment: string[];
    locale: string;
    note: string;
    exercises: (Exercise & { sets: number; reps: string; rest: number })[];
  }>;
}
