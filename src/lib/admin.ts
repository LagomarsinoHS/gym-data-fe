import type { MessageKey } from "@/i18n";
import type { Lang } from "@/lib/prefs";
import type { Role, SubscriptionPlan, UserSubscription } from "@/types/user";

export function formatAdminDate(value: string | Date | null | undefined, lang: Lang) {
  if (!value) return "—";
  const date =
    value instanceof Date
      ? value
      : /^\d{4}-\d{2}-\d{2}$/.test(String(value).trim())
        ? parseCalendarDate(String(value).trim())
        : new Date(value);
  if (!date || Number.isNaN(date.getTime())) return "—";
  if (lang === "es") {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("es-ES", { year: "numeric", month: "long", day: "2-digit" })
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

export function adminRoleKey(role: Role): MessageKey {
  if (role === "admin") return "roleAdmin";
  if (role === "coach") return "roleCoach";
  return "roleAthlete";
}

export function adminPlanKey(plan: SubscriptionPlan): MessageKey {
  if (plan === "premium") return "adminPlanPremium";
  if (plan === "growth") return "adminPlanGrowth";
  if (plan === "pro") return "adminPlanPro";
  return "adminPlanFree";
}

export function grantablePlansForRole(role: Role): Array<"premium" | "growth" | "pro"> {
  if (role === "athlete") return ["premium"];
  if (role === "coach") return ["growth", "pro"];
  return [];
}

export function subscriptionRemainingProgress(subscription: UserSubscription) {
  const startMs = toTimeMs(subscription.startedAt);
  const endMs = toTimeMs(subscription.expiresAt);
  if (startMs == null || endMs == null || endMs <= startMs) return null;
  const now = Date.now();
  if (now <= startMs) return 100;
  if (now >= endMs) return 0;
  return ((endMs - now) / (endMs - startMs)) * 100;
}

export function remainingFillColor(remainingPct: number) {
  const t = Math.max(0, Math.min(1, 1 - remainingPct / 100));
  const green = [61, 186, 106];
  const yellow = [230, 200, 74];
  const red = [227, 93, 79];
  const from = t < 0.5 ? green : yellow;
  const to = t < 0.5 ? yellow : red;
  const local = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const rgb = from.map((c, i) => Math.round(c + ((to[i] ?? 0) - c) * local));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

export function toTimeMs(value?: string | Date | null) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function parseCalendarDate(value: string) {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return new Date(y, m - 1, d, 12, 0, 0, 0);
}
