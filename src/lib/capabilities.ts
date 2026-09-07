import type { MeUser } from "@/types/user";

export function isCoach(user: MeUser | null): boolean {
  return user?.role === "coach";
}

export function isAdmin(user: MeUser | null): boolean {
  return user?.role === "admin";
}

export function isAthlete(user: MeUser | null): boolean {
  return user?.role === "athlete";
}

export function isPremium(user: MeUser | null): boolean {
  return user?.subscription.plan === "premium";
}

export function isPaidPlan(user: MeUser | null): boolean {
  const plan = user?.subscription.plan;
  return plan === "premium" || plan === "growth" || plan === "pro";
}

export function canAccessRecommendPlan(user: MeUser | null): boolean {
  return isAthlete(user) && isPremium(user);
}

export function canInviteAthlete(user: MeUser | null): boolean {
  return isCoach(user) && Boolean(user?.coachQuota?.canInvite);
}

export function canAccessProgressAiAnalysis(user: MeUser | null): boolean {
  return isCoach(user) && isPaidPlan(user);
}

export function homePathFor(user: MeUser | null): string {
  if (isAdmin(user)) return "/admin";
  if (isCoach(user)) return "/panel";
  if (isAthlete(user)) return "/entrenamiento";
  return "/";
}
