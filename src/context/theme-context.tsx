import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { getStoredTheme, setStoredTheme, type Theme } from "@/lib/prefs";

const THEME_ANIM_MS = 280;

type ThemeContextValue = {
  theme: Theme;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function applyTheme(theme: Theme, animate: boolean) {
  const root = document.documentElement;
  if (animate && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    root.classList.add("theme-animating");
    window.setTimeout(() => root.classList.remove("theme-animating"), THEME_ANIM_MS);
  }
  root.setAttribute("data-theme", theme);
  setStoredTheme(theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = getStoredTheme();
    applyTheme(initial, false);
    return initial;
  });

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      toggleTheme: () => {
        const next = theme === "dark" ? "light" : "dark";
        applyTheme(next, true);
        setTheme(next);
      },
    }),
    [theme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
