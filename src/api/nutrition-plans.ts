import { del, get, patch, post, put } from "@/api/request";
import type { NutritionPlan, NutritionPlanStatus } from "@/types/nutrition";
import type { UserGoal } from "@/types/user";

export function listNutritionPlans(
  params: { athleteId?: string; status?: NutritionPlanStatus } = {},
) {
  return get("/nutrition-plans", params, { auth: true }) as Promise<{ data: NutritionPlan[] }>;
}

export function archiveNutritionPlan(planId: string) {
  return patch(`/nutrition-plans/${planId}/archive`, {}, { auth: true }) as Promise<NutritionPlan>;
}

export function deleteNutritionPlan(planId: string) {
  return del(`/nutrition-plans/${planId}`, undefined, { auth: true });
}

export function createNutritionPlan(body: {
  athleteId: string;
  title: string;
  goal?: UserGoal | null;
  validFrom: string;
  validUntil?: string | null;
  targets: NutritionPlan["targets"];
  meals?: NutritionPlan["meals"];
  generalNotes?: string | null;
}) {
  return post("/nutrition-plans", body, { auth: true }) as Promise<NutritionPlan>;
}

export function updateNutritionPlan(planId: string, body: Partial<NutritionPlan>) {
  return put(`/nutrition-plans/${planId}`, body, { auth: true }) as Promise<NutritionPlan>;
}
