import { useState, type ReactNode } from "react";

import { useI18n } from "@/context/i18n-context";
import type { MessageKey } from "@/i18n";
import {
  adminPlanKey,
  adminRoleKey,
  formatAdminDate,
  grantablePlansForRole,
  remainingFillColor,
  subscriptionRemainingProgress,
  toTimeMs,
} from "@/lib/admin";
import { goalLabelKey, sexLabelKey } from "@/lib/coach-athletes";
import { personName } from "@/lib/user-display";
import type { AdminUser } from "@/types/admin";
import type { PersonName } from "@/types/user";

export type AdminUserConfirm =
  | { kind: "grant"; user: AdminUser; plan: "premium" | "growth" | "pro"; durationDays: number }
  | { kind: "revoke"; user: AdminUser }
  | { kind: "delete"; user: AdminUser };

export function AdminUserRow({
  user,
  open,
  isSelf,
  busy,
  actionStatus,
  actionStatusKind,
  onToggle,
  onConfirm,
}: {
  user: AdminUser;
  open: boolean;
  isSelf: boolean;
  busy: boolean;
  actionStatus: string;
  actionStatusKind: "" | "ok" | "error";
  onToggle: () => void;
  onConfirm: (action: AdminUserConfirm) => void;
}) {
  const { t } = useI18n();
  const first = user.profile.firstName.trim();
  const last = user.profile.lastName.trim();
  const email = user.email.trim();
  const full = personName(user.profile) || email || "—";
  const initials =
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || email.charAt(0).toUpperCase() || "?";
  const plan = user.subscription.plan || "free";
  const role = user.role || "athlete";

  return (
    <div className={`student-row admin-user-row${open ? " is-open" : ""}`} data-id={user.id}>
      <div className="student-row-header admin-user-header">
        <button type="button" className="admin-user-expand" aria-expanded={open} onClick={onToggle}>
          <span className="student-row-avatar" aria-hidden="true">
            {initials}
          </span>
          <span className="student-row-meta">
            <span className="student-row-name-row">
              <span className="student-row-name">{full}</span>
              <span className="admin-user-badges">
                <span className="admin-user-badge admin-user-badge--role">
                  {t(adminRoleKey(role))}
                </span>
                <span
                  className={`admin-user-badge admin-user-badge--${plan === "free" ? "plan-free" : "plan-paid"}`}
                >
                  {t(adminPlanKey(plan))}
                </span>
              </span>
            </span>
            <span className="admin-user-subline">{email || "—"}</span>
          </span>
          <span className="student-row-chevron" aria-hidden="true" />
        </button>
        {isSelf ? null : (
          <button
            type="button"
            className="admin-user-delete-btn"
            aria-label={t("adminUsersDelete")}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onConfirm({ kind: "delete", user });
            }}
          >
            <span className="admin-user-delete-ico" aria-hidden="true">
              <AdminIcon kind="warning" />
            </span>
            <span>{t("adminUsersDelete")}</span>
          </button>
        )}
      </div>
      <div className="student-row-body">
        <AdminUserPanel
          user={user}
          busy={busy}
          actionStatus={actionStatus}
          actionStatusKind={actionStatusKind}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}

function AdminUserPanel({
  user,
  busy,
  actionStatus,
  actionStatusKind,
  onConfirm,
}: {
  user: AdminUser;
  busy: boolean;
  actionStatus: string;
  actionStatusKind: "" | "ok" | "error";
  onConfirm: (action: AdminUserConfirm) => void;
}) {
  const { t, lang } = useI18n();
  const first = user.profile.firstName.trim() || "—";
  const last = user.profile.lastName.trim() || "—";
  const goalKey = goalLabelKey(user.goal);
  const sexKey = sexLabelKey(user.profile.sex);

  return (
    <div className="admin-user-panel">
      <div className="admin-user-summary-grid">
        <InfoCard
          icon="calendar"
          title={t("adminUsersCardAccount")}
          facts={[
            { label: t("adminUsersCreated"), value: formatAdminDate(user.createdAt, lang) },
            { label: t("adminUsersLastLogin"), value: formatAdminDate(user.lastLoginAt, lang) },
          ]}
        />
        <InfoCard
          icon="calendar"
          title={t("adminUsersCardSubscription")}
          facts={[
            {
              label: t("adminUsersStarted"),
              value: formatAdminDate(user.subscription.startedAt, lang),
            },
            {
              label: t("adminUsersExpires"),
              value: formatAdminDate(user.subscription.expiresAt, lang),
            },
          ]}
          footer={<SubscriptionProgress subscription={user.subscription} />}
        />
        <RolePlanCard role={user.role} plan={user.subscription.plan} />
        <InfoCard
          icon="person"
          title={t("adminUsersCardCoach")}
          facts={[{ label: t("adminUsersCardCoach"), value: coachDisplay(user), hideLabel: true }]}
        />
      </div>
      <div className="admin-user-bottom-grid">
        <div className="admin-user-profile-card">
          <h4 className="admin-user-profile-title">{t("adminUsersProfilePersonal")}</h4>
          <div className="admin-user-profile-grid">
            <ProfileFact icon="person" label={t("adminUsersFirstName")} value={first} />
            <ProfileFact
              icon="ruler"
              label={t("adminUsersHeight")}
              value={user.profile.heightCm != null ? `${user.profile.heightCm} cm` : "—"}
            />
            <ProfileFact icon="person" label={t("adminUsersLastName")} value={last} />
            <ProfileFact
              icon="goal"
              label={t("adminUsersGoal")}
              value={goalKey ? t(goalKey) : user.goal ? String(user.goal) : "—"}
            />
            <ProfileFact icon="sex" label={t("adminUsersSex")} value={sexKey ? t(sexKey) : "—"} />
            <ProfileFact
              icon="calendar"
              label={t("adminUsersBirth")}
              value={formatAdminDate(user.profile.birthDate, lang)}
            />
          </div>
        </div>
        <SubscriptionActions
          key={`${user.id}-${user.subscription.plan}`}
          user={user}
          busy={busy}
          actionStatus={actionStatus}
          actionStatusKind={actionStatusKind}
          onConfirm={onConfirm}
        />
      </div>
    </div>
  );
}

