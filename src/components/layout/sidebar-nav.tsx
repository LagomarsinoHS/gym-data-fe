import { NavLink, useLocation } from "react-router-dom";

import { useAuth } from "@/context/auth-context";
import { useI18n } from "@/context/i18n-context";
import type { MessageKey } from "@/i18n";
import { canAccessRecommendPlan, isAdmin, isAthlete, isCoach } from "@/lib/capabilities";

type NavItem = {
  to: string;
  label: MessageKey;
  locked?: boolean;
  lockHint?: MessageKey;
  pro?: boolean;
  dot?: boolean;
  active?: boolean;
  end?: boolean;
};

function NavGroup({
  label,
  items,
  onNavigate,
}: {
  label: string;
  items: NavItem[];
  onNavigate?: () => void;
}) {
  const { t } = useI18n();

  return (
    <div className="sidebar-nav-group">
      <div className="sidebar-nav-label">{label}</div>
      <div className="sidebar-nav-group-items">
        {items.map((item) => {
          if (item.locked) {
            return (
              <span
                key={item.to}
                className="sidebar-nav-btn is-locked"
                title={item.lockHint ? t(item.lockHint) : t("comingSoon")}
              >
                <span className="sidebar-nav-marker" aria-hidden="true" />
                <span>{t(item.label)}</span>
                {item.pro ? <ProBadge /> : null}
                {item.dot ? <span className="sidebar-nav-dot" /> : null}
              </span>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end === true}
              className={({ isActive }) =>
                `sidebar-nav-btn${(item.active ?? isActive) ? " is-active" : ""}`
              }
              aria-current={undefined}
              {...(onNavigate ? { onClick: onNavigate } : {})}
            >
              <span className="sidebar-nav-marker" aria-hidden="true" />
              <span>{t(item.label)}</span>
              {item.pro ? <ProBadge /> : null}
              {item.dot ? <span className="sidebar-nav-dot" /> : null}
            </NavLink>
          );
        })}
      </div>
    </div>
  );
}

function ProBadge() {
  return (
    <span className="sidebar-nav-pro">
      <span className="sidebar-nav-pro-emoji" aria-hidden="true">
        ✨
      </span>
      <span className="sidebar-nav-pro-label">Pro</span>
    </span>
  );
}

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { user, pendingInvite } = useAuth();
  const { t } = useI18n();
  const { pathname } = useLocation();
  const recommendUnlocked = canAccessRecommendPlan(user);
  const templatesActive = pathname === "/plantillas" || pathname.startsWith("/plantillas/");
  const studentsActive = pathname === "/alumnos" || pathname.startsWith("/alumnos/");

  return (
    <nav className="sidebar-nav" aria-label="App">
      {isAthlete(user) ? (
        <NavGroup
          label={t("navGroupPlan")}
          {...(onNavigate ? { onNavigate } : {})}
          items={[
            { to: "/entrenamiento", label: "myTraining" },
            { to: "/plan-coach", label: "coachPlan", dot: Boolean(pendingInvite) },
            { to: "/nutricion", label: "navNutrition" },
            { to: "/avances", label: "athleteAvances" },
            {
              to: "/recomendar",
              label: "recommendPlan",
              pro: true,
              locked: !recommendUnlocked,
              lockHint: "recommendPlanLocked",
            },
          ]}
        />
      ) : null}

      {isCoach(user) ? (
        <NavGroup
          label={t("navGroupCoach")}
          {...(onNavigate ? { onNavigate } : {})}
          items={[
            { to: "/panel", label: "coachPanel" },
            { to: "/plantillas", label: "coachTemplates", active: templatesActive },
            { to: "/alumnos", label: "myStudents", active: studentsActive },
            { to: "/coach/nutricion", label: "navNutrition" },
            { to: "/coach/avances", label: "navAvances" },
          ]}
        />
      ) : null}

      {isAdmin(user) ? (
        <NavGroup
          label={t("navGroupAdmin")}
          {...(onNavigate ? { onNavigate } : {})}
          items={[
            { to: "/admin", label: "adminOverview", end: true },
            { to: "/admin/usuarios", label: "adminUsers" },
          ]}
        />
      ) : null}

      {!isAdmin(user) ? (
        <NavGroup
          label={t("navGroupExplore")}
          {...(onNavigate ? { onNavigate } : {})}
          items={[{ to: "/", label: "catalog" }]}
        />
      ) : null}
    </nav>
  );
}
