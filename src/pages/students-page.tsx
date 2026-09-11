import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { applyCoachTemplates, getCoachTemplates } from "@/api/coach-templates";
import {
  exportCoachTrainingProgram,
  inviteAthlete,
  listCoachAthletes,
  listCoachInvites,
  setAthleteCoachProgram,
} from "@/api/users";
import { RecommendOverlay, SearchIcon } from "@/components/coach/recommend-overlay";
import { StudentPlan } from "@/components/coach/student-plan";
import { useAuth } from "@/context/auth-context";
import { ASSIGN_CATALOG_STATE, useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { canInviteAthlete } from "@/lib/capabilities";
import {
  ageFromBirthDate,
  athleteHasPlan,
  athleteHasTemplate,
  goalLabelKey,
  inviteErrorKey,
  markNewAthleteSeen,
  readSeenNewAthletes,
  sexLabelKey,
} from "@/lib/coach-athletes";
import {
  getStudentsRoster,
  readStudentsRoster,
  writeStudentsRoster,
  writeStudentsRosterNewIds,
} from "@/lib/students-cache";
import { newSessionId } from "@/lib/training-sessions";
import { personName } from "@/lib/user-display";
import type { CoachAthlete, TrainingSession } from "@/types/user";

const PAGE_SIZE = 5;
const SEARCH_DEBOUNCE_MS = 500;
const NEW_ACCEPT_MS = 48 * 60 * 60 * 1000;
const SUCCESS_CLOSE_MS = 1200;

type SortMode = "default" | "without-plan" | "with-plan";

export function StudentsPage() {
  const { t, lang } = useI18n();
  const { user, refreshUser } = useAuth();
  const { setAssignTarget } = useCatalog();
  const navigate = useNavigate();
  const location = useLocation();
  const openFromState =
    (location.state as { openAthleteId?: string } | null)?.openAthleteId ?? null;
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const cachedRoster = readStudentsRoster("");
  const [athletes, setAthletes] = useState<CoachAthlete[]>(cachedRoster?.athletes ?? []);
  const [page, setPage] = useState(cachedRoster?.page ?? 1);
  const [pages, setPages] = useState(cachedRoster?.pages ?? 0);
  const [loading, setLoading] = useState(!cachedRoster);
  const [openId, setOpenId] = useState<string | null>(openFromState);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortMode>("default");
  const [sortOpen, setSortOpen] = useState(false);
  const [downloadOpen, setDownloadOpen] = useState(false);
  const [rowDownloadId, setRowDownloadId] = useState<string | null>(null);
  const [downloadBusy, setDownloadBusy] = useState<string | null>(null);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");
  const [inviteError, setInviteError] = useState(false);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [quotaTip, setQuotaTip] = useState(false);
  const [sessionModal, setSessionModal] = useState<CoachAthlete | null>(null);
  const [sessionName, setSessionName] = useState("");
  const [removeTarget, setRemoveTarget] = useState<{
    athlete: CoachAthlete;
    session: TrainingSession;
  } | null>(null);
  const [useTarget, setUseTarget] = useState<CoachAthlete | null>(null);
  const [templates, setTemplates] = useState<TrainingSession[]>([]);
  const [useSearch, setUseSearch] = useState("");
  const [useSelected, setUseSelected] = useState<string[]>([]);
  const [useBusy, setUseBusy] = useState(false);
  const [useStatus, setUseStatus] = useState("");
  const [newIds, setNewIds] = useState<Set<string>>(
    () => new Set(getStudentsRoster().newIds),
  );
  const [planError, setPlanError] = useState<{ athleteId: string; message: string } | null>(null);

  const canInvite = canInviteAthlete(user);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const cached = readStudentsRoster(debouncedSearch);
    if (cached) {
      setAthletes(cached.athletes);
      setPage(cached.page);
      setPages(cached.pages);
      setLoading(false);
      return;
    }
    void load(1, false);
  }, [debouncedSearch]);

  useEffect(() => {
    if (openFromState) setOpenId(openFromState);
  }, [openFromState]);

  useEffect(() => {
    if (!openFromState || openId !== openFromState || loading) return;
    const row = document.querySelector(`.student-row[data-id="${CSS.escape(openFromState)}"]`);
    if (row instanceof HTMLElement) {
      row.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
    if (page < pages) void load(page + 1, true);
  }, [openFromState, openId, athletes, loading, page, pages]);

  useEffect(() => {
    if (!sortOpen && !downloadOpen && !rowDownloadId) return;
    const onDoc = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (!target.closest("#students-sort")) setSortOpen(false);
      if (!target.closest("#students-download")) setDownloadOpen(false);
      if (!target.closest(".student-row-download")) setRowDownloadId(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setSortOpen(false);
      setDownloadOpen(false);
      setRowDownloadId(null);
    };
    document.addEventListener("click", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("click", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [sortOpen, downloadOpen, rowDownloadId]);

  async function load(requestedPage = 1, append = false) {
    if (!append) setLoading(true);
    try {
      const data = await listCoachAthletes({
        page: requestedPage,
        limit: PAGE_SIZE,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      const nextAthletes = append
        ? [...getStudentsRoster().athletes, ...(data.data ?? [])]
        : (data.data ?? []);
      const nextPageNum = data.page ?? requestedPage;
      const nextPages = data.pages ?? 0;
      setAthletes(nextAthletes);
      setPage(nextPageNum);
      setPages(nextPages);
      writeStudentsRoster({
        athletes: nextAthletes,
        page: nextPageNum,
        pages: nextPages,
        search: debouncedSearch,
        loaded: true,
      });
      if (!append) void refreshRecentAccepted();
    } finally {
      setLoading(false);
    }
  }

  async function refreshRecentAccepted() {
    try {
      const data = await listCoachInvites({ status: "accepted", page: 1, limit: 50 });
      const cutoff = Date.now() - NEW_ACCEPT_MS;
      const seen = readSeenNewAthletes();
      const next = new Set(
        (data.data ?? [])
          .filter((invite) => {
            const raw = invite.respondedAt || invite.invitedAt;
            const time = raw ? new Date(raw).getTime() : NaN;
            return Number.isFinite(time) && time >= cutoff;
          })
          .map((invite) => String(invite.athleteId || ""))
          .filter((id) => id && !seen.has(id)),
      );
      setNewIds(next);
      writeStudentsRosterNewIds(next);
    } catch {
      setNewIds(new Set());
      writeStudentsRosterNewIds([]);
    }
  }

  async function persist(athlete: CoachAthlete, sessions: TrainingSession[]) {
    try {
      await setAthleteCoachProgram(athlete.id, sessions);
      const next = { ...athlete, coachTrainingProgram: sessions };
      setAthletes((prev) => {
        const list = prev.map((row) => (row.id === athlete.id ? next : row));
        writeStudentsRoster({ athletes: list });
        return list;
      });
      setPlanError((prev) => (prev?.athleteId === athlete.id ? null : prev));
      return next;
    } catch (err) {
      setPlanError({ athleteId: athlete.id, message: t("athletePlanSaveFail") });
      throw err;
    }
  }

  function beginAssign(athlete: CoachAthlete, session: TrainingSession) {
    const sessions = athlete.coachTrainingProgram ?? [];
    if (!session.items.length) {
      setAssignTarget({
        kind: "athlete",
        athleteId: athlete.id,
        sessionId: session.id,
        sessionName: session.name,
        athleteName: personName(athlete.profile) || athlete.email,
        returnTo: `/alumnos/${athlete.id}/sesion/${session.id}`,
        sessions,
      });
      navigate("/", { state: ASSIGN_CATALOG_STATE });
      return;
    }
    setAssignTarget(null);
    navigate(`/alumnos/${athlete.id}/sesion/${session.id}`);
  }

  async function onInvite(copyWhatsApp: boolean) {
    const email = inviteEmail.trim();
    if (!email) return;
    setInviteBusy(true);
    setInviteStatus("");
    setInviteError(false);
    try {
      await inviteAthlete(email);
      void load(1, false);
      void refreshUser();
      let copied = false;
      if (copyWhatsApp) {
        const coachName = personName(user?.profile) || "Tu coach";
        const message = t("inviteWhatsAppMessage", {
          coachName,
          email,
          url: window.location.origin,
        });
        try {
          await navigator.clipboard.writeText(message);
          copied = true;
        } catch {
          setInviteStatus(t("inviteSentButCopyFail"));
          setInviteError(true);
        }
      }
      setInviteSent(true);
      if (!copyWhatsApp || copied) setInviteStatus("");
      window.setTimeout(() => closeInvite(), SUCCESS_CLOSE_MS);
    } catch (err) {
      setInviteStatus(t(inviteErrorKey(err)));
      setInviteError(true);
      setInviteSent(false);
    } finally {
      setInviteBusy(false);
    }
  }

  async function downloadPlans(athleteIds: string[], format: "xlsx" | "pdf") {
    const busyKey = athleteIds.length === 1 ? `${athleteIds[0]}-${format}` : `all-${format}`;
    if (downloadBusy) return;
    setDownloadBusy(busyKey);
    setDownloadOpen(false);
    setRowDownloadId(null);
    try {
      const { blob, filename, contentType } = await exportCoachTrainingProgram(
        athleteIds,
        lang,
        format,
      );
      triggerBlobDownload(
        blob,
        filename || fallbackExportFilename(contentType, athleteIds, format),
      );
    } catch {
      window.alert(t("studentsDownloadFail"));
    } finally {
      setDownloadBusy(null);
    }
  }

  function closeInvite() {
    setInviteOpen(false);
    setInviteEmail("");
    setInviteStatus("");
    setInviteError(false);
    setInviteSent(false);
  }

  function openInvite() {
    if (!canInvite) {
      setQuotaTip(true);
      return;
    }
    setQuotaTip(false);
    setInviteOpen(true);
  }

  const visible = useMemo(() => {
    if (sort === "default") return athletes;
    const preferWithout = sort === "without-plan";
    return [...athletes].sort((a, b) => {
      const aHas = athleteHasPlan(a);
      const bHas = athleteHasPlan(b);
      if (aHas === bHas) return 0;
      if (preferWithout) return aHas ? 1 : -1;
      return aHas ? -1 : 1;
    });
  }, [athletes, sort]);

  const searching = Boolean(debouncedSearch);
  const hasAthletes = visible.length > 0;
  const canDownloadAll = athletes.some(athleteHasPlan);
  const useOptions = templates.filter((template) => {
    if (!useTarget) return false;
    if (athleteHasTemplate(useTarget, template.id)) return false;
    const q = useSearch.trim().toLowerCase();
    return !q || template.name.toLowerCase().includes(q);
  });

  return (
    <div id="students-view" className="students-view">
      <div className="recommend-results students-shell">
        <div className="recommend-toolbar students-toolbar">
          <div className="search-wrapper students-search">
            <SearchIcon />
            <input
              type="text"
              className="search-box"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("studentsSearch")}
              autoComplete="off"
            />
            <button
              type="button"
              className="search-clear"
              hidden={!search}
              aria-label={t("studentsSearch")}
              onClick={() => setSearch("")}
            >
              ×
            </button>
          </div>
          <div className="students-toolbar-actions">
            <div
              className={`students-download students-sort${sortOpen ? " is-open" : ""}${sort !== "default" ? " has-active-sort" : ""}`}
              id="students-sort"
            >
              <button
                type="button"
                className="recommend-again-btn students-download-trigger"
                aria-expanded={sortOpen}
                aria-haspopup="menu"
                onClick={(event) => {
                  event.stopPropagation();
                  setDownloadOpen(false);
                  setRowDownloadId(null);
                  setSortOpen((open) => !open);
                }}
              >
                <span>{t("studentsSort")}</span>
                <span className="students-download-caret" aria-hidden="true" />
              </button>
              <div className="students-download-menu" role="menu" hidden={!sortOpen}>
                <button
                  type="button"
                  className={`students-download-item${sort === "without-plan" ? " is-active" : ""}`}
                  role="menuitemradio"
                  aria-checked={sort === "without-plan"}
                  onClick={() => {
                    setSort((prev) => (prev === "without-plan" ? "default" : "without-plan"));
                    setSortOpen(false);
                  }}
                >
                  <span>{t("studentsSortWithoutPlan")}</span>
                </button>
                <button
                  type="button"
                  className={`students-download-item${sort === "with-plan" ? " is-active" : ""}`}
                  role="menuitemradio"
                  aria-checked={sort === "with-plan"}
                  onClick={() => {
                    setSort((prev) => (prev === "with-plan" ? "default" : "with-plan"));
                    setSortOpen(false);
                  }}
                >
                  <span>{t("studentsSortWithPlan")}</span>
                </button>
              </div>
            </div>
            <div className={`students-download${downloadOpen ? " is-open" : ""}`} id="students-download">
              <button
                type="button"
                className="recommend-again-btn students-download-trigger"
                id="students-download-btn"
                aria-expanded={downloadOpen}
                aria-haspopup="menu"
                aria-controls="students-download-menu"
                onClick={(event) => {
                  event.stopPropagation();
                  setSortOpen(false);
                  setRowDownloadId(null);
                  setDownloadOpen((open) => !open);
                }}
              >
                <span>{t("studentsDownload")}</span>
                <span className="students-download-caret" aria-hidden="true" />
              </button>
              <div
                className="students-download-menu"
                id="students-download-menu"
                role="menu"
                hidden={!downloadOpen}
              >
                <button
                  type="button"
                  className={`students-download-item${canDownloadAll ? "" : " is-disabled"}`}
                  role="menuitem"
                  id="students-download-all-excel"
                  disabled={!canDownloadAll || Boolean(downloadBusy)}
                  aria-disabled={!canDownloadAll}
                  title={canDownloadAll ? "" : t("studentsDownloadAllDisabled")}
                  onClick={() => {
                    if (!canDownloadAll) return;
                    void downloadPlans([], "xlsx");
                  }}
                >
                  <span>{t("studentsDownloadAllExcel")}</span>
                </button>
                <button
                  type="button"
                  className={`students-download-item${canDownloadAll ? "" : " is-disabled"}`}
                  role="menuitem"
                  id="students-download-all-pdf"
                  disabled={!canDownloadAll || Boolean(downloadBusy)}
                  aria-disabled={!canDownloadAll}
                  title={canDownloadAll ? "" : t("studentsDownloadAllDisabled")}
                  onClick={() => {
                    if (!canDownloadAll) return;
                    void downloadPlans([], "pdf");
                  }}
                >
                  <span>{t("studentsDownloadAllPdf")}</span>
                </button>
              </div>
            </div>
            <div className={`students-invite-wrap${quotaTip ? " is-tip-open" : ""}`}>
              <button
                type="button"
                className="recommend-again-btn"
                disabled={!canInvite}
                onClick={openInvite}
              >
                <span>{t("addStudent")}</span>
              </button>
              <button
                type="button"
                className="students-invite-quota-badge"
                hidden={canInvite}
                aria-expanded={quotaTip}
                onClick={(event) => {
                  event.stopPropagation();
                  setQuotaTip((open) => !open);
                }}
              >
                <span className="students-invite-quota-dot" aria-hidden="true" />
              </button>
              <div className="students-invite-quota-tip" role="status" hidden={!quotaTip}>
                <p>{t("inviteQuotaHint")}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="students-loading" hidden={!loading || hasAthletes}>
          <div className="load-spinner visible" aria-hidden="true" />
          <span>{t("studentsLoading")}</span>
        </div>

        <div className="students-empty" hidden={loading || hasAthletes}>
          <p className="students-empty-title">
            {t(searching ? "studentsSearchEmptyTitle" : "studentsEmptyTitle")}
          </p>
          <p className="students-empty-lead">
            {t(searching ? "studentsSearchEmptyLead" : "studentsEmptyLead")}
          </p>
          {!searching ? (
            <button type="button" className="recommend-cta" onClick={openInvite}>
              <span>{t("addStudent")}</span>
            </button>
          ) : null}
        </div>

        <div className="students-list" hidden={!hasAthletes}>
          {visible.map((athlete) => (
            <StudentRow
              key={athlete.id}
              athlete={athlete}
              open={openId === athlete.id}
              isNew={newIds.has(athlete.id)}
              openSessionId={openId === athlete.id ? openSessionId : null}
              onToggle={() => {
                if (openId === athlete.id) {
                  setOpenId(null);
                  setOpenSessionId(null);
                  return;
                }
                setOpenId(athlete.id);
                setOpenSessionId(null);
                if (newIds.has(athlete.id)) {
                  markNewAthleteSeen(athlete.id);
                  setNewIds((prev) => {
                    const next = new Set(prev);
                    next.delete(athlete.id);
                    writeStudentsRosterNewIds(next);
                    return next;
                  });
                }
              }}
              onToggleSession={(sessionId) =>
                setOpenSessionId((prev) => (prev === sessionId ? null : sessionId))
              }
              onAddSession={() => {
                const next = (athlete.coachTrainingProgram ?? []).length + 1;
                setSessionName(t("addSessionDefault", { n: next }));
                setSessionModal(athlete);
              }}
              onUseTemplate={() => {
                setUseTarget(athlete);
                setUseSearch("");
                setUseSelected([]);
                setUseStatus("");
                void getCoachTemplates().then((data) => setTemplates(data.coachTemplates ?? []));
              }}
              onEditSession={(session) => beginAssign(athlete, session)}
              onRemoveSession={(session) => setRemoveTarget({ athlete, session })}
              onReorderSessions={(sessions) => {
                const previous = athlete.coachTrainingProgram ?? [];
                setAthletes((prev) => {
                  const list = prev.map((row) =>
                    row.id === athlete.id ? { ...row, coachTrainingProgram: sessions } : row,
                  );
                  writeStudentsRoster({ athletes: list });
                  return list;
                });
                void persist(athlete, sessions).catch(() => {
                  setAthletes((prev) => {
                    const list = prev.map((row) =>
                      row.id === athlete.id ? { ...row, coachTrainingProgram: previous } : row,
                    );
                    writeStudentsRoster({ athletes: list });
                    return list;
                  });
                });
              }}
              planError={planError?.athleteId === athlete.id ? planError.message : ""}
              onProgress={() =>
                navigate("/coach/avances", { state: { athlete, returnTo: "students" } })
              }
              onNutrition={() => navigate("/coach/nutricion", { state: { athlete } })}
              downloadOpen={rowDownloadId === athlete.id}
              downloadBusy={downloadBusy}
              onToggleDownload={() => {
                setSortOpen(false);
                setDownloadOpen(false);
                setRowDownloadId((prev) => (prev === athlete.id ? null : athlete.id));
              }}
              onDownload={(format) => {
                if (!athleteHasPlan(athlete)) return;
                void downloadPlans([athlete.id], format);
              }}
            />
          ))}
        </div>

        <button
          type="button"
          className="students-load-more"
          hidden={!hasAthletes || page >= pages}
          disabled={loading}
          onClick={() => void load(page + 1, true)}
        >
          <span>{t("studentsLoadMore")}</span>
        </button>
      </div>

      <RecommendOverlay
        open={inviteOpen}
        titleId="add-student-title"
        title={t("addStudent")}
        onClose={closeInvite}
      >
        <form
          className="recommend-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            void onInvite(false);
          }}
        >
          <label className="recommend-field">
            <span className="recommend-label">{t("email")}</span>
            <input
              type="email"
              required
              autoComplete="off"
              value={inviteEmail}
              onChange={(event) => setInviteEmail(event.target.value)}
              placeholder={t("inviteEmailPlaceholder")}
            />
          </label>
          <p className="recommend-hint">{t("addStudentHint")}</p>
          <p className={`recommend-status${inviteError ? " is-error" : ""}`} hidden={!inviteStatus}>
            {inviteStatus}
          </p>
          <div className="add-student-actions">
            <button
              type="submit"
              className={`recommend-submit${inviteSent ? " is-sent" : ""}`}
              disabled={inviteBusy || inviteSent}
            >
              <span className="recommend-submit-label">
                {inviteSent ? t("inviteSent") : t("addStudentSubmit")}
              </span>
            </button>
            <button
              type="button"
              className="add-student-whatsapp"
              disabled={inviteBusy || inviteSent}
              onClick={() => void onInvite(true)}
            >
              <span>{t("inviteSendAndCopyWhatsApp")}</span>
            </button>
          </div>
        </form>
      </RecommendOverlay>

      <RecommendOverlay
        open={Boolean(sessionModal)}
        titleId="add-session-title"
        title={t("addSessionTitle")}
        onClose={() => setSessionModal(null)}
      >
        <form
          className="recommend-form"
          onSubmit={(event) => {
            event.preventDefault();
            const athlete = sessionModal;
            const name = sessionName.trim();
            if (!athlete || !name) return;
            const sessions = athlete.coachTrainingProgram ?? [];
            const session = {
              id: newSessionId(),
              name,
              order: sessions.length,
              items: [],
            };
            void persist(athlete, [...sessions, session])
              .then((next) => {
                setOpenId(next.id);
                setOpenSessionId(session.id);
                setSessionModal(null);
              })
              .catch(() => {});
          }}
        >
          <label className="recommend-field">
            <span className="recommend-label">{t("addSessionName")}</span>
            <input
              type="text"
              required
              maxLength={80}
              autoComplete="off"
              value={sessionName}
              onChange={(event) => setSessionName(event.target.value)}
            />
          </label>
          <p className="recommend-hint">{t("addSessionHint")}</p>
          <p
            className="recommend-status is-error"
            hidden={sessionModal?.id !== planError?.athleteId}
          >
            {planError?.message}
          </p>
          <button type="submit" className="recommend-submit">
            <span className="recommend-submit-label">{t("addSessionSubmit")}</span>
          </button>
        </form>
      </RecommendOverlay>

      <RecommendOverlay
        open={Boolean(removeTarget)}
        titleId="remove-session-title"
        title={`${t("sessionRemoveTitleBefore")}${removeTarget?.session.name ?? ""}${t("sessionRemoveTitleAfter")}`}
        confirm
        onClose={() => setRemoveTarget(null)}
      >
        <p className="confirm-modal-lead">{t("sessionRemoveConfirm")}</p>
        <p
          className="recommend-status is-error"
          hidden={removeTarget?.athlete.id !== planError?.athleteId}
        >
          {planError?.message}
        </p>
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-cancel"
            onClick={() => setRemoveTarget(null)}
          >
            {t("sessionRemoveCancel")}
          </button>
          <button
            type="button"
            className="confirm-modal-danger"
            onClick={() => {
              if (!removeTarget) return;
              const { athlete, session } = removeTarget;
              void persist(
                athlete,
                (athlete.coachTrainingProgram ?? []).filter((row) => row.id !== session.id),
              )
                .then(() => setRemoveTarget(null))
                .catch(() => {});
            }}
          >
            {t("sessionRemoveConfirmBtn")}
          </button>
        </div>
      </RecommendOverlay>

      <RecommendOverlay
        open={Boolean(useTarget)}
        titleId="use-template-title"
        title={t("useTemplateTitle")}
        onClose={() => setUseTarget(null)}
      >
        <p className="recommend-hint">
          {t("useTemplateLeadBefore")}
          <strong>{useTarget ? personName(useTarget.profile) || useTarget.email : ""}</strong>
          {t("useTemplateLeadAfter")}
        </p>
        <div className="apply-template-search-block">
          <span className="recommend-label">{t("useTemplateSearch")}</span>
          <div className="search-wrapper apply-template-search">
            <SearchIcon />
            <input
              type="text"
              className="search-box"
              value={useSearch}
              onChange={(event) => setUseSearch(event.target.value)}
              placeholder={t("useTemplateSearchPlaceholder")}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="apply-template-results">
          <ul className="apply-template-list" hidden={!useOptions.length}>
            {useOptions.map((template) => {
              const selected = useSelected.includes(template.id);
              return (
                <li
                  key={template.id}
                  className={`apply-template-item${selected ? " is-selected" : ""}`}
                >
                  <button
                    type="button"
                    className="apply-template-item-btn"
                    aria-pressed={selected}
                    onClick={() =>
                      setUseSelected((prev) =>
                        prev.includes(template.id)
                          ? prev.filter((id) => id !== template.id)
                          : [...prev, template.id],
                      )
                    }
                  >
                    <span className="apply-template-item-name">{template.name}</span>
                    <span className="apply-template-item-email">
                      {t("useTemplateExerciseCount", { n: template.items.length })}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="apply-template-empty" hidden={useOptions.length > 0}>
            {t(templates.length ? "useTemplateEmptyNoneLeft" : "useTemplateEmpty")}
          </p>
        </div>
        <p className={`recommend-status${useStatus ? " is-error" : ""}`} hidden={!useStatus}>
          {useStatus}
        </p>
        <div className="confirm-modal-actions">
          <button type="button" className="confirm-modal-cancel" onClick={() => setUseTarget(null)}>
            {t("templateApplyCancel")}
          </button>
          <button
            type="button"
            className="recommend-submit"
            disabled={useBusy || !useSelected.length || !useTarget}
            onClick={() => {
              if (!useTarget || !useSelected.length) return;
              setUseBusy(true);
              setUseStatus("");
              void applyCoachTemplates(useSelected, [useTarget.id])
                .then(() => {
                  void load(1, false);
                  setUseTarget(null);
                })
                .catch(() => setUseStatus(t("useTemplateFail")))
                .finally(() => setUseBusy(false));
            }}
          >
            {useSelected.length
              ? t("templateApplyConfirmCount", { n: useSelected.length })
              : t("templateApplyConfirm")}
          </button>
        </div>
      </RecommendOverlay>
    </div>
  );
}

function StudentRow({
  athlete,
  open,
  isNew,
  openSessionId,
  onToggle,
  onToggleSession,
  onAddSession,
  onUseTemplate,
  onEditSession,
  onRemoveSession,
  onReorderSessions,
  planError,
  onProgress,
  onNutrition,
  downloadOpen,
  downloadBusy,
  onToggleDownload,
  onDownload,
}: {
  athlete: CoachAthlete;
  open: boolean;
  isNew: boolean;
  openSessionId: string | null;
  onToggle: () => void;
  onToggleSession: (sessionId: string) => void;
  onAddSession: () => void;
  onUseTemplate: () => void;
  onEditSession: (session: TrainingSession) => void;
  onRemoveSession: (session: TrainingSession) => void;
  onReorderSessions: (sessions: TrainingSession[]) => void;
  planError: string;
  onProgress: () => void;
  onNutrition: () => void;
  downloadOpen: boolean;
  downloadBusy: string | null;
  onToggleDownload: () => void;
  onDownload: (format: "xlsx" | "pdf") => void;
}) {
  const { t } = useI18n();
  const first = athlete.profile.firstName.trim();
  const last = athlete.profile.lastName.trim();
  const email = athlete.email.trim();
  const name = personName(athlete.profile) || email;
  const initials =
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase() || email.charAt(0).toUpperCase() || "?";
  const goalKey = goalLabelKey(athlete.goal);
  const sexKey = sexLabelKey(athlete.profile.sex);
  const age = ageFromBirthDate(athlete.profile.birthDate);
  const sessions = athlete.coachTrainingProgram ?? [];

  return (
    <div
      className={`student-row${open ? " is-open" : ""}${isNew ? " is-new" : ""}`}
      data-id={athlete.id}
    >
      <button type="button" className="student-row-header" aria-expanded={open} onClick={onToggle}>
        <span className="student-row-avatar" aria-hidden="true">
          {initials}
        </span>
        <span className="student-row-meta">
          <span className="student-row-name-row">
            <span className="student-row-name">{name}</span>
            {isNew ? (
              <span className="student-row-new-badge">
                <span className="student-row-new-dot" aria-hidden="true" />
                <span className="student-row-new-label">{t("studentsNewBadge")}</span>
              </span>
            ) : null}
            {goalKey ? (
              <span className="student-row-goal-pill" title={`${t("profileGoal")}: ${t(goalKey)}`}>
                {t(goalKey)}
              </span>
            ) : null}
          </span>
        </span>
        <span className="student-row-chevron" aria-hidden="true" />
      </button>
      <div className="student-row-body">
        <div className="student-row-panel">
          <div className="student-row-info">
            <Detail label={t("firstName")} value={first || "—"} />
            <Detail label={t("lastName")} value={last || "—"} />
            <Detail label={t("email")} value={email || "—"} />
            {sexKey ? <Detail label={t("profileSex")} value={t(sexKey)} /> : null}
            {age != null ? (
              <Detail label={t("profileAge")} value={t("nutritionAgeYears", { n: age })} />
            ) : null}
            {athlete.currentWeightKg != null ? (
              <Detail label={t("profileWeight")} value={`${athlete.currentWeightKg} kg`} />
            ) : null}
            {athlete.profile.heightCm != null ? (
              <Detail
                label={t("profileHeight")}
                value={`${Math.round(athlete.profile.heightCm)} cm`}
              />
            ) : null}
          </div>
          <div className="student-row-aside-actions">
            <button type="button" className="student-row-progress-btn" onClick={onProgress}>
              {t("studentsProgress")}
            </button>
            <button type="button" className="student-row-progress-btn" onClick={onNutrition}>
              {t("studentsNutrition")}
            </button>
            <AthleteDownloadMenu
              open={downloadOpen}
              canDownload={athleteHasPlan(athlete)}
              busy={downloadBusy}
              onToggle={onToggleDownload}
              onDownload={onDownload}
            />
          </div>
        </div>
        <StudentPlan
          title={t("sessionsHeading")}
          addLabel={t("addSession")}
          emptyLabel={t("sessionsEmpty")}
          sessions={sessions}
          extraAction={{ label: t("useTemplate"), onClick: onUseTemplate }}
          onAdd={onAddSession}
          onToggleSession={onToggleSession}
          onRemoveSession={onRemoveSession}
          onEditSession={onEditSession}
          onReorderSessions={onReorderSessions}
          openSessionId={openSessionId}
        />
        {planError ? (
          <p className="student-plan-save-error" role="alert">
            {planError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AthleteDownloadMenu({
  open,
  canDownload,
  busy,
  onToggle,
  onDownload,
}: {
  open: boolean;
  canDownload: boolean;
  busy: string | null;
  onToggle: () => void;
  onDownload: (format: "xlsx" | "pdf") => void;
}) {
  const { t } = useI18n();
  return (
    <div className={`student-row-download${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="student-row-download-trigger"
        aria-label={t("studentsDownloadPlan")}
        title={t("studentsDownloadPlan")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
      >
        ⏬
      </button>
      <div className="student-row-download-menu" role="menu" hidden={!open}>
        <button
          type="button"
          className={`student-row-download-item${canDownload ? "" : " is-disabled"}`}
          role="menuitem"
          disabled={!canDownload || Boolean(busy)}
          aria-disabled={!canDownload}
          title={canDownload ? t("studentsDownloadExcel") : t("studentsDownloadAllDisabled")}
          onClick={(event) => {
            event.stopPropagation();
            if (!canDownload) return;
            onDownload("xlsx");
          }}
        >
          <span className="student-row-download-item-label">{t("studentsDownloadExcel")}</span>
        </button>
        <button
          type="button"
          className={`student-row-download-item${canDownload ? "" : " is-disabled"}`}
          role="menuitem"
          disabled={!canDownload || Boolean(busy)}
          aria-disabled={!canDownload}
          title={canDownload ? t("studentsDownloadPdf") : t("studentsDownloadAllDisabled")}
          onClick={(event) => {
            event.stopPropagation();
            if (!canDownload) return;
            onDownload("pdf");
          }}
        >
          <span className="student-row-download-item-label">{t("studentsDownloadPdf")}</span>
        </button>
      </div>
    </div>
  );
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function fallbackExportFilename(contentType: string, athleteIds: string[], format: "xlsx" | "pdf") {
  if (contentType.includes("zip")) return "Pautas de entrenamientos.zip";
  const ext = format === "pdf" ? "pdf" : "xlsx";
  return athleteIds.length === 1 ? `training-program.${ext}` : `training-programs.${ext}`;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="student-row-detail">
      <span className="student-row-detail-label">{label}</span>
      <span className="student-row-detail-value-wrap">
        <span className="student-row-detail-value">{value}</span>
      </span>
    </div>
  );
}
