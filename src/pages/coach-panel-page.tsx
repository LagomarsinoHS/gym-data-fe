import { useEffect, useRef, useState } from "react";

import { listCoachAthletes, listCoachInvites } from "@/api/users";
import { useI18n } from "@/context/i18n-context";
import type { MessageKey } from "@/i18n";
import type { Lang } from "@/lib/prefs";
import { personName } from "@/lib/user-display";
import type { CoachAthlete, CoachInvite, CoachInviteStatus } from "@/types/user";

const STATS_PAGE_LIMIT = 50;
const INVITES_PAGE_LIMIT = 10;

const FILTERS: { status: CoachInviteStatus | ""; label: MessageKey }[] = [
  { status: "", label: "coachPanelInvitesFilterAll" },
  { status: "pending", label: "coachPanelInvitesFilterPending" },
  { status: "accepted", label: "coachPanelInvitesFilterAccepted" },
  { status: "rejected", label: "coachPanelInvitesFilterRejected" },
  { status: "cancelled", label: "coachPanelInvitesFilterCancelled" },
];

export function CoachPanelPage() {
  const { t, lang } = useI18n();
  const [stats, setStats] = useState<{ total: number; withoutPlan: number } | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState("");
  const [invites, setInvites] = useState<CoachInvite[]>([]);
  const [filter, setFilter] = useState<CoachInviteStatus | "">("");
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(0);
  const [invitesLoading, setInvitesLoading] = useState(true);
  const [invitesError, setInvitesError] = useState("");
  const [loadingMore, setLoadingMore] = useState(false);
  const statsSeq = useRef(0);
  const invitesSeq = useRef(0);

  useEffect(() => {
    const seq = ++statsSeq.current;
    setStatsLoading(true);
    setStats(null);
    setStatsError("");
    void fetchAthleteStats()
      .then((next) => {
        if (seq !== statsSeq.current) return;
        setStats(next);
      })
      .catch(() => {
        if (seq !== statsSeq.current) return;
        setStatsError(t("coachPanelLoadFail"));
      })
      .finally(() => {
        if (seq === statsSeq.current) setStatsLoading(false);
      });
  }, [t]);

  useEffect(() => {
    void loadInvites(filter, false);
  }, [filter]);

  async function loadInvites(status: CoachInviteStatus | "", append: boolean) {
    if (append && (invitesLoading || loadingMore || page >= pages || pages === 0)) return;
    const seq = ++invitesSeq.current;
    const nextPage = append ? page + 1 : 1;
    setInvitesError("");
    if (append) setLoadingMore(true);
    else {
      setInvitesLoading(true);
      setInvites([]);
      setPage(0);
      setPages(0);
    }
    try {
      const data = await listCoachInvites({
        page: nextPage,
        limit: INVITES_PAGE_LIMIT,
        ...(status ? { status } : {}),
      });
      if (seq !== invitesSeq.current) return;
      const rows = data.data ?? [];
      setInvites((prev) => (append ? [...prev, ...rows] : rows));
      setPage(data.page ?? nextPage);
      setPages(data.pages ?? 0);
    } catch {
      if (seq !== invitesSeq.current) return;
      if (!append) setInvites([]);
      setInvitesError(t("coachPanelInvitesLoadFail"));
    } finally {
      if (seq === invitesSeq.current) {
        setInvitesLoading(false);
        setLoadingMore(false);
      }
    }
  }

  const hasInvites = invites.length > 0;
  const showMore = hasInvites && page < pages;

  return (
    <div id="coach-panel-view" className="recommend-view">
      <div className="coach-panel">
        <header className="coach-panel-header">
          <h2 className="coach-panel-title">{t("coachPanel")}</h2>
          <p className="coach-panel-lead">{t("coachPanelLead")}</p>
        </header>

        <div className="coach-panel-loading" hidden={!statsLoading}>
          <div className="load-spinner visible" aria-hidden="true" />
          <span>{t("coachPanelLoading")}</span>
        </div>

        <div className="coach-panel-stats" hidden={!stats} aria-live="polite">
          <div className="coach-panel-stat">
            <p className="coach-panel-stat-value">{stats?.total ?? ""}</p>
            <p className="coach-panel-stat-label">{t("coachPanelTotalAthletes")}</p>
          </div>
          <div className="coach-panel-stat">
            <p className="coach-panel-stat-value">{stats?.withoutPlan ?? ""}</p>
            <p className="coach-panel-stat-label">{t("coachPanelWithoutPlan")}</p>
          </div>
        </div>

        <p className={`coach-panel-status${statsError ? " is-error" : ""}`} hidden={!statsError}>
          {statsError}
        </p>

        <section className="coach-panel-invites" aria-labelledby="coach-panel-invites-title">
          <header className="coach-panel-invites-header">
            <h3 className="coach-panel-invites-title" id="coach-panel-invites-title">
              {t("coachPanelInvitesTitle")}
            </h3>
            <p className="coach-panel-invites-lead">{t("coachPanelInvitesLead")}</p>
          </header>

          <div
            className="coach-panel-invites-filters"
            role="tablist"
            aria-label={t("coachPanelInvitesTitle")}
          >
            {FILTERS.map((item) => {
              const active = filter === item.status;
              return (
                <button
                  key={item.label}
                  type="button"
                  className={`coach-panel-invites-filter${active ? " is-active" : ""}`}
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    if (item.status === filter) return;
                    setFilter(item.status);
                  }}
                >
                  <span>{t(item.label)}</span>
                </button>
              );
            })}
          </div>

          <div className="coach-panel-invites-loading" hidden={!invitesLoading}>
            <div className="load-spinner visible" aria-hidden="true" />
          </div>

          <p className="coach-panel-invites-empty" hidden={invitesLoading || hasInvites}>
            {t(filter ? "coachPanelInvitesEmptyFilter" : "coachPanelInvitesEmpty")}
          </p>

          <ul className="coach-panel-invites-list" hidden={!hasInvites}>
            {invites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} />
            ))}
          </ul>

          <button
            type="button"
            className="coach-panel-invites-more"
            hidden={!showMore}
            disabled={loadingMore}
            onClick={() => void loadInvites(filter, true)}
          >
            <span>{t("coachPanelInvitesLoadMore")}</span>
          </button>

          <p
            className={`coach-panel-invites-status${invitesError ? " is-error" : ""}`}
            hidden={!invitesError}
          >
            {invitesError}
          </p>
        </section>
      </div>
    </div>
  );
}

