import { get, post, put } from "@/api/request";
import { serializeSessions } from "@/lib/training-sessions";
import type { TrainingSession } from "@/types/user";

export function getCoachTemplates() {
  return get("/coach/templates", {}, { auth: true }) as Promise<{
    coachTemplates: TrainingSession[];
  }>;
}

export function createCoachTemplate(name: string) {
  return post("/coach/templates", { name }, { auth: true }) as Promise<{
    template: TrainingSession;
  }>;
}

export function setCoachTemplates(sessions: TrainingSession[]) {
  return put(
    "/coach/templates",
    { coachTemplates: serializeSessions(sessions) },
    { auth: true },
  ) as Promise<{ coachTemplates: TrainingSession[] }>;
}

export function applyCoachTemplates(templateIds: string[], athleteIds: string[]) {
  return post("/coach/templates/apply", { templateIds, athleteIds }, { auth: true }) as Promise<{
    applied: { athleteId: string; templateId: string }[];
    skipped: { athleteId: string; templateId: string }[];
    failedAthletes: string[];
    failedTemplates: string[];
  }>;
}
