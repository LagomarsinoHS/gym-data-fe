import { del, get, post } from "@/api/request";
import type { AdminStats, AdminSubscriptionResult, AdminUser } from "@/types/admin";
import type { Paginated, Role, SubscriptionPlan } from "@/types/user";

export function getAdminStats() {
  return get("/admin/stats", {}, { auth: true }) as Promise<AdminStats>;
}

export function listAdminUsers(
  params: {
    page?: number;
    limit?: number;
    search?: string;
    role?: Role;
    plan?: SubscriptionPlan;
    expiringSoon?: boolean;
    sortBy?: "lastLoginAt" | "createdAt";
    sortDir?: "asc" | "desc";
  } = {},
) {
  const query: Record<string, string | number | undefined> = {
    page: params.page ?? 1,
    limit: params.limit ?? 50,
    sortBy: params.sortBy ?? "lastLoginAt",
    sortDir: params.sortDir ?? "desc",
  };
  if (params.search) query.search = params.search;
  if (params.role) query.role = params.role;
  if (params.plan) query.plan = params.plan;
  if (params.expiringSoon) query.expiringSoon = "true";
  return get("/admin/users", query, { auth: true }) as Promise<Paginated<AdminUser>>;
}

export function grantSubscription(body: {
  email: string;
  plan: "premium" | "growth" | "pro";
  durationDays?: number;
}) {
  return post("/admin/subscriptions/grant", body, {
    auth: true,
  }) as Promise<AdminSubscriptionResult>;
}

export function revokeSubscription(email: string) {
  return post(
    "/admin/subscriptions/revoke",
    { email },
    { auth: true },
  ) as Promise<AdminSubscriptionResult>;
}

export function deleteAdminUser(userId: string) {
  return del(`/admin/users/${userId}`, undefined, { auth: true });
}
