import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { useTheme } from "@/context/theme-context";
import { valueLabel } from "@/lib/labels";
import type { FilterKey } from "@/types/exercise";

const FILTER_KEYS: FilterKey[] = ["category", "equipment", "target"];

export function ResultsBar() {
  const { lang, setLang, t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const {
    filters,
    search,
    setSearch,
    clearFilters,
    clearFilter,
    total,
    ready,
    wodLoading,
    playWod,
  } = useCatalog();
  const [draft, setDraft] = useState(search);

  useEffect(() => {
    setDraft(search);
  }, [search]);

  const isTraining = pathname === "/entrenamiento";

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (draft !== search) {
        if (pathname !== "/" && !isTraining) navigate("/");
        setSearch(draft);
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [draft, isTraining, navigate, pathname, search, setSearch]);

  const active = FILTER_KEYS.flatMap((key) => {
    const value = filters[key];
    return value ? [{ key, value }] : [];
  });

  return (
    <div className="results-bar">
      <div className="catalog-bar-extras">
        <div className="active-filters">
          {active.map(({ key, value }) => {
            const shown = valueLabel(value, lang);
            return (
              <span key={`${key}:${value}`} className="active-badge">
                {shown}
                <button
                  type="button"
                  className="active-badge-remove"
                  aria-label={`Remove ${shown}`}
                  onClick={() => clearFilter(key, value)}
                >
                  ×
                </button>
              </span>
            );
          })}
          {active.length > 0 ? (
            <button type="button" className="clear-all" onClick={clearFilters}>
              {t("clearAll")}
            </button>
          ) : null}
        </div>
        <span className="results-count">
          {pathname === "/" && ready ? t("exercisesCount", { n: total.toLocaleString() }) : ""}
        </span>
      </div>

      <div className="search-wrapper results-search">
        <svg
          className="search-icon"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden="true"
        >
          <circle cx="6.5" cy="6.5" r="4.5" />
          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          className="search-box"
          placeholder={isTraining ? t("searchTraining") : t("search")}
          autoComplete="off"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button
          type="button"
          className={`search-clear${draft ? " visible" : ""}`}
          aria-label={t("clearAll")}
          onClick={() => {
            setDraft("");
            setSearch("");
            if (pathname !== "/" && !isTraining) navigate("/");
          }}
        >
          ×
        </button>
      </div>

      <div className="results-bar-actions">
        {pathname === "/" ? (
          <button
            type="button"
            className="wod-btn"
            title="Random workout"
            disabled={wodLoading}
            onClick={() => void playWod()}
          >
            <span className="wod-ico" aria-hidden="true">
              🎲
            </span>
            <span>WOD</span>
          </button>
        ) : null}

        <div className="results-bar-prefs">
          <div className="lang-toggle" role="group" aria-label="Language">
            <button
              type="button"
              className={`lang-toggle-btn${lang === "es" ? " active" : ""}`}
              aria-pressed={lang === "es"}
              onClick={() => setLang("es")}
            >
              Español
            </button>
            <button
              type="button"
              className={`lang-toggle-btn${lang === "en" ? " active" : ""}`}
              aria-pressed={lang === "en"}
              onClick={() => setLang("en")}
            >
              English
            </button>
          </div>

          <button
            type="button"
            className="theme-toggle-btn"
            data-theme={theme}
            aria-label={theme === "dark" ? "Tema oscuro" : "Tema claro"}
            onClick={toggleTheme}
          >
            <span className="theme-toggle-emoji" aria-hidden="true">
              {theme === "dark" ? "🌙" : "☀️"}
            </span>
            <span>{t("theme")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
