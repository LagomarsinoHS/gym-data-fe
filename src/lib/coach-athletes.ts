import { ApiError } from "@/api/request";
import type { MessageKey } from "@/i18n";
import type { CoachAthlete, UserGoal, UserSex } from "@/types/user";

export function athleteHasPlan(athlete: CoachAthlete) {
  const program = athlete.coachTrainingProgram;
  if (!Array.isArray(program) || program.length === 0) return false;
  return program.some((session) => Array.isArray(session.items) && session.items.length > 0);
}

export function athleteHasTemplate(athlete: CoachAthlete, templateId: string) {
  const id = String(templateId || "").trim();
  if (!id) return false;
  return (athlete.coachTrainingProgram ?? []).some((session) => String(session.id) === id);
}

export function inviteErrorKey(err: unknown): MessageKey {
  const code = err instanceof ApiError ? err.code : null;
  if (code === "COACH_ATHLETE_QUOTA_FULL") return "inviteQuotaFull";
  if (code === "EMAIL_NOT_AN_ATHLETE") return "inviteNotAthlete";
  if (code === "ATHLETE_HAS_PENDING_INVITE") return "invitePending";
  if (code === "ALREADY_YOUR_ATHLETE") return "inviteAlreadyYours";
  if (code === "ATHLETE_ALREADY_HAS_COACH") return "inviteAlreadyHasCoach";
  return "inviteFail";
}

export function sexLabelKey(sex: UserSex | null | undefined): MessageKey | null {
  if (sex === "male") return "profileSexMale";
  if (sex === "female") return "profileSexFemale";
  if (sex === "other") return "profileSexOther";
  if (sex === "prefer_not_to_say") return "profileSexPreferNot";
  return null;
}

export function goalLabelKey(goal: UserGoal | null | undefined): MessageKey | null {
  if (goal === "strength") return "profileGoalStrength";
  if (goal === "hypertrophy") return "profileGoalHypertrophy";
  if (goal === "fat_loss") return "profileGoalFatLoss";
  if (goal === "general") return "profileGoalGeneral";
  return null;
}

export function ageFromBirthDate(birthDate?: string | null) {
  const match = String(birthDate || "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

const SEEN_NEW_KEY = "steelPulse.seenNewAthletes";

export function readSeenNewAthletes() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SEEN_NEW_KEY) || "[]");
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

export function markNewAthleteSeen(id: string) {
  const seen = readSeenNewAthletes();
  seen.add(id);
  try {
    localStorage.setItem(SEEN_NEW_KEY, JSON.stringify([...seen]));
  } catch {
    /* ignore */
  }
}
