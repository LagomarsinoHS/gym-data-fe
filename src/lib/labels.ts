import { VALUE_LABELS_ES } from "@/i18n/value-labels-es";
import type { Lang } from "@/lib/prefs";
import type { Exercise } from "@/types/exercise";

export function titleCase(value: string): string {
  return String(value)
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function valueLabel(value: string | undefined, lang: Lang): string {
  if (!value) return "";
  if (lang === "es") return VALUE_LABELS_ES[value] ?? titleCase(value);
  return titleCase(value);
}

export function localized(value: Exercise["name"] | undefined, lang: Lang): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value[lang] || value.en || value.es || "";
}

export function exerciseName(
  exercise: { name?: Exercise["name"]; id?: string } | undefined,
  lang: Lang,
): string {
  if (!exercise) return "";
  return localized(exercise.name, lang) || exercise.id || "";
}