function SubscriptionActions({
  user,
  busy,
  actionStatus,
  actionStatusKind,
  onConfirm,
}: {
  user: AdminUser;
  busy: boolean;
  actionStatus: string;
  actionStatusKind: "" | "ok" | "error";
  onConfirm: (action: AdminUserConfirm) => void;
}) {
  const { t } = useI18n();
  const plans = grantablePlansForRole(user.role);
  const current = user.subscription.plan || "free";
  const [plan, setPlan] = useState<"premium" | "growth" | "pro">(
    plans.includes(current as "premium" | "growth" | "pro")
      ? (current as "premium" | "growth" | "pro")
      : (plans[0] ?? "premium"),
  );
  const [days, setDays] = useState("5");

  if (user.role === "admin") {
    return (
      <div className="admin-user-actions">
        <p className="admin-user-actions-note">{t("adminUsersSubN_A")}</p>
      </div>
    );
  }

  if (!plans.length) return <div className="admin-user-actions" />;

  return (
    <div className="admin-user-actions">
      <p className="admin-user-actions-title">{t("adminUsersSubActions")}</p>
      <div className="admin-user-grant">
        <select
          className="admin-users-select"
          aria-label={t("adminUsersGrantPlan")}
          value={plan}
          onChange={(event) => setPlan(event.target.value as "premium" | "growth" | "pro")}
        >
          {plans.map((option) => (
            <option key={option} value={option}>
              {t(adminPlanKey(option))}
            </option>
          ))}
        </select>
        <input
          type="number"
          min={1}
          max={3650}
          className="admin-users-input"
          aria-label={t("adminUsersDurationDays")}
          value={days}
          onChange={(event) => setDays(event.target.value)}
        />
        <div className="admin-user-grant-actions">
          <button
            type="button"
            className="admin-user-grant-btn"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              const durationDays = Number(days);
              onConfirm({
                kind: "grant",
                user,
                plan,
                durationDays:
                  Number.isFinite(durationDays) && durationDays >= 1 ? durationDays : 30,
              });
            }}
          >
            {t("adminUsersGrant")}
          </button>
          <button
            type="button"
            className="admin-user-revoke-btn"
            hidden={current === "free"}
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onConfirm({ kind: "revoke", user });
            }}
          >
            {t("adminUsersRevoke")}
          </button>
        </div>
      </div>
      <p
        className={`admin-user-action-status${actionStatusKind === "ok" ? " is-ok" : ""}${actionStatusKind === "error" ? " is-error" : ""}`}
        hidden={!actionStatus}
      >
        {actionStatus}
      </p>
    </div>
  );
}

function InfoCard({
  icon,
  title,
  facts,
  footer,
}: {
  icon: AdminIconKind;
  title: string;
  facts: { label: string; value: string; hideLabel?: boolean }[];
  footer?: ReactNode;
}) {
  return (
    <div className="admin-user-info-card">
      <span className="admin-user-info-icon" aria-hidden="true">
        <AdminIcon kind={icon} />
      </span>
      <div className="admin-user-info-content">
        <p className="admin-user-info-title">{title}</p>
        <div className="admin-user-info-facts">
          {facts.map((fact) => (
            <div key={fact.label} className="admin-user-info-fact">
              {fact.hideLabel ? null : (
                <span className="admin-user-info-fact-label">{fact.label}</span>
              )}
              <span className="admin-user-info-fact-value">{fact.value || "—"}</span>
            </div>
          ))}
        </div>
        {footer}
      </div>
    </div>
  );
}

function RolePlanCard({
  role,
  plan,
}: {
  role: AdminUser["role"];
  plan: AdminUser["subscription"]["plan"];
}) {
  const { t } = useI18n();
  return (
    <div className="admin-user-info-card admin-user-info-card--role-plan">
      <span className="admin-user-info-icon" aria-hidden="true">
        <AdminIcon kind="shield" />
      </span>
      <div className="admin-user-info-content">
        <p className="admin-user-info-title">{t("adminUsersCardRolePlan")}</p>
        <p className="admin-user-role-plan-role">{t(adminRoleKey(role))}</p>
        <span className={`admin-user-role-plan-badge is-${plan === "free" ? "free" : "paid"}`}>
          {t(adminPlanKey(plan))}
        </span>
      </div>
    </div>
  );
}

