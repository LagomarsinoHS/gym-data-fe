import { Link } from "react-router-dom";

import { SessionList } from "@/components/sessions/session-list";
import { useAuth } from "@/context/auth-context";
import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { personName } from "@/lib/user-display";

export function CoachPlanPage() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { search } = useCatalog();
  const sessions = user?.coachTrainingProgram ?? [];
  const hasCoach = Boolean(user?.coachId);

  if (!hasCoach) {
    return (
      <section className="recommend-view">
        <div className="recommend-panel">
          <h1 className="recommend-title">{t("coachPlanEmpty")}</h1>
          <p className="recommend-lead">{t("coachPlanEmptyLead")}</p>
          <Link to="/" className="recommend-cta">
            {t("goToCatalog")}
          </Link>
        </div>
      </section>
    );
  }

  if (!sessions.length) {
    return (
      <section className="recommend-view">
        <div className="recommend-panel">
          <h1 className="recommend-title">{t("coachPlan")}</h1>
          <p className="recommend-lead">
            {user?.coach ? `${personName(user.coach)}. ` : ""}
            {t("coachPlanProgramEmpty")}
          </p>
        </div>
      </section>
    );
  }

  return (
    <div className="training-view">
      <div className="coach-plan-results-header">
        <h1 className="student-plan-title">{t("coachPlan")}</h1>
        <p className="recommend-lead">{t("coachPlanLead")}</p>
      </div>
      <SessionList sessions={sessions} search={search} />
    </div>
  );
}
