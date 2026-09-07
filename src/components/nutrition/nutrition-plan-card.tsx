import { useState } from "react";

import { useI18n } from "@/context/i18n-context";
import type { NutritionPlan } from "@/types/nutrition";

export function NutritionPlanCard({
  plan,
  onDelete,
  onArchive,
}: {
  plan: NutritionPlan;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(plan.status === "active");

  return (
    <article className="athlete-nutrition-current-card">
      <button
        type="button"
        className="coach-plan-session-header"
        onClick={() => setOpen((value) => !value)}
      >
        <span className="coach-plan-session-title">{plan.title}</span>
        <span className="coach-plan-session-meta">
          <span className="coach-plan-meta-chip">
            <strong>{plan.targets.calories}</strong>
            <span>{t("calories")}</span>
          </span>
        </span>
      </button>
      {open ? (
        <div className="athlete-nutrition-detail">
          <div className="athlete-nutrition-macros">
            <span>
              {t("protein")}: {plan.targets.proteinG}g
            </span>
            <span>
              {t("carbs")}: {plan.targets.carbsG}g
            </span>
            <span>
              {t("fat")}: {plan.targets.fatG}g
            </span>
          </div>
          <div className="athlete-nutrition-timeline">
            {plan.meals.map((meal) => (
              <div key={`${meal.name}-${meal.time ?? ""}`} className="athlete-nutrition-meal">
                <strong>
                  {meal.time ? `${meal.time} · ` : ""}
                  {meal.name}
                </strong>
                <ul>
                  {meal.foods.map((food) => (
                    <li key={`${food.name}-${food.quantity}`}>
                      {food.name} {food.quantity}
                      {food.unit}
                    </li>
                  ))}
                </ul>
                {meal.notes ? <p>{meal.notes}</p> : null}
              </div>
            ))}
          </div>
          {plan.generalNotes ? <p>{plan.generalNotes}</p> : null}
          {onDelete && plan.status === "archived" ? (
            <button
              type="button"
              className="athlete-nutrition-archive-delete"
              onClick={() => onDelete(plan.id)}
            >
              {t("athleteNutritionDeleteConfirm")}
            </button>
          ) : null}
          {onArchive && plan.status === "active" ? (
            <button
              type="button"
              className="student-session-edit"
              onClick={() => onArchive(plan.id)}
            >
              {t("nutritionArchive")}
            </button>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
