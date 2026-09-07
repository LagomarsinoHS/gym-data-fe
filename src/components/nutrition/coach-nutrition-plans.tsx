import { useMemo, useState } from "react";

import { archiveNutritionPlan } from "@/api/nutrition-plans";
import { useI18n } from "@/context/i18n-context";
import type { Lang } from "@/lib/prefs";
import { personName } from "@/lib/user-display";
import type { NutritionPlan } from "@/types/nutrition";

export function CoachNutritionPlans({
  plans,
  loading,
  error,
  hidden = false,
  onRetry,
  onPlansChange,
}: {
  plans: NutritionPlan[];
  loading: boolean;
  error: boolean;
  hidden?: boolean;
  onRetry: () => void;
  onPlansChange: (plans: NutritionPlan[]) => void;
}) {
  const { t, lang } = useI18n();
  const [openCurrentId, setOpenCurrentId] = useState<string | null>(null);
  const [openArchivedId, setOpenArchivedId] = useState<string | null>(null);
  const [editor, setEditor] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState(false);

  const ordered = useMemo(() => sortPlans(plans), [plans]);
  const active = ordered.filter((plan) => plan.status !== "archived");
  const archived = ordered.filter((plan) => plan.status === "archived");
  const showEditor = editor;
  const showList = !showEditor && !loading && !error && ordered.length > 0;
  const showEmpty = !showEditor && !loading && !error && !ordered.length;

  async function onArchive(plan: NutritionPlan) {
    if (archiveBusy) return;
    if (!window.confirm(t("nutritionPlanArchiveConfirm"))) return;
    setArchiveBusy(true);
    try {
      const next = await archiveNutritionPlan(plan.id);
      onPlansChange(plans.map((row) => (row.id === plan.id ? next : row)));
      if (openCurrentId === plan.id) setOpenCurrentId(null);
    } catch {
      window.alert(t("nutritionPlanArchiveFail"));
    } finally {
      setArchiveBusy(false);
    }
  }

  return (
    <section className="nutrition-plan" id="nutrition-plan" hidden={hidden}>
      <div className="nutrition-plan-toolbar" id="nutrition-plan-toolbar" hidden={!showList}>
        <button type="button" className="athlete-nutrition-new-btn" onClick={() => setEditor(true)}>
          <span>{t("nutritionPlanNew")}</span>
        </button>
      </div>

      <div className="nutrition-plan-loading" hidden={showEditor || !loading}>
        <div className="load-spinner visible" aria-hidden="true" />
        <span>{t("nutritionPlanLoading")}</span>
      </div>

      <div className="nutrition-plan-error" hidden={showEditor || loading || !error}>
        <p>{t("nutritionPlanLoadFail")}</p>
        <button type="button" className="recommend-again-btn" onClick={onRetry}>
          <span>{t("nutritionPlanRetry")}</span>
        </button>
      </div>

      <div className="nutrition-plan-empty" hidden={!showEmpty}>
        <h3 className="nutrition-plan-empty-title">{t("nutritionPlanEmpty")}</h3>
        <p className="nutrition-plan-empty-lead">{t("nutritionPlanEmptyLead")}</p>
        <button type="button" className="recommend-cta" onClick={() => setEditor(true)}>
          <span>{t("nutritionPlanCreate")}</span>
        </button>
      </div>

      <div className="nutrition-plan-body athlete-nutrition-body" hidden={!showList}>
        {active.length ? (
          <section className="athlete-nutrition-section">
            <div className="athlete-nutrition-current-list">
              {active.map((plan) => {
                const open = openCurrentId === plan.id;
                return (
                  <article
                    key={plan.id}
                    className={`athlete-nutrition-current-card${open ? " is-open" : ""}`}
                    data-plan-id={plan.id}
                  >
                    <div className="athlete-nutrition-current-summary">
                      <div className="athlete-nutrition-current-top">
                        <span className="athlete-nutrition-month">
                          {formatMonthYear(plan.validFrom, lang)}
                        </span>
                        <span className="athlete-nutrition-status">
                          {t("athleteNutritionStatusActive")}
                        </span>
                      </div>
                      <p className="athlete-nutrition-subtitle-line">{plan.title.trim() || "—"}</p>
                      <MacrosRow targets={plan.targets} />
                      <div className="athlete-nutrition-current-footer">
                        <p className="athlete-nutrition-valid">
                          {t("athleteNutritionValidFrom", {
                            date: formatShortDate(plan.validFrom, lang),
                          })}
                        </p>
                        <div className="athlete-nutrition-current-footer-actions">
                          <button
                            type="button"
                            className="recommend-again-btn nutrition-plan-archive-btn"
                            disabled={archiveBusy}
                            onClick={(event) => {
                              event.preventDefault();
                              event.stopPropagation();
                              void onArchive(plan);
                            }}
                          >
                            {t("nutritionPlanArchive")}
                          </button>
                          <button
                            type="button"
                            className="athlete-nutrition-view-btn"
                            aria-expanded={open}
                            onClick={() => {
                              setOpenCurrentId(open ? null : plan.id);
                              setOpenArchivedId(null);
                            }}
                          >
                            <span className="athlete-nutrition-view-label">
                              {t(open ? "athleteNutritionHidePlan" : "athleteNutritionViewPlan")}
                            </span>
                            <span className="athlete-nutrition-view-arrow">{open ? "↑" : "→"}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="athlete-nutrition-detail">
                      {open ? <PlanBody plan={plan} includeTargets={false} /> : null}
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        ) : null}

        {archived.length ? (
          <section className="athlete-nutrition-section is-archived">
            <div className="athlete-nutrition-group-header is-archived">
              <h3 className="athlete-nutrition-group-title">{t("nutritionPlanArchived")}</h3>
              <hr className="athlete-nutrition-group-rule" aria-hidden="true" />
            </div>
            <div className="athlete-nutrition-archive-list">
              {archived.map((plan) => {
                const open = openArchivedId === plan.id;
                return (
                  <section
                    key={plan.id}
                    className={`athlete-nutrition-archive-item${open ? " is-open" : ""}`}
                    data-plan-id={plan.id}
                  >
                    <button
                      type="button"
                      className="athlete-nutrition-archive-header is-coach"
                      aria-expanded={open}
                      onClick={() => {
                        setOpenArchivedId(open ? null : plan.id);
                        setOpenCurrentId(null);
                      }}
                    >
                      <span className="athlete-nutrition-archive-heading">
                        <span className="athlete-nutrition-month">
                          {plan.title.trim() || formatMonthYear(plan.validFrom, lang)}
                        </span>
                        <span className="athlete-nutrition-archive-meta">
                          {`${formatKcal(plan.targets.calories, lang)} kcal • ${personName(plan.athlete) || "—"}`}
                        </span>
                      </span>
                      <span className="athlete-nutrition-chevron" aria-hidden="true" />
                    </button>
                    <div className="athlete-nutrition-detail">
                      {open ? <PlanBody plan={plan} includeTargets /> : null}
                    </div>
                  </section>
                );
              })}
            </div>
          </section>
        ) : null}
      </div>

      <div className="nutrition-plan-editor" hidden={!showEditor}>
        <button type="button" className="session-editor-back" onClick={() => setEditor(false)}>
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
          <span>{t("nutritionPlanEditorBack")}</span>
        </button>
        <h3 className="nutrition-plan-editor-title">{t("nutritionPlanEditorTitle")}</h3>
        <p className="nutrition-plan-editor-lead">{t("nutritionPlanEditorLead")}</p>
      </div>
    </section>
  );
}

function MacrosRow({ targets }: { targets: NutritionPlan["targets"] }) {
  const { t, lang } = useI18n();
  const items = [
    { kind: "kcal", value: formatKcal(targets.calories, lang), unit: "kcal" },
    {
      kind: "protein",
      value: formatNumber(targets.proteinG),
      unit: t("athleteNutritionProteinShort"),
    },
    { kind: "carbs", value: formatNumber(targets.carbsG), unit: t("athleteNutritionCarbsShort") },
    { kind: "fat", value: formatNumber(targets.fatG), unit: t("athleteNutritionFatShort") },
  ];
  return (
    <div className="athlete-nutrition-macros">
      {items.map((item) => (
        <span key={item.kind} className={`athlete-nutrition-macro is-${item.kind}`}>
          <span className={`athlete-nutrition-macro-icon is-${item.kind}`} aria-hidden="true">
            {item.kind === "kcal" ? "🔥" : item.unit}
          </span>
          <strong>{item.value}</strong>
          {` ${item.unit}`}
        </span>
      ))}
    </div>
  );
}

function PlanBody({ plan, includeTargets }: { plan: NutritionPlan; includeTargets: boolean }) {
  const { t } = useI18n();
  const meals = plan.meals ?? [];
  const notes = plan.generalNotes?.trim() ?? "";
  return (
    <div className="athlete-nutrition-plan-content">
      {includeTargets ? <MacrosRow targets={plan.targets} /> : null}
      {meals.length ? (
        <MealsTimeline meals={meals} />
      ) : (
        <>
          <h4 className="athlete-nutrition-subtitle">{t("athleteNutritionMeals")}</h4>
          <p className="athlete-nutrition-muted">{t("athleteNutritionNoMeals")}</p>
        </>
      )}
      {notes ? (
        <>
          <h4 className="athlete-nutrition-subtitle">{t("athleteNutritionNotes")}</h4>
          <p className="athlete-nutrition-notes">{notes}</p>
        </>
      ) : null}
    </div>
  );
}

function MealsTimeline({ meals }: { meals: NutritionPlan["meals"] }) {
  return (
    <div className="athlete-nutrition-timeline">
      <div className="athlete-nutrition-timeline-rail" aria-hidden="true">
        <span className="athlete-nutrition-timeline-cap is-sun">☀️</span>
        <span className="athlete-nutrition-timeline-line" />
        <span className="athlete-nutrition-timeline-cap is-moon">🌙</span>
      </div>
      <div className="athlete-nutrition-timeline-list">
        {meals.map((meal, index) => {
          const foods = (meal.foods ?? [])
            .map((food) => {
              const qty = formatNumber(food.quantity);
              const unit = String(food.unit || "").trim();
              const name = String(food.name || "").trim() || "—";
              return unit ? `${qty} ${unit} ${name}` : `${qty} ${name}`;
            })
            .join(" • ");
          const mealNotes = meal.notes?.trim() ?? "";
          return (
            <article key={`${meal.name}-${index}`} className="athlete-nutrition-timeline-item">
              <span className="athlete-nutrition-timeline-dot" aria-hidden="true" />
              <span className="athlete-nutrition-meal-time">{meal.time?.trim() || "—"}</span>
              <div className="athlete-nutrition-meal">
                <div className="athlete-nutrition-meal-main">
                  <span className="athlete-nutrition-meal-icon" aria-hidden="true">
                    {mealIcon(index, meals.length)}
                  </span>
                  <h5 className="athlete-nutrition-meal-name">{meal.name.trim() || "—"}</h5>
                  {foods ? <p className="athlete-nutrition-meal-foods">{foods}</p> : null}
                </div>
                <p
                  className="athlete-nutrition-meal-notes"
                  aria-hidden={mealNotes ? undefined : true}
                >
                  {mealNotes}
                </p>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function sortPlans(plans: NutritionPlan[]) {
  return [...plans].sort((a, b) => {
    const aArchived = a.status === "archived" ? 1 : 0;
    const bArchived = b.status === "archived" ? 1 : 0;
    if (aArchived !== bArchived) return aArchived - bArchived;
    return String(b.validFrom || "").localeCompare(String(a.validFrom || ""));
  });
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

function formatMonthYear(value: string | null | undefined, lang: Lang) {
  const date = parsePlanDate(value);
  if (!date) return "—";
  const raw = new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-ES", {
    month: "long",
    year: "numeric",
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatShortDate(value: string | null | undefined, lang: Lang) {
  const date = parsePlanDate(value);
  if (!date) return "—";
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "es-ES", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatKcal(value: number, lang: Lang) {
  if (!Number.isFinite(value)) return "—";
  return new Intl.NumberFormat(lang === "en" ? "en-US" : "es-CL", {
    maximumFractionDigits: 0,
  }).format(Math.round(value));
}

function formatNumber(value: number) {
  if (!Number.isFinite(value)) return "—";
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
}

function mealIcon(index: number, total: number) {
  if (total <= 1) return "☀️";
  if (index === 0) return "🌅";
  if (index === total - 1) return "🌙";
  if (index === 1) return "☀️";
  return "🥗";
}
