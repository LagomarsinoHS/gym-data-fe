import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

import { translate, type MessageKey } from "@/i18n";
import { getStoredLang, setStoredLang, type Lang } from "@/lib/prefs";

type I18nContextValue = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getStoredLang);

  const value = useMemo<I18nContextValue>(() => {
    const setLang = (next: Lang) => {
      setStoredLang(next);
      setLangState(next);
      document.documentElement.lang = next;
    };

    return {
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
