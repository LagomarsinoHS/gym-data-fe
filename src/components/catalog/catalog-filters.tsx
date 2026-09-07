import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";

import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { valueLabel } from "@/lib/labels";
import type { FilterKey } from "@/types/exercise";

const INITIAL_VISIBLE = 5;

function FilterSection({
  filterKey,
  title,
  values,
  pageSize,
}: {
  filterKey: FilterKey;
  title: string;
  values: string[];
  pageSize?: number;
}) {
  const { lang, t } = useI18n();
  const { filters, toggleFilter } = useCatalog();
  const selected = filters[filterKey];
  const [collapsed, setCollapsed] = useState(() => window.matchMedia("(max-width: 768px)").matches);
  const [shown, setShown] = useState(pageSize ?? values.length);
  const [popValue, setPopValue] = useState<string | null>(null);

  const sorted = useMemo(
    () =>
      [...values].sort((a, b) =>
        valueLabel(a, lang).localeCompare(valueLabel(b, lang), lang, { sensitivity: "base" }),
      ),
    [values, lang],
  );

  useEffect(() => {
    if (!pageSize) {
      setShown(sorted.length);
      return;
    }
    const idx = selected ? sorted.indexOf(selected) : -1;
    const min = idx >= pageSize ? Math.ceil((idx + 1) / pageSize) * pageSize : pageSize;
    setShown(Math.min(min, sorted.length));
  }, [pageSize, selected, sorted]);

  const visible = pageSize ? sorted.slice(0, shown) : sorted;
  const remaining = sorted.length - visible.length;

  return (
    <div
      className={`filter-section${collapsed ? " is-collapsed" : ""}${selected ? " has-active-filter" : ""}`}
      data-filter-key={filterKey}
    >
      <button
        type="button"
        className="filter-summary"
        aria-expanded={!collapsed}
        onClick={() => setCollapsed((value) => !value)}
      >
        <span className="filter-summary-label">{title}</span>
        <span className="filter-summary-hint" hidden={!collapsed || !selected}>
          {selected ? valueLabel(selected, lang) : ""}
        </span>
        <span className="filter-summary-chevron" aria-hidden="true" />
      </button>
      <div className="filter-options">
        {visible.map((value) => (
          <button
            key={value}
            type="button"
            className={`chip${selected === value ? " active" : ""}${popValue === value ? " chip-pop" : ""}`}
            data-filter={filterKey}
            data-value={value}
            onAnimationEnd={() => {
              if (popValue === value) setPopValue(null);
            }}
            onClick={() => {
              if (selected !== value) setPopValue(value);
              toggleFilter(filterKey, value);
            }}
          >
            {valueLabel(value, lang)}
          </button>
        ))}
        {remaining > 0 ? (
          <button
            type="button"
            className="chip filter-show-more"
            onClick={() =>
              setShown((n) => Math.min(n + (pageSize ?? INITIAL_VISIBLE), sorted.length))
            }
          >
            {t("remaining", { n: remaining })}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function CatalogFilters() {
  const { t } = useI18n();
  const { pathname } = useLocation();
  const { labels, labelsReady } = useCatalog();
  const [revealing, setRevealing] = useState(true);

  useEffect(() => {
    if (!labelsReady) {
      setRevealing(true);
      return;
    }
    const timer = window.setTimeout(() => setRevealing(false), 700);
    return () => window.clearTimeout(timer);
  }, [labelsReady]);

  if (pathname !== "/") return null;

  return (
    <div className="sidebar-catalog-filters">
      {!labelsReady ? (
        <div className="sidebar-filters-status" aria-live="polite">
          <div className="load-spinner visible" aria-hidden="true" />
          <span>{t("loadingFilters")}</span>
        </div>
      ) : (
        <div className={`sidebar-filters${revealing ? " is-revealing" : ""}`}>
          <FilterSection filterKey="category" title={t("category")} values={labels.category} />
          <FilterSection
            filterKey="equipment"
            title={t("equipment")}
            values={labels.equipment}
            pageSize={INITIAL_VISIBLE}
          />
          <FilterSection
            filterKey="target"
            title={t("target")}
            values={labels.target}
            pageSize={INITIAL_VISIBLE}
          />
        </div>
      )}
    </div>
  );
}
