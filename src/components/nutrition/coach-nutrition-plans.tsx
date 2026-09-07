import { useState } from "react";

import { archiveNutritionPlan } from "@/api/nutrition-plans";
import { NutritionPlansList } from "@/components/nutrition/nutrition-plan-list";
import { useI18n } from "@/context/i18n-context";
import { formatKcal } from "@/lib/nutrition-plans";
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

  const showEditor = editor;
  const showList = !showEditor && !loading && !error && plans.length > 0;
  const showEmpty = !showEditor && !loading && !error && !plans.length;

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
        <NutritionPlansList
          plans={plans}
          openCurrentId={openCurrentId}
          openArchivedId={openArchivedId}
          archivedTitle={t("nutritionPlanArchived")}
          currentSubtitle={(plan) => plan.title.trim() || "—"}
          archivedMeta={(plan) =>
            `${formatKcal(plan.targets.calories, lang)} kcal • ${personName(plan.athlete) || "—"}`
          }
          coachLayout
          currentActions={(plan) => (
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
          )}
          onToggleCurrent={(planId) => {
            setOpenCurrentId((current) => (current === planId ? null : planId));
            setOpenArchivedId(null);
          }}
          onToggleArchived={(planId) => {
            setOpenArchivedId((current) => (current === planId ? null : planId));
            setOpenCurrentId(null);
          }}
        />
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
