import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { ApiError } from "@/api/request";
import { analyzeProgressPhotos, getProgressPhotos, listCoachAthletes } from "@/api/users";
import { ProgressHistory } from "@/components/progress/progress-history";
import { useAuth } from "@/context/auth-context";
import { useI18n } from "@/context/i18n-context";
import { canAccessProgressAiAnalysis } from "@/lib/capabilities";
import { personName } from "@/lib/user-display";
import type { AnalyzeAiSection, AnalyzeAiState, ProgressPhotosResponse } from "@/types/progress";
import type { CoachAthlete } from "@/types/user";

const EMPTY_ANALYZE: AnalyzeAiState = { loading: false, sections: null, error: null };

export function CoachAvancesPage() {
  const { t, lang } = useI18n();
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const canAnalyze = canAccessProgressAiAnalysis(user);
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [athlete, setAthlete] = useState<CoachAthlete | null>(() => {
    const fromState = (location.state as { athlete?: CoachAthlete } | null)?.athlete;
    return fromState ?? null;
  });
  const [loading, setLoading] = useState(() => !athlete);
  const [data, setData] = useState<ProgressPhotosResponse | null>(null);
  const [photosLoading, setPhotosLoading] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [historyMode, setHistoryMode] = useState<"timeline" | "pick" | "compare">("timeline");
  const [analyzeState, setAnalyzeState] = useState<AnalyzeAiState>(EMPTY_ANALYZE);
  const analyzeSeq = useRef(0);

  useEffect(() => {
    if (athlete) return;
    let cancelled = false;
    setLoading(true);
    void listCoachAthletes({ page: 1, limit: 20 })
      .then((result) => {
        if (cancelled) return;
        setAthletes(result.data ?? []);
        setPage(result.page ?? 1);
        setPages(result.pages ?? 0);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [athlete]);

  useEffect(() => {
    if (!athlete) {
      setData(null);
      setAnalyzeState(EMPTY_ANALYZE);
      setHistoryMode("timeline");
      return;
    }
    let cancelled = false;
    setPhotosLoading(true);
    void getProgressPhotos(athlete.id)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .finally(() => {
        if (!cancelled) setPhotosLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [athlete?.id]);

  function clearAnalyze() {
    analyzeSeq.current += 1;
    setAnalyzeState(EMPTY_ANALYZE);
  }

  async function runAnalyze(yearMonths: [string, string]) {
    if (!athlete || !canAnalyze) return;
    const seq = ++analyzeSeq.current;
    setAnalyzeState({ loading: true, sections: null, error: null });
    try {
      const res = await analyzeProgressPhotos(athlete.id, yearMonths, lang);
      if (seq !== analyzeSeq.current) return;
      const sections = normalizeAnalyzeSections(res.sections);
      setAnalyzeState({
        loading: false,
        sections,
        error: sections ? null : t("progressPhotosAnalyzeAiFail"),
      });
    } catch (err) {
      if (seq !== analyzeSeq.current) return;
      setAnalyzeState({
        loading: false,
        sections: null,
        error:
          err instanceof ApiError && err.message ? err.message : t("progressPhotosAnalyzeAiFail"),
      });
    }
  }

  async function loadMore() {
    const next = page + 1;
    const result = await listCoachAthletes({ page: next, limit: 20 });
    setAthletes((prev) => [...prev, ...(result.data ?? [])]);
    setPage(result.page ?? next);
    setPages(result.pages ?? pages);
  }

  if (athlete) {
    return (
      <div className="progress-photos-view">
        <div className="progress-photos">
          <div className="progress-photos-top">
            <div className="progress-photos-chrome">
              <button
                type="button"
                className="session-editor-back"
                onClick={() => {
                  clearAnalyze();
                  setHistoryMode("timeline");
                  navigate("/alumnos", { state: { openAthleteId: athlete.id } });
                }}
              >
                <span className="session-editor-back-ico" aria-hidden="true">
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M10 3L5 8l5 5" />
                  </svg>
                </span>
                <span>{t("progressPhotosBack")}</span>
              </button>
              <header className="progress-photos-header">
                <div
                  className={`progress-photos-athlete-card${historyMode === "compare" ? " is-chip" : ""}`}
                >
                  <div className="progress-photos-athlete-row is-name">
                    <span className="progress-photos-athlete-label">
                      {t("progressPhotosInfoName")}
                    </span>
                    <span className="progress-photos-athlete-value">
                      {personName(athlete.profile) || athlete.email}
                    </span>
                  </div>
                  <div className="progress-photos-athlete-meta">
                    <div className="progress-photos-athlete-row is-email">
                      <span className="progress-photos-athlete-label">
                        {t("progressPhotosInfoEmail")}
                      </span>
                      <span className="progress-photos-athlete-value">{athlete.email}</span>
                    </div>
                    <span className="progress-photos-athlete-meta-sep" aria-hidden="true">
                      ·
                    </span>
                    <div className="progress-photos-athlete-row is-weight">
                      <span className="progress-photos-athlete-label">
                        {t("progressPhotosInfoCurrentWeight")}
                      </span>
                      <span className="progress-photos-athlete-value">
                        {data?.currentWeightKg != null ? `${data.currentWeightKg} kg` : "—"}
                      </span>
                    </div>
                  </div>
                </div>
              </header>
            </div>
          </div>
          {photosLoading ? (
            <p className="progress-photos-empty-lead">{t("progressPhotosLoading")}</p>
          ) : (
            <ProgressHistory
              payload={data}
              emptyLead={t("progressPhotosEmptyLead")}
              heightCm={athlete.profile.heightCm}
              onOpenPhoto={setLightbox}
              onModeChange={(mode) => {
                setHistoryMode(mode);
                if (mode !== "compare") clearAnalyze();
              }}
              analyzeWithAi={{
                canAccess: canAnalyze,
                state: analyzeState,
                onAnalyze: (yearMonths) => void runAnalyze(yearMonths),
              }}
            />
          )}
        </div>
        {lightbox ? (
          <div className="recommend-overlay open" onClick={() => setLightbox(null)}>
            <img src={lightbox} alt="" className="progress-photos-lightbox-img" />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div id="avances-view" className="avances-view">
      <div className="avances">
        <header className="avances-header">
          <h2 className="avances-title">{t("navAvances")}</h2>
          <p className="avances-lead">{t("avancesLead")}</p>
        </header>
        {loading ? (
          <div className="avances-loading">
            <div className="load-spinner visible" aria-hidden="true" />
            <span>{t("avancesLoading")}</span>
          </div>
        ) : null}
        {!loading && !athletes.length ? (
          <div className="avances-empty">
            <p className="avances-empty-title">{t("avancesEmptyTitle")}</p>
            <p className="avances-empty-lead">{t("avancesEmptyLead")}</p>
          </div>
        ) : null}
        {!loading && athletes.length ? (
          <div className="avances-list">
            {athletes.map((row) => (
              <button
                key={row.id}
                type="button"
                className="avances-athlete-btn"
                onClick={() => setAthlete(row)}
              >
                <span className="avances-athlete-name">{personName(row.profile) || row.email}</span>
                <span className="avances-athlete-email">{row.email}</span>
                <span className="avances-athlete-chevron" aria-hidden="true">
                  ›
                </span>
              </button>
            ))}
          </div>
        ) : null}
        {page < pages ? (
          <button type="button" className="students-load-more" onClick={() => void loadMore()}>
            {t("loadMore")}
          </button>
        ) : null}
      </div>
    </div>
  );
}

function normalizeAnalyzeSections(raw: AnalyzeAiSection[] | undefined): AnalyzeAiSection[] | null {
  if (!Array.isArray(raw) || !raw.length) return null;
  const sections: AnalyzeAiSection[] = [];
  for (const section of raw) {
    const title = typeof section?.title === "string" ? section.title.trim() : "";
    if (!title || !Array.isArray(section?.blocks)) continue;
    const blocks = [];
    for (const block of section.blocks) {
      const text = typeof block?.text === "string" ? block.text.trim() : "";
      if (!text) continue;
      if (block.type === "paragraph") {
        blocks.push({ type: "paragraph" as const, text });
      } else if (block.type === "subtitle") {
        const blockTitle = typeof block.title === "string" ? block.title.trim() : "";
        if (!blockTitle) continue;
        blocks.push({ type: "subtitle" as const, title: blockTitle, text });
      }
    }
    if (blocks.length) sections.push({ title, blocks });
  }
  return sections.length ? sections : null;
}
