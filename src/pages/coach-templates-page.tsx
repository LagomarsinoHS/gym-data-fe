import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import {
  applyCoachTemplates,
  createCoachTemplate,
  getCoachTemplates,
  setCoachTemplates,
} from "@/api/coach-templates";
import { listCoachAthletes } from "@/api/users";
import { RecommendOverlay, SearchIcon } from "@/components/coach/recommend-overlay";
import { StudentPlan } from "@/components/coach/student-plan";
import { ASSIGN_CATALOG_STATE, useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { athleteHasTemplate } from "@/lib/coach-athletes";
import { personName } from "@/lib/user-display";
import type { CoachAthlete, TrainingSession } from "@/types/user";

export function CoachTemplatesPage() {
  const { t } = useI18n();
  const { setAssignTarget } = useCatalog();
  const navigate = useNavigate();
  const [templates, setTemplates] = useState<TrainingSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<TrainingSession | null>(null);
  const [applyTarget, setApplyTarget] = useState<TrainingSession | null>(null);
  const [athletes, setAthletes] = useState<CoachAthlete[]>([]);
  const [applySearch, setApplySearch] = useState("");
  const [applySelected, setApplySelected] = useState<string[]>([]);
  const [applyLoading, setApplyLoading] = useState(false);
  const [applyBusy, setApplyBusy] = useState(false);
  const [applyStatus, setApplyStatus] = useState("");
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);

  useEffect(() => {
    void getCoachTemplates()
      .then((data) => setTemplates(data.coachTemplates ?? []))
      .catch(() => {
        setStatus(t("coachTemplatesLoadFail"));
        setStatusError(true);
      })
      .finally(() => setLoading(false));
  }, [t]);

  function showToast(title: string, detail: string) {
    setToast({ title, detail });
    setToastVisible(false);
    requestAnimationFrame(() => setToastVisible(true));
    window.setTimeout(() => {
      setToastVisible(false);
      window.setTimeout(() => setToast(null), 280);
    }, 3400);
  }

  async function persist(next: TrainingSession[]) {
    const data = await setCoachTemplates(next);
    setTemplates(data.coachTemplates ?? next);
  }

  function beginAssign(session: TrainingSession) {
    if (!session.items.length) {
      setAssignTarget({
        kind: "template",
        athleteId: "__templates__",
        sessionId: session.id,
        sessionName: session.name,
        athleteName: t("coachTemplates"),
        returnTo: `/plantillas/${session.id}`,
        sessions: templates,
      });
      navigate("/", { state: ASSIGN_CATALOG_STATE });
      return;
    }
    setAssignTarget(null);
    navigate(`/plantillas/${session.id}`);
  }

  function openApply(session: TrainingSession) {
    if (!session.items.length) {
      setStatus(t("templateApplyNeedsExercises"));
      setStatusError(true);
      return;
    }
    setApplyTarget(session);
    setApplySearch("");
    setApplySelected([]);
    setApplyStatus("");
    setApplyLoading(true);
    void listCoachAthletes({ page: 1, limit: 50 })
      .then((data) =>
        setAthletes((data.data ?? []).filter((row) => !athleteHasTemplate(row, session.id))),
      )
      .catch(() => setApplyStatus(t("templateApplyLoadAthletesFail")))
      .finally(() => setApplyLoading(false));
  }

  const applyVisible = athletes.filter((athlete) => {
    const q = applySearch.trim().toLowerCase();
    if (!q) return true;
    const name = personName(athlete.profile).toLowerCase();
    return name.includes(q) || athlete.email.toLowerCase().includes(q);
  });

  return (
    <div id="coach-templates-view" className="recommend-view">
      <div className="coach-templates-shell">
        <header className="coach-templates-header">
          <h2 className="coach-templates-title">{t("coachTemplates")}</h2>
          <p className="coach-templates-lead" hidden={loading || templates.length > 0}>
            {t("coachTemplatesLead")}
          </p>
        </header>
        <div className="coach-templates-loading" hidden={!loading}>
          <div className="load-spinner visible" aria-hidden="true" />
          <span>{t("coachTemplatesLoading")}</span>
        </div>
        <p className={`coach-templates-status${statusError ? " is-error" : ""}`} hidden={!status}>
          {status}
        </p>
        <div className="coach-templates-body" hidden={loading}>
          <StudentPlan
            title={t("coachTemplatesListHeading")}
            addLabel={t("addTemplate")}
            emptyLabel={t("coachTemplatesEmpty")}
            sessions={templates}
            onAdd={() => {
              setAddName(t("addTemplateDefault", { n: templates.length + 1 }));
              setAddOpen(true);
            }}
            onToggleSession={(id) => setOpenSessionId((prev) => (prev === id ? null : id))}
            onRemoveSession={setRemoveTarget}
            onEditSession={beginAssign}
            onApplyTemplate={openApply}
            onReorderSessions={(next) => {
              setTemplates(next);
              void persist(next);
            }}
            openSessionId={openSessionId}
          />
        </div>
      </div>

      <div
        className={`coach-templates-toast${toastVisible ? " is-visible" : ""}`}
        hidden={!toast}
        role="status"
      >
        <span className="coach-templates-toast-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
            <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
            <path
              d="M8 12.5l2.5 2.5L16.5 9"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
        <div className="coach-templates-toast-copy">
          <p className="coach-templates-toast-title">{toast?.title}</p>
          <p className="coach-templates-toast-detail">{toast?.detail}</p>
        </div>
        <button
          type="button"
          className="coach-templates-toast-close"
          aria-label="Cerrar"
          onClick={() => setToast(null)}
        >
          ✕
        </button>
      </div>

      <RecommendOverlay
        open={addOpen}
        titleId="add-template-title"
        title={t("addTemplateTitle")}
        onClose={() => setAddOpen(false)}
      >
        <form
          className="recommend-form"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const name = addName.trim();
            if (!name) return;
            setAddBusy(true);
            void createCoachTemplate(name)
              .then((data) => {
                setTemplates((prev) => [...prev, data.template]);
                setOpenSessionId(data.template.id);
                setAddOpen(false);
              })
              .catch(() => {
                setStatus(t("addTemplateCreateFail"));
                setStatusError(true);
              })
              .finally(() => setAddBusy(false));
          }}
        >
          <label className="recommend-field">
            <span className="recommend-label">{t("addSessionName")}</span>
            <input
              type="text"
              required
              maxLength={80}
              autoComplete="off"
              value={addName}
              onChange={(event) => setAddName(event.target.value)}
            />
          </label>
          <p className="recommend-hint">{t("addTemplateHint")}</p>
          <button type="submit" className="recommend-submit" disabled={addBusy}>
            <span className="recommend-submit-label">{t("addTemplateSubmit")}</span>
          </button>
        </form>
      </RecommendOverlay>

      <RecommendOverlay
        open={Boolean(removeTarget)}
        titleId="remove-template-title"
        title={`${t("sessionRemoveTitleBefore")}${removeTarget?.name ?? ""}${t("sessionRemoveTitleAfter")}`}
        confirm
        onClose={() => setRemoveTarget(null)}
      >
        <p className="confirm-modal-lead">{t("sessionRemoveConfirm")}</p>
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
              void persist(templates.filter((row) => row.id !== removeTarget.id));
              setRemoveTarget(null);
            }}
          >
            {t("sessionRemoveConfirmBtn")}
          </button>
        </div>
      </RecommendOverlay>

      <RecommendOverlay
        open={Boolean(applyTarget)}
        titleId="apply-template-title"
        title={t("templateApplyTitle")}
        onClose={() => setApplyTarget(null)}
      >
        <p className="recommend-hint">
          {t("templateApplyLeadBefore")}
          <strong>{applyTarget?.name ?? ""}</strong>
          {t("templateApplyLeadAfter")}
        </p>
        <div className="apply-template-search-block">
          <span className="recommend-label">{t("templateApplySearch")}</span>
          <div className="search-wrapper apply-template-search">
            <SearchIcon />
            <input
              type="text"
              className="search-box"
              value={applySearch}
              onChange={(event) => setApplySearch(event.target.value)}
              placeholder={t("templateApplySearchPlaceholder")}
              autoComplete="off"
            />
          </div>
        </div>
        <div className="apply-template-results">
          <ul className="apply-template-skeleton" hidden={!applyLoading} aria-hidden="true">
            {Array.from({ length: 5 }, (_, index) => (
              <li key={index} className="apply-template-skeleton-item">
                <span className="apply-template-skeleton-line is-name" />
                <span className="apply-template-skeleton-line is-email" />
              </li>
            ))}
          </ul>
          <ul className="apply-template-list" hidden={applyLoading || !applyVisible.length}>
            {applyVisible.map((athlete) => {
              const selected = applySelected.includes(athlete.id);
              return (
                <li
                  key={athlete.id}
                  className={`apply-template-item${selected ? " is-selected" : ""}`}
                >
                  <button
                    type="button"
                    className="apply-template-item-btn"
                    aria-pressed={selected}
                    onClick={() =>
                      setApplySelected((prev) =>
                        prev.includes(athlete.id)
                          ? prev.filter((id) => id !== athlete.id)
                          : [...prev, athlete.id],
                      )
                    }
                  >
                    <span className="apply-template-item-name">
                      {personName(athlete.profile) || athlete.email}
                    </span>
                    <span className="apply-template-item-email">{athlete.email}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="apply-template-empty" hidden={applyLoading || applyVisible.length > 0}>
            {t(applySearch.trim() ? "templateApplyEmpty" : "templateApplyEmptyAllHaveIt")}
          </p>
        </div>
        <p className={`recommend-status${applyStatus ? " is-error" : ""}`} hidden={!applyStatus}>
          {applyStatus}
        </p>
        <div className="confirm-modal-actions">
          <button
            type="button"
            className="confirm-modal-cancel"
            onClick={() => setApplyTarget(null)}
          >
            {t("templateApplyCancel")}
          </button>
          <button
            type="button"
            className="recommend-submit"
            disabled={applyBusy || !applySelected.length || !applyTarget}
            onClick={() => {
              if (!applyTarget || !applySelected.length) return;
              setApplyBusy(true);
              setApplyStatus("");
              const name = applyTarget.name;
              void applyCoachTemplates([applyTarget.id], applySelected)
                .then((res) => {
                  const applied = res.applied?.length ?? 0;
                  const skipped = res.skipped?.length ?? 0;
                  if (!applied && skipped) {
                    showToast(
                      t("templateApplyToastTitleSkipped"),
                      t("templateApplyToastAllSkipped", { templateName: name }),
                    );
                  } else if (applied === 1 && !skipped) {
                    const athlete = athletes.find((row) => row.id === applySelected[0]);
                    showToast(
                      t("templateApplyToastTitle"),
                      t("templateApplyToastOne", {
                        templateName: name,
                        athleteName: athlete ? personName(athlete.profile) || athlete.email : "",
                      }),
                    );
                  } else if (skipped) {
                    showToast(
                      t("templateApplyToastTitle"),
                      t("templateApplyToastWithSkips", {
                        templateName: name,
                        ok: applied,
                        skipped,
                      }),
                    );
                  } else {
                    showToast(
                      t("templateApplyToastTitle"),
                      t("templateApplyToastMany", { templateName: name, count: applied }),
                    );
                  }
                  setApplyTarget(null);
                })
                .catch(() => setApplyStatus(t("templateApplyFail")))
                .finally(() => setApplyBusy(false));
            }}
          >
            {applyBusy
              ? t("templateApplySaving")
              : applySelected.length
                ? t("templateApplyConfirmCount", { n: applySelected.length })
                : t("templateApplyConfirm")}
          </button>
        </div>
      </RecommendOverlay>
    </div>
  );
}
