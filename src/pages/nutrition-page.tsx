import { useEffect, useState } from "react";

import { deleteNutritionPlan, listNutritionPlans } from "@/api/nutrition-plans";
import { NutritionPlanCard } from "@/components/nutrition/nutrition-plan-card";
import { useI18n } from "@/context/i18n-context";
import type { NutritionPlan } from "@/types/nutrition";

export function NutritionPage() {
  const { t } = useI18n();
  const [plans, setPlans] = useState<NutritionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await listNutritionPlans();
      setPlans(data.data ?? []);
    } catch {
      setError(t("athleteNutritionLoadFail"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const active = plans.filter((plan) => plan.status !== "archived");
  const archived = plans.filter((plan) => plan.status === "archived");

  async function onDelete(id: string) {
    if (!window.confirm(t("athleteNutritionDeleteTitle"))) return;
    await deleteNutritionPlan(id);
    setPlans((prev) => prev.filter((plan) => plan.id !== id));
  }

  return (
    <section className="athlete-nutrition-view">
      {loading ? <p>{t("athleteNutritionLoading")}</p> : null}
      {error ? (
        <div>
          <p>{error}</p>
          <button type="button" className="empty-state-cta" onClick={() => void load()}>
            {t("athleteNutritionRetry")}
          </button>
        </div>
      ) : null}
      {!loading && !error && !plans.length ? (
        <div className="empty-state">
          <p>🥗</p>
          <p>{t("athleteNutritionEmpty")}</p>
          <p>{t("athleteNutritionEmptyLead")}</p>
        </div>
      ) : null}
      {active.map((plan) => (
        <NutritionPlanCard key={plan.id} plan={plan} />
      ))}
      {archived.length ? (
        <h2 className="student-plan-title">{t("athleteNutritionArchived")}</h2>
      ) : null}
      {archived.map((plan) => (
        <NutritionPlanCard key={plan.id} plan={plan} onDelete={(id) => void onDelete(id)} />
      ))}
    </section>
  );
}
