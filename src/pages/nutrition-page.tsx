import { useEffect, useState } from "react";

import { deleteNutritionPlan, listNutritionPlans } from "@/api/nutrition-plans";
import { RecommendOverlay } from "@/components/coach/recommend-overlay";
import { NutritionPlansList } from "@/components/nutrition/nutrition-plan-list";
import { useI18n } from "@/context/i18n-context";
import { formatKcal, formatMonthYear, sortNutritionPlans } from "@/lib/nutrition-plans";
import { personName } from "@/lib/user-display";
import type { NutritionPlan } from "@/types/nutrition";

export function NutritionPage() {
  const { t, lang } = useI18n();
  const [plans, setPlans] = useState<NutritionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [openCurrentId, setOpenCurrentId] = useState<string | null>(null);
  const [openArchivedId, setOpenArchivedId] = useState<string | null>(null);
  const [pending, setPending] = useState<NutritionPlan | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(false);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      const data = await listNutritionPlans();
      const next = sortNutritionPlans(data.data ?? []);
      setPlans(next);
      if (
        openCurrentId &&
        !next.some((plan) => plan.id === openCurrentId && plan.status !== "archived")
      ) {
        setOpenCurrentId(null);
      }
      if (
        openArchivedId &&
        !next.some((plan) => plan.id === openArchivedId && plan.status === "archived")
      ) {
        setOpenArchivedId(null);
      }
    } catch {
      setPlans([]);
      setError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!pending) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || deleteBusy) return;
      event.stopImmediatePropagation();
      closeDelete();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pending, deleteBusy]);

  function closeDelete() {
    if (deleteBusy) return;
    setPending(null);
    setDeleteError(false);
  }

  async function confirmDelete() {
    if (!pending || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError(false);
    try {
      await deleteNutritionPlan(pending.id);
      setPlans((prev) => prev.filter((plan) => plan.id !== pending.id));
      if (openArchivedId === pending.id) setOpenArchivedId(null);
      setPending(null);
    } catch {
      setDeleteError(true);
    } finally {
      setDeleteBusy(false);
    }
  }

  const hasPlans = plans.length > 0;

  return (
    <div id="athlete-nutrition-view" className="athlete-nutrition-view">
      <div className="athlete-nutrition">
        <header className="athlete-nutrition-header">
          <h2 className="athlete-nutrition-title">{t("athleteNutritionTitle")}</h2>
        </header>

        <div className="athlete-nutrition-loading" hidden={!loading}>
          <div className="load-spinner visible" aria-hidden="true" />
          <span>{t("athleteNutritionLoading")}</span>
        </div>

        <div className="athlete-nutrition-error" hidden={loading || !error}>
          <p>{t("athleteNutritionLoadFail")}</p>
          <button type="button" className="recommend-again-btn" onClick={() => void load()}>
            <span>{t("athleteNutritionRetry")}</span>
          </button>
        </div>

        <div className="athlete-nutrition-empty" hidden={loading || error || hasPlans}>
          <h2 className="athlete-nutrition-empty-title">{t("athleteNutritionEmpty")}</h2>
          <p className="athlete-nutrition-empty-lead">{t("athleteNutritionEmptyLead")}</p>
        </div>

        <div className="athlete-nutrition-body" hidden={loading || error || !hasPlans}>
          <NutritionPlansList
            plans={plans}
            openCurrentId={openCurrentId}
            openArchivedId={openArchivedId}
            activeTitle={t("athleteNutritionActive")}
            archivedTitle={t("athleteNutritionArchived")}
            currentSubtitle={(plan) => {
              const title = plan.title.trim();
              const coach = `${t("athleteNutritionCoach")}: ${personName(plan.coach) || "—"}`;
              return title ? `${title} • ${coach}` : coach;
            }}
            archivedMeta={(plan) =>
              `${formatKcal(plan.targets.calories, lang)} kcal • ${personName(plan.coach) || "—"}`
            }
            onToggleCurrent={(planId) => {
              setOpenCurrentId((current) => (current === planId ? null : planId));
              setOpenArchivedId(null);
            }}
            onToggleArchived={(planId) => {
              setOpenArchivedId((current) => (current === planId ? null : planId));
              setOpenCurrentId(null);
            }}
            onDeleteArchived={(plan) => {
              if (deleteBusy) return;
              setDeleteError(false);
              setPending(plan);
            }}
          />
        </div>
      </div>

      <RecommendOverlay
        open={Boolean(pending)}
        confirm
        titleId="athlete-nutrition-delete-title"
        title={t("athleteNutritionDeleteTitle")}
        onClose={closeDelete}
      >
        <p className="confirm-modal-name">
          {pending
            ? (() => {
                const title = pending.title.trim();
                const month = formatMonthYear(pending.validFrom, lang);
                return title ? `${month} · ${title}` : month;
              })()
            : ""}
        </p>
        <p className="confirm-modal-lead">{t("athleteNutritionDeleteLead")}</p>
        <p className="recommend-status is-error" hidden={!deleteError}>
          {deleteError ? t("athleteNutritionDeleteFail") : ""}
        </p>
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-cancel"
            disabled={deleteBusy}
            onClick={closeDelete}
          >
            {t("athleteNutritionDeleteCancel")}
          </button>
          <button
            type="button"
            className="confirm-modal-danger"
            disabled={deleteBusy}
            onClick={() => void confirmDelete()}
          >
            {t("athleteNutritionDeleteConfirm")}
          </button>
        </div>
      </RecommendOverlay>
    </div>
  );
}