function SubscriptionProgress({ subscription }: { subscription: AdminUser["subscription"] }) {
  const { t } = useI18n();
  const startMs = toTimeMs(subscription.startedAt);
  const endMs = toTimeMs(subscription.expiresAt);
  const hasPeriod = startMs != null && endMs != null && endMs > startMs;
  const remaining = hasPeriod ? (subscriptionRemainingProgress(subscription) ?? 0) : 0;
  const pct = Math.round(remaining * 10) / 10;
  const displayPct = hasPeriod && remaining > 0 && remaining < 3 ? Math.max(remaining, 3) : pct;
  const color = remainingFillColor(pct);

  return (
    <div
      className="admin-sub-progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label={t("adminUsersSubProgress")}
    >
      <div className="admin-sub-progress-track">
        <div
          className="admin-sub-progress-fill"
          style={{
            width: hasPeriod ? `${displayPct}%` : "0%",
            ...(hasPeriod
              ? {
                  background: color,
                  boxShadow: `0 0 10px color-mix(in srgb, ${color} 40%, transparent)`,
                }
              : {}),
          }}
        />
      </div>
      <p className="admin-sub-progress-meta">
        {progressLabel({ hasPeriod, pct, startMs, endMs, t })}
      </p>
    </div>
  );
}

function progressLabel({
  hasPeriod,
  pct,
  startMs,
  endMs,
  t,
}: {
  hasPeriod: boolean;
  pct: number;
  startMs: number | null;
  endMs: number | null;
  t: (key: MessageKey, vars?: Record<string, string | number>) => string;
}) {
  if (!hasPeriod || startMs == null || endMs == null) return t("adminUsersSubNoPeriod");
  const now = Date.now();
  if (now >= endMs) return `0% · ${t("adminUsersSubExpired")}`;
  if (now < startMs) {
    const daysUntilStart = Math.max(1, Math.ceil((startMs - now) / 86_400_000));
    const startsText =
      daysUntilStart === 1
        ? t("adminUsersSubStartsInOne")
        : t("adminUsersSubStartsInMany", { n: daysUntilStart });
    return `100% · ${startsText}`;
  }
  const daysLeft = Math.max(0, Math.ceil((endMs - now) / 86_400_000));
  const daysText =
    daysLeft === 1
      ? t("adminUsersSubDaysLeftOne")
      : t("adminUsersSubDaysLeftMany", { n: daysLeft });
  return `${Math.round(pct)}% · ${daysText}`;
}

function ProfileFact({
  icon,
  label,
  value,
}: {
  icon: AdminIconKind;
  label: string;
  value: string;
}) {
  return (
    <div className="admin-user-profile-fact">
      <span className="admin-user-profile-fact-icon" aria-hidden="true">
        <AdminIcon kind={icon} />
      </span>
      <div className="admin-user-profile-fact-text">
        <span className="admin-user-profile-fact-label">{label}</span>
        <span className="admin-user-profile-fact-value">{value || "—"}</span>
      </div>
    </div>
  );
}

function coachDisplay(user: AdminUser) {
  const direct = String(user.coachName || "").trim();
  if (direct) return direct;
  const profile = user.coach?.profile ?? user.coachProfile ?? user.coach;
  if (profile && "firstName" in profile) return personName(profile as PersonName) || "—";
  return "—";
}

type AdminIconKind = "calendar" | "person" | "shield" | "ruler" | "goal" | "sex" | "warning";

function AdminIcon({ kind }: { kind: AdminIconKind }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  if (kind === "calendar") {
    return (
      <svg {...common}>
        <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
        <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
      </svg>
    );
  }
  if (kind === "person") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5.5 19.5c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8" />
      </svg>
    );
  }
  if (kind === "shield") {
    return (
      <svg {...common}>
        <path d="M12 3 5 6.5v5.2c0 4.2 2.9 7.2 7 8.3 4.1-1.1 7-4.1 7-8.3V6.5L12 3Z" />
        <circle cx="12" cy="10.2" r="2.2" />
        <path d="M9.2 15.2c1.1-1.4 2.1-2 2.8-2s1.7.6 2.8 2" />
      </svg>
    );
  }
  if (kind === "ruler") {
    return (
      <svg {...common}>
        <path d="M4 16.5 16.5 4a2.1 2.1 0 0 1 3 3L7 19.5a2.1 2.1 0 0 1-3-3Z" />
        <path d="m8.5 9.5 1.5 1.5M11 7l1.5 1.5M13.5 4.5 15 6" />
      </svg>
    );
  }
  if (kind === "goal") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="8" />
        <circle cx="12" cy="12" r="4" />
        <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      </svg>
    );
  }
  if (kind === "sex") {
    return (
      <svg {...common}>
        <circle cx="10" cy="10" r="4.5" />
        <path d="M13.5 6.5 19 1.9M16.2 2h2.8v2.8" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 4.3 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </svg>
  );
}
