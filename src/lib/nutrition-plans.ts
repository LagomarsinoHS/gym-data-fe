import type { Lang } from "@/lib/prefs";
import type { NutritionPlan } from "@/types/nutrition";

export function sortNutritionPlans(plans: NutritionPlan[]) {
  return [...plans].sort((a, b) => {
    const aArchived = a.status === "archived" ? 1 : 0;
    const bArchived = b.status === "archived" ? 1 : 0;
    if (aArchived !== bArchived) return aArchived - bArchived;
    return String(b.validFrom || "").localeCompare(String(a.validFrom || ""));
  });
}

export function formatMonthYear(value: string | null | undefined, lang: Lang) {
  const date = parsePlanDate(value);
  if (!date) return "—";
  const raw = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function formatShortDate(value: string | null | undefined, lang: Lang) {
  const date = parsePlanDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatKcal(value: number, lang: Lang) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "es-CL", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

export function formatNutritionNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

export function mealIcon(index: number, total: number) {
  if (total <= 1) return "☀️";
  if (index === 0) return "🌅";
  if (index === total - 1) return "🌙";
  if (index === 1) return "☀️";
  return "🥗";
}

function parsePlanDate(value?: string | null) {
  if (!value) return null;
  const ymd = String(value).slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const [year, month, day] = ymd.split("-").map(Number);
    return new Date(year ?? 0, (month ?? 1) - 1, day ?? 1, 12, 0, 0, 0);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