function InviteRow({ invite }: { invite: CoachInvite }) {
  const { t, lang } = useI18n();
  const name = personName(invite.athlete);
  const title = name || invite.email || "—";

  return (
    <li className="coach-panel-invite" data-status={invite.status}>
      <div className="coach-panel-invite-top">
        <div className="coach-panel-invite-main">
          <p className="coach-panel-invite-title">{title}</p>
          {name && invite.email ? <p className="coach-panel-invite-email">{invite.email}</p> : null}
        </div>
        <span className={`coach-panel-invite-status-pill is-${invite.status}`}>
          {inviteStatusLabel(invite, t)}
        </span>
      </div>
      <div className="coach-panel-invite-dates">
        <InviteDate label={t("coachPanelInvitesInvitedAt")} value={invite.invitedAt} lang={lang} />
        {invite.respondedAt ? (
          <InviteDate
            label={t("coachPanelInvitesRespondedAt")}
            value={invite.respondedAt}
            lang={lang}
          />
        ) : null}
      </div>
    </li>
  );
}

function InviteDate({ label, value, lang }: { label: string; value: string; lang: Lang }) {
  return (
    <div className="coach-panel-invite-date">
      <span className="coach-panel-invite-date-label">{label}</span>
      <span className="coach-panel-invite-date-value">{formatInviteDate(value, lang)}</span>
    </div>
  );
}

function inviteStatusLabel(invite: CoachInvite, t: (key: MessageKey) => string) {
  if (invite.status === "accepted") return t("coachPanelInvitesStatusAccepted");
  if (invite.status === "rejected") return t("coachPanelInvitesStatusRejected");
  if (invite.status === "cancelled") return t("coachPanelInvitesStatusCancelled");
  if (invite.status === "pending") {
    return invite.athleteId
      ? t("coachPanelInvitesStatusAwaitingAccept")
      : t("coachPanelInvitesStatusAwaitingRegister");
  }
  return t("coachPanelInvitesStatusPending");
}

function athleteHasPlan(athlete: CoachAthlete) {
  const program = athlete.coachTrainingProgram;
  if (!Array.isArray(program) || program.length === 0) return false;
  return program.some((session) => Array.isArray(session.items) && session.items.length > 0);
}

async function fetchAthleteStats() {
  let page = 1;
  let pages = 1;
  let total = 0;
  let withoutPlan = 0;
  do {
    const payload = await listCoachAthletes({ page, limit: STATS_PAGE_LIMIT });
    const items = payload.data ?? [];
    total = payload.total ?? total;
    pages = payload.pages || 1;
    withoutPlan += items.filter((athlete) => !athleteHasPlan(athlete)).length;
    page += 1;
  } while (page <= pages);
  return { total, withoutPlan };
}

function formatInviteDate(value: string | null | undefined, lang: Lang) {
  if (!value) return "—";
  const raw = String(value).trim();
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(Number(raw.slice(0, 4)), Number(raw.slice(5, 7)) - 1, Number(raw.slice(8, 10)), 12)
    : new Date(raw);
  if (Number.isNaN(date.getTime())) return "—";
  if (lang === "es") {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("es-ES", { year: "numeric", month: "long", day: "2-digit" })
        .formatToParts(date)
        .filter((part) => part.type !== "literal")
        .map((part) => [part.type, part.value]),
    );
    return `${parts["year"]}-${parts["month"]}-${parts["day"]}`;
  }
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}
