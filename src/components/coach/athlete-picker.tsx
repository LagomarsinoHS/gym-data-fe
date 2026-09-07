import { useEffect, useState } from "react";

import { listCoachAthletes } from "@/api/users";
import { SearchIcon } from "@/components/coach/recommend-overlay";
import { useI18n } from "@/context/i18n-context";
import { personName } from "@/lib/user-display";
import type { CoachAthlete } from "@/types/user";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 500;

export function AthletePicker({
  active,
  onSelect,
  onInvite,
}: {
  active: boolean;
  onSelect: (athlete: CoachAthlete) => void;
  onInvite?: () => void;
}) {
  const { t } = useI18n();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [fetched, setFetched] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    void listCoachAthletes({
      page: 1,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    })
      .then((data) => {
        if (cancelled) return;
        setAthletes(data.data ?? []);
        setPage(data.page ?? 1);
        setPages(data.pages ?? 0);
        setFetched(true);
      })
      .catch(() => {
        if (!cancelled) {
          setAthletes([]);
          setError(true);
          setFetched(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [active, debouncedSearch]);

  async function loadMore() {
    const next = page + 1;
    const data = await listCoachAthletes({
      page: next,
      limit: PAGE_SIZE,
      ...(debouncedSearch ? { search: debouncedSearch } : {}),
    });
    setAthletes((prev) => [...prev, ...(data.data ?? [])]);
    setPage(data.page ?? next);
    setPages(data.pages ?? pages);
  }

  const searching = Boolean(debouncedSearch);
  const empty = fetched && !loading && !athletes.length;

  return (
    <div id="nutrition-picker" className="nutrition-picker" hidden={!active}>
      <div className="search-wrapper students-search nutrition-search">
        <SearchIcon />
        <input
          type="text"
          className="search-box"
          id="nutrition-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t("nutritionSearch")}
          autoComplete="off"
        />
        <button
          type="button"
          className={`search-clear${search ? " visible" : ""}`}
          aria-label={t("nutritionSearchClear")}
          onClick={() => setSearch("")}
        >
          ×
        </button>
      </div>
      <div className="nutrition-loading" hidden={!loading}>
        <div className="load-spinner visible" aria-hidden="true" />
        <span>{t("nutritionLoading")}</span>
      </div>
      <div className="nutrition-empty" hidden={!empty}>
        <p className="nutrition-empty-title">
          {t(error ? "nutritionLoadFail" : searching ? "nutritionSearchEmptyTitle" : "nutritionEmptyTitle")}
        </p>
        <p className="nutrition-empty-lead">
          {t(searching ? "nutritionSearchEmptyLead" : "nutritionEmptyLead")}
        </p>
        {onInvite && !searching ? (
          <button type="button" className="recommend-cta" onClick={onInvite}>
            <span>{t("addStudent")}</span>
          </button>
        ) : null}
      </div>
      <div className="nutrition-list" hidden={loading || !athletes.length}>
        {athletes.map((athlete) => (
          <button
            key={athlete.id}
            type="button"
            className="nutrition-athlete-btn"
            onClick={() => onSelect(athlete)}
          >
            <span className="nutrition-athlete-btn-name">
              {personName(athlete.profile) || athlete.email}
            </span>
            <span className="nutrition-athlete-btn-email">{athlete.email || "—"}</span>
            <span className="nutrition-athlete-btn-chevron" aria-hidden="true">
              ›
            </span>
          </button>
        ))}
      </div>
      <button
        type="button"
        className="students-load-more"
        hidden={loading || page >= pages}
        onClick={() => void loadMore()}
      >
        <span>{t("studentsLoadMore")}</span>
      </button>
    </div>
  );
}
