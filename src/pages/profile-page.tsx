import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

import { deleteAccount, leaveCoach, updateProfile, uploadProfilePhoto } from "@/api/users";
import { ProgressPhotoLightbox } from "@/components/progress/progress-photo-lightbox";
import { useAuth } from "@/context/auth-context";
import { useI18n } from "@/context/i18n-context";
import { isAthlete, isCoach, isPaidPlan } from "@/lib/capabilities";
import { fullName, initials, personName, roleLabel } from "@/lib/user-display";
import type { MessageKey } from "@/i18n";
import type { Lang } from "@/lib/prefs";
import type { MeUser, PersonName, UserGoal, UserSex } from "@/types/user";

const SEX_OPTIONS: { value: UserSex; key: MessageKey }[] = [
  { value: "male", key: "profileSexMale" },
  { value: "female", key: "profileSexFemale" },
  { value: "other", key: "profileSexOther" },
  { value: "prefer_not_to_say", key: "profileSexPreferNot" },
];

const GOAL_OPTIONS: { value: UserGoal; key: MessageKey }[] = [
  { value: "strength", key: "profileGoalStrength" },
  { value: "hypertrophy", key: "profileGoalHypertrophy" },
  { value: "fat_loss", key: "profileGoalFatLoss" },
  { value: "general", key: "profileGoalGeneral" },
];

const SOON_ACTIONS = [
  {
    id: "notifications",
    title: "profileActionNotifications",
    hint: "profileActionNotificationsHint",
    icon: "bell",
  },
  {
    id: "privacy",
    title: "profileActionPrivacy",
    hint: "profileActionPrivacyHint",
    icon: "privacy",
  },
  {
    id: "coach-link",
    title: "profileActionCoachLink",
    hint: "profileActionCoachLinkHint",
    icon: "link",
    athleteOnly: true,
  },
  { id: "billing", title: "profileActionBilling", hint: "profileActionBillingHint", icon: "card" },
  { id: "export", title: "profileActionExport", hint: "profileActionExportHint", icon: "download" },
] as const;

