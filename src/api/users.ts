import { del, get, patch, post, postBinary, postForm, put } from "@/api/request";
import { serializeSessions } from "@/lib/training-sessions";
import type { AthleteNutrition } from "@/types/nutrition";
import type { AnalyzeAiSection, ProgressPhotosResponse } from "@/types/progress";
import type {
  CoachAthlete,
  CoachInvite,
  CoachInviteStatus,
  MeUser,
  Paginated,
  PendingCoachInvite,
  TrainingSession,
  UserGoal,
  UserSex,
} from "@/types/user";

export function getMe() {
  return get("/users/me", {}, { auth: true }) as Promise<MeUser>;
}

export function addToTrainingProgram(exerciseIds: string[]) {
  return post("/users/training-program", { exerciseIds }, { auth: true }) as Promise<MeUser>;
}

export function removeFromTrainingProgram(exerciseId: string) {
  return put("/users/training-program/remove", { exerciseId }, { auth: true }) as Promise<MeUser>;
}

export function updateTrainingProgramExercise(
  exerciseId: string,
  updates: { sets?: number; reps?: string; rest?: number; notes?: string },
) {
  return put(`/users/training-program/${exerciseId}`, updates, { auth: true }) as Promise<MeUser>;
}

export function updateProfile(body: {
  profile?: {
    firstName?: string;
    lastName?: string;
    heightCm?: number | null;
    sex?: UserSex | null;
    birthDate?: string | null;
  };
  goal?: UserGoal | null;
  currentPassword?: string;
  newPassword?: string;
  confirmNewPassword?: string;
}) {
  return patch("/users/me", body, { auth: true }) as Promise<MeUser>;
}

export function uploadProfilePhoto(file: File) {
  const form = new FormData();
  form.append("profilePhoto", file);
  return postForm("/users/me/profile-photo", form, { auth: true }) as Promise<MeUser>;
}

export function deleteAccount(email: string) {
  return del("/users/me", { email }, { auth: true }) as Promise<{ ok: boolean }>;
}

export function leaveCoach() {
  return del("/users/me/coach", undefined, { auth: true }) as Promise<MeUser>;
}

export function getPendingCoachInvite() {
  return get("/users/me/pending-coach-invite", {}, { auth: true }) as Promise<{
    invite: PendingCoachInvite | null;
  }>;
}

export function respondCoachInvite(action: "accept" | "reject") {
  return post(
    "/users/me/pending-coach-invite/respond",
    { action },
    { auth: true },
  ) as Promise<MeUser>;
}

export function listCoachAthletes(params: { page?: number; limit?: number; search?: string } = {}) {
  return get("/users/coach/athletes", params, { auth: true }) as Promise<Paginated<CoachAthlete>>;
}

export function listCoachInvites(
  params: { page?: number; limit?: number; status?: CoachInviteStatus } = {},
) {
  return get("/users/coach/invites", params, { auth: true }) as Promise<Paginated<CoachInvite>>;
}

export function inviteAthlete(email: string) {
  return post("/users/coach/invites", { email }, { auth: true }) as Promise<{ ok: boolean }>;
}

export function exportCoachTrainingProgram(
  athleteIds: string[],
  locale: "es" | "en",
  format: "xlsx" | "pdf" = "xlsx",
) {
  return postBinary(
    "/users/coach/training-program/export",
    { athleteIds, locale, format },
    { auth: true },
  );
}

export function setAthleteCoachProgram(athleteId: string, sessions: TrainingSession[]) {
  return put(
    `/users/coach/athletes/${athleteId}/training-program`,
    { coachTrainingProgram: serializeSessions(sessions) },
    { auth: true },
  ) as Promise<MeUser>;
}

export function getAthleteNutrition(athleteId: string) {
  return get(
    `/users/coach/athletes/${athleteId}/nutrition`,
    {},
    { auth: true },
  ) as Promise<AthleteNutrition>;
}

export function setAthleteNutrition(athleteId: string, body: Partial<AthleteNutrition>) {
  return put(`/users/coach/athletes/${athleteId}/nutrition`, body, {
    auth: true,
  }) as Promise<AthleteNutrition>;
}

export function analyzeProgressPhotos(
  userId: string,
  yearMonths: [string, string],
  locale: "es" | "en",
) {
  return post(
    `/users/${userId}/progress-photos/analyze`,
    { yearMonths, locale },
    { auth: true },
  ) as Promise<{ sections?: AnalyzeAiSection[] }>;
}

export function getProgressPhotos(userId: string, year?: number) {
  return get(`/users/${userId}/progress-photos`, year ? { year } : {}, {
    auth: true,
  }) as Promise<ProgressPhotosResponse>;
}

export function uploadProgressPhotos(input: {
  weightKg: number;
  yearMonth?: string;
  front?: File;
  back?: File;
}) {
  const form = new FormData();
  form.append("weightKg", String(input.weightKg));
  if (input.yearMonth) form.append("yearMonth", input.yearMonth);
  if (input.front) form.append("front", input.front);
  if (input.back) form.append("back", input.back);
  return postForm("/users/me/progress-photos", form, { auth: true }) as Promise<{
    yearMonth: string;
    weightKg: number | null;
    front: { url: string; uploadedAt: string } | null;
    back: { url: string; uploadedAt: string } | null;
  }>;
}
