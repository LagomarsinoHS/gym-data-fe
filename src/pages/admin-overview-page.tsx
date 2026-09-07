import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getAdminStats } from "@/api/admin";
import { useI18n } from "@/context/i18n-context";
import type { AdminStats } from "@/types/admin";

export function AdminOverviewPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    void getAdminStats()
      .then((next) => {
        if (!cancelled) setStats(next);
      })
      .catch(() => {
        if (!cancelled) {
          setStats(null);
          setError(true);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const expiring = stats?.subscriptions.paidExpiringSoon ?? 0;
  const last7 = stats?.signups.last7Days ?? 0;
  const last30 = stats?.signups.last30Days ?? 0;

  return (
    <div id="admin-overview-view" className="recommend-view">
      <div className="admin-overview">
        <header className="admin-overview-header">
          <h2 className="admin-overview-title">{t("adminOverview")}</h2>
          <p className="admin-overview-lead">{t("adminOverviewLead")}</p>
        </header>

        <div className="admin-overview-loading" hidden={!loading}>
          <div className="load-spinner visible" aria-hidden="true" />
          <span>{t("adminOverviewLoading")}</span>
        </div>

        <p className={`admin-overview-status${error ? " is-error" : ""}`} hidden={!error}>
          {error ? t("adminOverviewLoadFail") : ""}
        </p>

        <div className="admin-overview-body" hidden={!stats || loading}>
          <section className="admin-overview-panel" aria-labelledby="admin-overview-users-title">
            <h3 className="admin-overview-panel-title" id="admin-overview-users-title">
              {t("adminSectionUsers")}
            </h3>
            <div className="admin-overview-kpi-row">
              <Kpi value={stats?.users.total} label={t("adminUsersTotalShort")} />
              <Kpi value={stats?.users.byRole.athlete} label={t("adminUsersAthletes")} />
              <Kpi value={stats?.users.byRole.coach} label={t("adminUsersCoaches")} />
              <Kpi value={stats?.users.byRole.admin} label={t("adminUsersAdmins")} />
            </div>
            <p className="admin-overview-panel-foot">{t("adminUsersDelta30", { n: last30 })}</p>
          </section>

          <div className="admin-overview-split">
            <section className="admin-overview-panel" aria-labelledby="admin-overview-subs-title">
              <h3 className="admin-overview-panel-title is-start" id="admin-overview-subs-title">
                {t("adminSectionSubs")}
              </h3>
              <ul className="admin-overview-plan-list">
                <li>
                  <span className="admin-overview-plan-count">
                    {kpi(stats?.subscriptions.byPlan.free)}
                  </span>
                  <span>{t("adminPlanFree")}</span>
                </li>
                <li>
                  <span className="admin-overview-plan-count">
                    {kpi(stats?.subscriptions.byPlan.premium)}
                  </span>
                  <span>{t("adminPlanPremium")}</span>
                </li>
                <li>
                  <span className="admin-overview-plan-count">
                    {kpi(stats?.subscriptions.byPlan.growth)}
                  </span>
                  <span>{t("adminPlanGrowth")}</span>
                </li>
                <li>
                  <span className="admin-overview-plan-count">
                    {kpi(stats?.subscriptions.byPlan.pro)}
                  </span>
                  <span>{t("adminPlanPro")}</span>
                </li>
              </ul>
              <button
                type="button"
                className="admin-overview-link"
                onClick={() => navigate("/admin/usuarios")}
              >
                <span>{t("adminOverviewOpenUsers")}</span>
                <span aria-hidden="true">→</span>
              </button>
            </section>

            <section
              className="admin-overview-panel"
              aria-labelledby="admin-overview-activity-title"
            >
              <h3
                className="admin-overview-panel-title is-start"
                id="admin-overview-activity-title"
              >
                {t("adminSectionActivity")}
              </h3>
              <ul className="admin-overview-activity-list">
                <li>{t("adminActivity30", { n: last30 })}</li>
                <li>{t("adminActivity7", { n: last7 })}</li>
              </ul>
            </section>
          </div>

          <section
            className="admin-overview-panel admin-overview-panel--attention"
            hidden={expiring <= 0}
            aria-labelledby="admin-overview-attention-title"
          >
            <h3 className="admin-overview-panel-title is-start" id="admin-overview-attention-title">
              {t("adminSectionAttention")}
            </h3>
            <p className="admin-overview-attention-copy">
              {t(expiring === 1 ? "adminAttentionExpiringOne" : "adminAttentionExpiringMany", {
                n: expiring,
              })}
            </p>
            <button
              type="button"
              className="admin-overview-link admin-overview-link--end"
              onClick={() => navigate("/admin/usuarios", { state: { expiringSoon: true } })}
            >
              <span>{t("adminOverviewOpenExpiring")}</span>
              <span aria-hidden="true">→</span>
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}

function Kpi({ value, label }: { value: number | undefined; label: string }) {
  return (
    <div className="admin-overview-kpi">
      <p className="admin-overview-kpi-value">{kpi(value)}</p>
      <p className="admin-overview-kpi-label">{label}</p>
    </div>
  );
}

function kpi(value: number | undefined) {
  return value == null ? "—" : String(value);
}