export function ProfilePage() {
  const { user, applyUser, logout } = useAuth();
  const { t, lang } = useI18n();
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [deactivateOpen, setDeactivateOpen] = useState(false);
  const [deactivateEmail, setDeactivateEmail] = useState("");
  const [deactivateError, setDeactivateError] = useState("");
  const [leaveError, setLeaveError] = useState("");
  const [photoMenu, setPhotoMenu] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(false);
  const photoInput = useRef<HTMLInputElement>(null);
  const avatarWrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!photoMenu) return;
    const onDoc = (event: MouseEvent) => {
      if (!avatarWrap.current?.contains(event.target as Node)) setPhotoMenu(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [photoMenu]);

  if (!user) return null;

  const photoUrl = user.profilePhoto?.url?.trim() || "";
  const planKey = planMessageKey(user.subscription.plan);
  const paid = isPaidPlan(user);

  async function onSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") || "");
    const newPassword = String(form.get("newPassword") || "");
    const confirmNewPassword = String(form.get("confirmNewPassword") || "");
    if (newPassword || confirmNewPassword || currentPassword) {
      if (!currentPassword || !newPassword || !confirmNewPassword) {
        setStatus(t("profileEditPasswordIncomplete"));
        return;
      }
      if (newPassword !== confirmNewPassword) {
        setStatus(t("profileEditPasswordMismatch"));
        return;
      }
      if (newPassword.length < 4) {
        setStatus(t("profileEditPasswordShort"));
        return;
      }
    }
    setBusy(true);
    setStatus("");
    try {
      applyUser(
        await updateProfile({
          profile: {
            firstName: String(form.get("firstName") || ""),
            lastName: String(form.get("lastName") || ""),
            heightCm: form.get("heightCm") ? Number(form.get("heightCm")) : null,
            sex: (String(form.get("sex") || "") as UserSex) || null,
            birthDate: String(form.get("birthDate") || "") || null,
          },
          goal: (String(form.get("goal") || "") as UserGoal) || null,
          ...(newPassword ? { currentPassword, newPassword, confirmNewPassword } : {}),
        }),
      );
      setEditing(false);
    } catch {
      setStatus(t("profileEditError"));
    } finally {
      setBusy(false);
    }
  }

  async function onPhoto(file?: File) {
    if (!file) return;
    try {
      applyUser(await uploadProfilePhoto(file));
    } catch {
      window.alert(t("profileAvatarUploadError"));
    }
  }

  async function onLeaveCoach() {
    setLeaveError("");
    try {
      applyUser(await leaveCoach());
      setLeaveOpen(false);
    } catch {
      setLeaveError(t("profileLeaveCoachError"));
    }
  }

  async function onDeactivate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (deactivateEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
      setDeactivateError(t("profileDeactivateMismatch"));
      return;
    }
    setDeactivateError("");
    try {
      await deleteAccount(deactivateEmail);
      logout();
    } catch {
      setDeactivateError(t("profileDeactivateError"));
    }
  }

  const facts = detailFacts(user, t, lang);
  const height =
    user.profile.heightCm != null && Number.isFinite(user.profile.heightCm)
      ? `${user.profile.heightCm} cm`
      : "—";

  return (
    <div id="profile-view" className="profile-view">
      <div className="profile">
        <header className="profile-header">
          <p className="profile-kicker">{t("profileIdentity")}</p>
          <h2 className="profile-title">{t("myProfile")}</h2>
        </header>

        <section className="profile-hero-row">
          <article className={`profile-split${editing ? " is-editing" : ""}`}>
            <div className="profile-split-side">
              <div className="profile-split-identity">
                <div
                  className={`profile-avatar-wrap${photoMenu ? " is-menu-open" : ""}`}
                  ref={avatarWrap}
                >
                  <button
                    type="button"
                    className={`profile-avatar is-interactive${photoUrl ? " has-photo" : ""}`}
                    aria-haspopup="menu"
                    aria-expanded={photoMenu}
                    aria-label={t("profileAvatarMenu")}
                    onClick={(event) => {
                      event.stopPropagation();
                      setPhotoMenu((open) => !open);
                    }}
                  >
                    {photoUrl ? (
                      <img className="profile-avatar-img" src={photoUrl} alt="" />
                    ) : (
                      initials(user)
                    )}
                  </button>
                  <div className="profile-avatar-menu" hidden={!photoMenu} role="menu">
                    {photoUrl ? (
                      <button
                        type="button"
                        className="profile-avatar-menu-item"
                        role="menuitem"
                        onClick={() => {
                          setPhotoMenu(false);
                          setViewPhoto(true);
                        }}
                      >
                        {t("profileAvatarView")}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="profile-avatar-menu-item"
                      role="menuitem"
                      onClick={() => {
                        setPhotoMenu(false);
                        photoInput.current?.click();
                      }}
                    >
                      {t("profileAvatarUpload")}
                    </button>
                  </div>
                  <input
                    ref={photoInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    hidden
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0];
                      event.currentTarget.value = "";
                      void onPhoto(file);
                    }}
                  />
                </div>
                <h2 className="profile-name">{fullName(user)}</h2>
                <p className="profile-email">{user.email}</p>
                <div className="profile-badges">
                  <span className={`profile-badge is-role-${user.role}`}>
                    {roleLabel(user.role, t)}
                  </span>
                  <span className={`profile-badge ${paid ? "is-plan-paid" : "is-plan-free"}`}>
                    {t(planKey)}
                  </span>
                </div>
              </div>

              {isAthlete(user) ? (
                <div className={`profile-split-coach${user.coachId ? "" : " is-empty"}`}>
                  <p className="profile-coach-kicker">{t("profileCoachStatus")}</p>
                  <div className="profile-coach-body">
                    <div className="profile-avatar profile-avatar--coach" aria-hidden="true">
                      {user.coachId ? coachInitials(user.coach) : "—"}
                    </div>
                    <div className="profile-coach-text">
                      <p className="profile-coach-name">
                        {user.coachId
                          ? personName(user.coach) || t("profileCoachLinked")
                          : t("profileCoachNone")}
                      </p>
                    </div>
                  </div>
                  {user.coachId ? (
                    <button
                      type="button"
                      className="profile-coach-leave"
                      onClick={() => setLeaveOpen(true)}
                    >
                      {t("profileLeaveCoach")}
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div className={`profile-split-main${editing ? " is-editing" : ""}`}>
              <div className="profile-split-view" hidden={editing}>
                <div className="profile-split-head">
                  <h3 className="profile-split-title">{t("profilePersonalInfo")}</h3>
                  <button
                    type="button"
                    className="profile-split-edit-btn"
                    onClick={() => {
                      setStatus("");
                      setEditing(true);
                    }}
                  >
                    {t("profileEditShort")}
                  </button>
                </div>
                <div className="profile-split-facts">
                  {facts.map((fact) => (
                    <div
                      key={fact.label}
                      className={`profile-detail${fact.tone ? ` is-${fact.tone}` : ""}`}
                    >
                      <span className="profile-detail-label">{fact.label}</span>
                      <span className="profile-detail-value">{fact.value}</span>
                    </div>
                  ))}
                </div>
                <div className="profile-split-metrics">
                  {isAthlete(user) ? (
                    <article className="profile-metric is-weight">
                      <span className="profile-metric-ico" aria-hidden="true">
                        <WeightIcon />
                      </span>
                      <div className="profile-metric-body">
                        <span className="profile-metric-label">{t("profileWeight")}</span>
                        <span className="profile-metric-value">
                          {user.currentWeightKg != null ? `${user.currentWeightKg} kg` : "—"}
                        </span>
                      </div>
                    </article>
                  ) : null}
                  <article className="profile-metric is-height">
                    <span className="profile-metric-ico" aria-hidden="true">
                      <HeightIcon />
                    </span>
                    <div className="profile-metric-body">
                      <span className="profile-metric-label">{t("profileHeight")}</span>
                      <span className="profile-metric-value">{height}</span>
                    </div>
                  </article>
                </div>
              </div>

              {editing ? (
                <section className="profile-edit" aria-labelledby="profile-edit-title">
                  <div className="profile-edit-head">
                    <h3 className="profile-edit-title" id="profile-edit-title">
                      {t("profileEditTitle")}
                    </h3>
                    <p className="profile-edit-lead">{t("profileEditLead")}</p>
                  </div>
                  <form className="profile-edit-form" onSubmit={(event) => void onSave(event)}>
                    <div className="profile-edit-grid">
                      <label className="profile-edit-field">
                        <span className="profile-edit-label">{t("profileEditFirstName")}</span>
                        <input
                          name="firstName"
                          defaultValue={user.profile.firstName}
                          required
                          autoComplete="given-name"
                        />
                      </label>
                      <label className="profile-edit-field">
                        <span className="profile-edit-label">{t("profileEditLastName")}</span>
                        <input
                          name="lastName"
                          defaultValue={user.profile.lastName}
                          required
                          autoComplete="family-name"
                        />
                      </label>
                      <label className="profile-edit-field">
                        <span className="profile-edit-label">{t("profileHeight")}</span>
                        <input
                          name="heightCm"
                          type="number"
                          min={120}
                          max={230}
                          defaultValue={user.profile.heightCm ?? ""}
                        />
                      </label>
                      <label className="profile-edit-field">
                        <span className="profile-edit-label">{t("profileEditBirthDate")}</span>
                        <input
                          name="birthDate"
                          type="date"
                          defaultValue={user.profile.birthDate ?? ""}
                        />
                      </label>
                      <label className="profile-edit-field">
                        <span className="profile-edit-label">{t("profileEditSex")}</span>
                        <select name="sex" defaultValue={user.profile.sex ?? ""}>
                          <option value="">{t("profileEditOptionalEmpty")}</option>
                          {SEX_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {t(option.key)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="profile-edit-field">
                        <span className="profile-edit-label">{t("profileEditGoal")}</span>
                        <select name="goal" defaultValue={user.goal ?? ""}>
                          <option value="">{t("profileEditOptionalEmpty")}</option>
                          {GOAL_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {t(option.key)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <div className="profile-edit-password">
                      <p className="profile-edit-subtitle">{t("profileEditPasswordTitle")}</p>
                      <div className="profile-edit-grid profile-edit-grid--password">
                        <label className="profile-edit-field">
                          <span className="profile-edit-label">
                            {t("profileEditCurrentPassword")}
                          </span>
                          <input name="currentPassword" type="password" autoComplete="off" />
                        </label>
                        <label className="profile-edit-field">
                          <span className="profile-edit-label">{t("profileEditNewPassword")}</span>
                          <input name="newPassword" type="password" autoComplete="new-password" />
                        </label>
                        <label className="profile-edit-field">
                          <span className="profile-edit-label">
                            {t("profileEditConfirmPassword")}
                          </span>
                          <input
                            name="confirmNewPassword"
                            type="password"
                            autoComplete="new-password"
                          />
                        </label>
                      </div>
                    </div>
                    {status ? <p className="profile-edit-status is-error">{status}</p> : null}
                    <div className="profile-edit-actions">
                      <button
                        type="button"
                        className="profile-edit-cancel"
                        onClick={() => setEditing(false)}
                      >
                        {t("profileEditCancel")}
                      </button>
                      <button type="submit" className="profile-edit-save" disabled={busy}>
                        {busy ? t("profileEditSaving") : t("profileEditSave")}
                      </button>
                    </div>
                  </form>
                </section>
              ) : null}
            </div>
          </article>
        </section>

        <section className="profile-actions profile-actions--available">
          <div className="profile-actions-head">
            <h3 className="profile-actions-title">{t("profileAvailableTitle")}</h3>
            <p className="profile-actions-lead">{t("profileAvailableLead")}</p>
          </div>
          <div className="profile-actions-list">
            <ActionButton
              title={t("profileActionEdit")}
              hint={t("profileActionEditHint")}
              icon={<EditIcon />}
              enabled
              active={editing}
              onClick={() => {
                setStatus("");
                setEditing((open) => !open);
              }}
            />
            <ActionButton
              title={t("profileActionDeactivate")}
              hint={t("profileActionDeactivateHint")}
              icon={<WarnIcon />}
              enabled
              danger
              onClick={() => {
                setDeactivateEmail("");
                setDeactivateError("");
                setDeactivateOpen(true);
              }}
            />
          </div>
        </section>

        <section className="profile-actions profile-actions--soon">
          <div className="profile-actions-head">
            <h3 className="profile-actions-title">{t("profileActionsTitle")}</h3>
            <p className="profile-actions-lead">{t("profileActionsLead")}</p>
          </div>
          <div className="profile-actions-list">
            {SOON_ACTIONS.filter((action) => !("athleteOnly" in action) || isAthlete(user)).map(
              (action) => (
                <ActionButton
                  key={action.id}
                  title={t(action.title)}
                  hint={t(action.hint)}
                  icon={<ActionIcon kind={action.icon} />}
                  soonLabel={t("profileSoon")}
                />
              ),
            )}
          </div>
        </section>
      </div>

      {leaveOpen ? (
        <div
          className="recommend-overlay open"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLeaveOpen(false);
          }}
        >
          <div className="recommend-modal confirm-modal">
            <div className="recommend-modal-header">
              <h2 className="recommend-modal-title">{t("profileLeaveCoachTitle")}</h2>
              <button type="button" className="modal-close" onClick={() => setLeaveOpen(false)}>
                ✕
              </button>
            </div>
            <p className="confirm-modal-lead">{t("profileLeaveCoachLead")}</p>
            {leaveError ? <p className="recommend-status is-error">{leaveError}</p> : null}
            <div className="confirm-modal-actions">
              <button
                type="button"
                className="confirm-modal-cancel"
                onClick={() => setLeaveOpen(false)}
              >
                {t("profileLeaveCoachCancel")}
              </button>
              <button
                type="button"
                className="confirm-modal-danger"
                onClick={() => void onLeaveCoach()}
              >
                {t("profileLeaveCoachConfirm")}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deactivateOpen ? (
        <div
          className="recommend-overlay open"
          role="dialog"
          aria-modal="true"
          onClick={(event) => {
            if (event.target === event.currentTarget) setDeactivateOpen(false);
          }}
        >
          <div className="recommend-modal confirm-modal">
            <div className="recommend-modal-header">
              <h2 className="recommend-modal-title">{t("profileDeactivateTitle")}</h2>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeactivateOpen(false)}
              >
                ✕
              </button>
            </div>
            <p className="confirm-modal-lead">{t("profileDeactivateLead")}</p>
            <form
              className="recommend-form confirm-modal-form"
              onSubmit={(event) => void onDeactivate(event)}
            >
              <label className="recommend-field">
                <span className="recommend-label">{t("email")}</span>
                <input
                  type="email"
                  name="email"
                  required
                  autoComplete="off"
                  value={deactivateEmail}
                  onChange={(event) => setDeactivateEmail(event.target.value)}
                />
              </label>
              {deactivateError ? (
                <p className="recommend-status is-error">{deactivateError}</p>
              ) : null}
              <div className="confirm-modal-actions">
                <button
                  type="button"
                  className="confirm-modal-cancel"
                  onClick={() => setDeactivateOpen(false)}
                >
                  {t("profileDeactivateCancel")}
                </button>
                <button
                  type="submit"
                  className="confirm-modal-danger"
                  disabled={
                    deactivateEmail.trim().toLowerCase() !== user.email.trim().toLowerCase()
                  }
                >
                  {t("profileDeactivateConfirm")}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <ProgressPhotoLightbox
        open={viewPhoto && Boolean(photoUrl)}
        items={
          photoUrl
            ? [{ url: photoUrl, title: t("profileAvatarViewTitle"), side: "front" }]
            : []
        }
        index={0}
        firstName={user.profile.firstName}
        lastName={user.profile.lastName}
        onClose={() => setViewPhoto(false)}
      />
    </div>
  );
}

function ActionButton({
  title,
  hint,
  icon,
  enabled,
  danger,
  active,
  soonLabel,
  onClick,
}: {
  title: string;
  hint: string;
  icon: ReactNode;
  enabled?: boolean;
  danger?: boolean;
  active?: boolean;
  soonLabel?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`profile-action${enabled ? " is-enabled" : ""}${danger ? " is-danger" : ""}${active ? " is-active" : ""}`}
      disabled={!enabled}
      aria-disabled={!enabled}
      title={enabled ? undefined : soonLabel}
      onClick={onClick}
    >
      <span className="profile-action-ico" aria-hidden="true">
        {icon}
      </span>
      <span className="profile-action-body">
        <span className="profile-action-title">{title}</span>
        <span className="profile-action-hint">{hint}</span>
      </span>
      {!enabled && soonLabel ? <span className="profile-action-soon">{soonLabel}</span> : null}
    </button>
  );
}

function detailFacts(
  user: MeUser,
  t: (key: MessageKey) => string,
  lang: Lang,
): { label: string; value: string; tone?: string }[] {
  const facts = [
    { label: t("profileRole"), value: roleLabel(user.role, t) },
    {
      label: t("profilePlan"),
      value: t(planMessageKey(user.subscription.plan)),
      tone: isPaidPlan(user) ? "paid" : undefined,
    },
    { label: t("profileMemberSince"), value: formatDate(user.createdAt, lang) },
    { label: t("profilePlanSince"), value: formatDate(user.subscription.startedAt, lang) },
    { label: t("profilePlanExpires"), value: formatDate(user.subscription.expiresAt, lang) },
    {
      label: t("profileSex"),
      value: SEX_OPTIONS.find((option) => option.value === user.profile.sex)
        ? t(SEX_OPTIONS.find((option) => option.value === user.profile.sex)!.key)
        : "—",
    },
    { label: t("profileBirthDate"), value: formatDate(user.profile.birthDate, lang) },
    {
      label: t("profileAge"),
      value: ageFromBirthDate(user.profile.birthDate)?.toString() ?? "—",
    },
    {
      label: t("profileGoal"),
      value: GOAL_OPTIONS.find((option) => option.value === user.goal)
        ? t(GOAL_OPTIONS.find((option) => option.value === user.goal)!.key)
        : "—",
    },
  ];

  if (isCoach(user) && user.coachQuota) {
    const { athleteCount, athleteLimit, canInvite } = user.coachQuota;
    facts.push({
      label: t("profileAthletesQuota"),
      value: `${athleteCount ?? 0} / ${athleteLimit == null ? "∞" : athleteLimit}`,
    });
    facts.push({
      label: t("profileCanInvite"),
      value: canInvite ? t("profileInviteOpen") : t("profileInviteFull"),
      tone: canInvite ? "ok" : "warn",
    });
  }

  return facts;
}

function planMessageKey(plan: MeUser["subscription"]["plan"]): MessageKey {
  if (plan === "premium") return "planPremium";
  if (plan === "growth") return "planGrowth";
  if (plan === "pro") return "planPro";
  return "planFree";
}

function coachInitials(coach?: PersonName | null) {
  if (!coach) return "?";
  const letters =
    `${coach.firstName.trim().charAt(0)}${coach.lastName.trim().charAt(0)}`.toUpperCase();
  return letters.trim() || "?";
}

function formatDate(value: string | null | undefined, lang: Lang) {
  if (!value) return "—";
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = match
    ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12)
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  if (lang === "es") {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("es-ES", { year: "numeric", month: "long", day: "2-digit" })
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${parts.year}-${parts.month}-${parts.day}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

function ageFromBirthDate(birthDate?: string | null) {
  const match = String(birthDate || "")
    .slice(0, 10)
    .match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 12);
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

function iconProps(children: ReactNode) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function WeightIcon() {
  return iconProps(
    <>
      <rect x="4" y="5" width="16" height="12" rx="2" />
      <path d="M8 17v2" />
      <path d="M16 17v2" />
      <path d="M8 11h8" />
      <circle cx="12" cy="9" r="1.2" />
    </>,
  );
}

function HeightIcon() {
  return iconProps(
    <>
      <path d="M12 3v18" />
      <path d="M8 6h8" />
      <path d="M9 21h6" />
      <path d="M7 12h4" />
      <path d="M13 16h4" />
    </>,
  );
}

function EditIcon() {
  return iconProps(
    <>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </>,
  );
}

function WarnIcon() {
  return iconProps(
    <>
      <path d="M12 3 2 20h20L12 3z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </>,
  );
}

function ActionIcon({ kind }: { kind: "bell" | "privacy" | "link" | "card" | "download" }) {
  if (kind === "bell") {
    return iconProps(
      <>
        <path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7" />
        <path d="M10 20a2 2 0 0 0 4 0" />
      </>,
    );
  }
  if (kind === "privacy") {
    return iconProps(<path d="M12 3 4 7v5c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V7l-8-4z" />);
  }
  if (kind === "link") {
    return iconProps(
      <>
        <path d="M9 8H7a4 4 0 0 0 0 8h2" />
        <path d="M15 8h2a4 4 0 0 1 0 8h-2" />
        <path d="M9 12h6" />
      </>,
    );
  }
  if (kind === "card") {
    return iconProps(
      <>
        <rect x="3" y="6" width="18" height="13" rx="2" />
        <path d="M3 10h18" />
        <path d="M7 15h4" />
      </>,
    );
  }
  return iconProps(
    <>
      <path d="M12 3v12" />
      <path d="m7 10 5 5 5-5" />
      <path d="M5 21h14" />
    </>,
  );
}
