import type { ReactNode } from "react";

import { useI18n } from "@/context/i18n-context";
import {
  formatKcal,
  formatMonthYear,
  formatNutritionNumber,
  formatShortDate,
  mealIcon,
  sortNutritionPlans,
} from "@/lib/nutrition-plans";
import type { NutritionPlan } from "@/types/nutrition";

export function NutritionPlansList({
  plans,
  openCurrentId,
  openArchivedId,
  activeTitle,
  archivedTitle,
  currentSubtitle,
  archivedMeta,
  coachLayout = false,
  currentActions,
  onToggleCurrent,
  onToggleArchived,
  onDeleteArchived,
}: {
  plans: NutritionPlan[];
  openCurrentId: string | null;
  openArchivedId: string | null;
  activeTitle?: string;
  archivedTitle: string;
  currentSubtitle: (plan: NutritionPlan) => string;
  archivedMeta: (plan: NutritionPlan) => string;
  coachLayout?: boolean;
  currentActions?: (plan: NutritionPlan) => ReactNode;
  onToggleCurrent: (planId: string) => void;
  onToggleArchived: (planId: string) => void;
  onDeleteArchived?: (plan: NutritionPlan) => void;
}) {
  const { t, lang } = useI18n();
  const ordered = sortNutritionPlans(plans);
  const active = ordered.filter((plan) => plan.status !== "archived");
  const archived = ordered.filter((plan) => plan.status === "archived");

  return (
    <>
      {active.length ? (
        <section className="athlete-nutrition-section">
          {activeTitle ? <h3 className="athlete-nutrition-group-title">{activeTitle}</h3> : null}
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
                    <p className="athlete-nutrition-subtitle-line">{currentSubtitle(plan)}</p>
                    <MacrosRow targets={plan.targets} />
                    <div className="athlete-nutrition-current-footer">
                      <p className="athlete-nutrition-valid">
                        {t("athleteNutritionValidFrom", {
                          date: formatShortDate(plan.validFrom, lang),
                        })}
                      </p>
                      {coachLayout ? (
                        <div className="athlete-nutrition-current-footer-actions">
                          {currentActions?.(plan)}
                          <ViewPlanButton open={open} onClick={() => onToggleCurrent(plan.id)} />
                        </div>
                      ) : (
                        <ViewPlanButton open={open} onClick={() => onToggleCurrent(plan.id)} />
                      )}
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
            <h3 className="athlete-nutrition-group-title">{archivedTitle}</h3>
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
                  {onDeleteArchived ? (
                    <button
                      type="button"
                      className="athlete-nutrition-archive-delete"
                      aria-label={t("athleteNutritionDeleteAria")}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onDeleteArchived(plan);
                      }}
                    >
                      ✕
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className={`athlete-nutrition-archive-header${coachLayout ? " is-coach" : ""}`}
                    aria-expanded={open}
                    onClick={() => onToggleArchived(plan.id)}
                  >
                    <span className="athlete-nutrition-archive-heading">
                      <span className="athlete-nutrition-month">
                        {plan.title.trim() || formatMonthYear(plan.validFrom, lang)}
                      </span>
                      <span className="athlete-nutrition-archive-meta">{archivedMeta(plan)}</span>
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
    </>
  );
}

function ViewPlanButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  const { t } = useI18n();
  return (
    <button
      type="button"
      className="athlete-nutrition-view-btn"
      aria-expanded={open}
      onClick={onClick}
    >
      <span className="athlete-nutrition-view-label">
        {t(open ? "athleteNutritionHidePlan" : "athleteNutritionViewPlan")}
      </span>
      <span className="athlete-nutrition-view-arrow">{open ? "↑" : "→"}</span>
    </button>
  );
}

export function MacrosRow({ targets }: { targets: NutritionPlan["targets"] }) {
  const { t, lang } = useI18n();
  const items = [
    { kind: "kcal", value: formatKcal(targets.calories, lang), unit: "kcal" },
    {
      kind: "protein",
      value: formatNutritionNumber(targets.proteinG),
      unit: t("athleteNutritionProteinShort"),
    },
    {
      kind: "carbs",
      value: formatNutritionNumber(targets.carbsG),
      unit: t("athleteNutritionCarbsShort"),
    },
    {
      kind: "fat",
      value: formatNutritionNumber(targets.fatG),
      unit: t("athleteNutritionFatShort"),
    },
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

export function PlanBody({
  plan,
  includeTargets,
}: {
  plan: NutritionPlan;
  includeTargets: boolean;
}) {
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
              const qty = formatNutritionNumber(food.quantity);
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
