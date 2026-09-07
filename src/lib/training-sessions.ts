import type { TrainingProgramItem, TrainingSession } from "@/types/user";

export function serializeSessions(sessions: TrainingSession[]) {
  return sessions.map((session, index) => ({
    id: session.id,
    name: session.name.trim() || `Sesión ${index + 1}`,
    order: index,
    items: session.items.map((item, itemIndex) => ({
      exerciseId: item.exerciseId,
      order: item.order ?? itemIndex,
      ...(item.sets != null ? { sets: item.sets } : {}),
      ...(item.reps ? { reps: item.reps } : {}),
      ...(item.rest != null ? { rest: item.rest } : {}),
      ...(item.notes ? { notes: item.notes } : {}),
    })),
  }));
}

export function sessionSets(session: TrainingSession): number {
  return session.items.reduce((sum, item) => sum + (item.sets ?? 0), 0);
}

export function isExerciseInSession(
  session: TrainingSession | undefined,
  exerciseId: string,
): boolean {
  if (!session) return false;
  return session.items.some(
    (item) => String(item.exercise?.id || item.exerciseId) === String(exerciseId),
  );
}

export function newSessionId(): string {
  return crypto.randomUUID();
}

export function itemMatchesSearch(item: TrainingProgramItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = item.exercise?.name;
  const haystack = [
    item.exerciseId,
    item.notes,
    item.exercise?.id,
    item.exercise?.category,
    item.exercise?.equipment,
    typeof name === "string" ? name : `${name?.en ?? ""} ${name?.es ?? ""}`,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(q);
}
