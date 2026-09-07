export const THEME_KEY = "steelPulse.theme";
export const LANG_KEY = "steelPulse.lang";
export const ACTIVE_SESSION_KEY = "steelPulse.activeSessionId";

export type Theme = "light" | "dark";
export type Lang = "es" | "en";

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode / quota */
  }
}

export function getStoredTheme(): Theme {
  const theme = read(THEME_KEY);
  return theme === "dark" || theme === "light" ? theme : "light";
}

export function setStoredTheme(theme: Theme): void {
  write(THEME_KEY, theme);
}

export function getStoredLang(): Lang {
  const lang = read(LANG_KEY);
  return lang === "en" || lang === "es" ? lang : "es";
}

export function setStoredLang(lang: Lang): void {
  write(LANG_KEY, lang);
}

export function getStoredActiveSessionId(): string | null {
  return read(ACTIVE_SESSION_KEY);
}

export function setStoredActiveSessionId(id: string | null): void {
  if (!id) {
    try {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    } catch {
      /* private mode / quota */
    }
    return;
  }
  write(ACTIVE_SESSION_KEY, id);
}
