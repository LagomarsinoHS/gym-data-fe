import { en } from "@/i18n/en";
import { es } from "@/i18n/es";
import type { Lang } from "@/lib/prefs";

export type MessageKey = keyof typeof es;

const dictionaries: Record<Lang, Record<MessageKey, string>> = { es, en };

export function translate(
  lang: Lang,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  let text = dictionaries[lang][key] ?? dictionaries.es[key] ?? key;
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}
