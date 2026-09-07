import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation } from "react-router-dom";

import { getExercise } from "@/api/exercises";
import { setCoachTemplates } from "@/api/coach-templates";
import {
  addToTrainingProgram,
  removeFromTrainingProgram,
  setAthleteCoachProgram,
  updateTrainingProgramExercise,
} from "@/api/users";
import { useAuth } from "@/context/auth-context";
import { useAuthModal } from "@/context/auth-modal-context";
import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { assetUrl } from "@/lib/assets";
import { isCoach } from "@/lib/capabilities";
import { exerciseName, valueLabel } from "@/lib/labels";
import { cleanReps, formatReps } from "@/lib/reps";
import { exerciseShareUrl } from "@/lib/url";
import type { Lang } from "@/lib/prefs";
import type { Exercise } from "@/types/exercise";
import { athleteSessions } from "@/lib/training-sessions";
import type { MeUser, TrainingProgramItem, TrainingSession } from "@/types/user";

export function ExerciseModal() {
  const {
    openId,
    closeExercise,
    activeSessionId,
    setActiveSessionId,
    assignTarget,
    setAssignTarget,
  } = useCatalog();
  const { user, applyUser } = useAuth();
  const { openAuth } = useAuthModal();
  const { t, lang } = useI18n();
  const { pathname } = useLocation();
  const isTraining = pathname === "/entrenamiento";
  const [exercise, setExercise] = useState<Exercise | null>(null);
  const [copied, setCopied] = useState(false);
  const [planBusy, setPlanBusy] = useState(false);
  const [planError, setPlanError] = useState("");
  const [planUndo, setPlanUndo] = useState(false);
  const [rxOpen, setRxOpen] = useState(false);
  const [rxStatus, setRxStatus] = useState("");
  const [instrLang, setInstrLang] = useState<Lang>(lang);
  const undoRef = useRef<{ exerciseId: string; prev: MeUser } | null>(null);
  const undoTimer = useRef(0);
  const rxSetsRef = useRef<HTMLInputElement | null>(null);
  const closeExerciseRef = useRef(closeExercise);
  closeExerciseRef.current = closeExercise;

  const sessions = athleteSessions(user);
  const targetSession = sessions.find((session) => session.id === activeSessionId) ?? sessions[0];
  const programItem = (user?.trainingProgram ?? []).find((item) =>
    itemMatchesExercise(item, openId),
  );
  const inPlan = Boolean(programItem);
  const assignSession = assignTarget?.sessions.find(
    (session) => session.id === assignTarget.sessionId,
  );
  const assignItem = assignSession?.items.find((item) => itemMatchesExercise(item, openId));
  const assignInPlan = Boolean(assignItem);
  const canRemove = isTraining && (inPlan || planUndo);
  const isAssign = Boolean(assignTarget);
  const showPlanActions = isAssign || !isCoach(user);
  const canEditRx = isAssign ? assignInPlan : Boolean(inPlan && !planUndo);
  const rxItem = isAssign ? assignItem : programItem;

  const requestClose = useCallback(() => {
    const snap = undoRef.current;
    undoRef.current = null;
    window.clearTimeout(undoTimer.current);
    undoTimer.current = 0;
    setPlanUndo(false);
    closeExercise();
    if (!snap) return;
    void removeFromTrainingProgram(snap.exerciseId)
      .then(applyUser)
      .catch(() => applyUser(snap.prev));
  }, [applyUser, closeExercise]);

  useEffect(() => {
    if (!openId) {
      setExercise(null);
      setPlanError("");
      setRxOpen(false);
      setPlanUndo(false);
      return;
    }

    document.body.style.overflow = "hidden";
    let cancelled = false;
    void getExercise(openId)
      .then((data) => {
        if (!cancelled) setExercise(data);
      })
      .catch(() => {
        if (!cancelled) closeExerciseRef.current();
      });

    return () => {
      cancelled = true;
      document.body.style.overflow = "";
    };
  }, [openId]);

  useEffect(() => {
    setInstrLang(lang);
  }, [lang, openId]);

  useEffect(() => {
    if (!rxOpen) return;
    const frame = window.requestAnimationFrame(() => rxSetsRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [rxOpen]);

  useEffect(() => {
    if (!openId) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [openId, requestClose]);

  if (!openId || !exercise) return null;

  const name = exerciseName(exercise, lang);
  const stepsFor = (code: Lang) => exercise.instruction_steps?.[code] ?? [];
  const instrLangs = ([lang, lang === "en" ? "es" : "en"] as Lang[]).filter(
    (code) => stepsFor(code).length > 0,
  );
  const activeSteps = stepsFor(
    instrLangs.includes(instrLang) ? instrLang : (instrLangs[0] ?? lang),
  );

  function mapAssignSessions(mutate: (session: TrainingSession) => TrainingSession) {
    if (!assignTarget) return [];
    return assignTarget.sessions.map((session) =>
      session.id === assignTarget.sessionId ? mutate(session) : session,
    );
  }

  async function persistAssignSessions(next: TrainingSession[]) {
    if (!assignTarget) return;
    if (assignTarget.kind === "athlete") {
      await setAthleteCoachProgram(assignTarget.athleteId, next);
    } else {
      await setCoachTemplates(next);
    }
    setAssignTarget({ ...assignTarget, sessions: next });
  }

  async function onAssignClick() {
    if (!exercise || !assignTarget || planBusy) return;
    setPlanBusy(true);
    setPlanError("");
    try {
      if (assignInPlan) {
        await persistAssignSessions(
          mapAssignSessions((session) => ({
            ...session,
            items: session.items.filter((item) => !itemMatchesExercise(item, exercise.id)),
          })),
        );
        setRxOpen(false);
        return;
      }
      await persistAssignSessions(
        mapAssignSessions((session) => ({
          ...session,
          items: [
            {
              exerciseId: exercise.id,
              exercise: {
                id: exercise.id,
                name: exercise.name,
                ...(exercise.image ? { image: exercise.image } : {}),
                ...(exercise.gif_url ? { gif_url: exercise.gif_url } : {}),
                ...(exercise.category ? { category: exercise.category } : {}),
                ...(exercise.equipment ? { equipment: exercise.equipment } : {}),
              },
            },
            ...session.items,
          ],
        })),
      );
      setRxOpen(true);
    } catch {
      setPlanError(t("addToPlanFail"));
    } finally {
      setPlanBusy(false);
    }
  }

  function startRemove() {
    if (!user || !exercise) return;
    const prev = user;
    applyUser(withoutExercise(user, exercise.id));
    undoRef.current = { exerciseId: exercise.id, prev };
    setPlanUndo(true);
    setRxOpen(false);
    window.clearTimeout(undoTimer.current);
    undoTimer.current = window.setTimeout(() => requestClose(), 1000);
  }

  function undoRemove() {
    const snap = undoRef.current;
    undoRef.current = null;
    window.clearTimeout(undoTimer.current);
    undoTimer.current = 0;
    setPlanUndo(false);
    if (snap) applyUser(snap.prev);
  }

  async function onPlanClick() {
    if (!user) {
      openAuth();
      return;
    }
    if (planBusy) return;
    if (canRemove) {
      if (planUndo) undoRemove();
      else startRemove();
      return;
    }
    if (inPlan || !exercise) return;

    setPlanBusy(true);
    setPlanError("");
    try {
      applyUser(await addToTrainingProgram([exercise.id], targetSession?.id));
    } catch {
      setPlanError(t("addToPlanFail"));
    } finally {
      setPlanBusy(false);
    }
  }

  async function onPrescriptionSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!exercise || !user) return;
    const form = new FormData(event.currentTarget);
    const setsRaw = String(form.get("sets") ?? "").trim();
    const repsRaw = String(form.get("reps") ?? "").trim();
    const restRaw = String(form.get("rest") ?? "").trim();
    const notes = String(form.get("notes") ?? "").trim();

    const updates: { sets?: number; reps?: string; rest?: number; notes: string } = { notes };
    if (setsRaw) {
      const sets = Number(setsRaw);
      if (!Number.isInteger(sets) || sets < 1) {
        setRxStatus(t("prescriptionNeedField"));
        return;
      }
      updates.sets = sets;
    }
    if (repsRaw) {
      const reps = formatReps(repsRaw);
      if (!reps) {
        setRxStatus(t("prescriptionRepsFormat"));
        return;
      }
      updates.reps = reps;
    }
    if (restRaw) {
      const rest = Number(restRaw);
      if (!Number.isInteger(rest) || rest < 0) {
        setRxStatus(t("prescriptionNeedField"));
        return;
      }
      updates.rest = rest;
    }
    if (!("sets" in updates) && !("reps" in updates) && !("rest" in updates) && !notes) {
      setRxStatus(t("prescriptionNeedField"));
      return;
    }

    try {
      if (assignTarget) {
        await persistAssignSessions(
          mapAssignSessions((session) => ({
            ...session,
            items: session.items.map((item) =>
              itemMatchesExercise(item, exercise.id) ? { ...item, ...updates } : item,
            ),
          })),
        );
      } else {
        applyUser(await updateTrainingProgramExercise(exercise.id, updates));
      }
      setRxOpen(false);
      setRxStatus("");
    } catch {
      setRxStatus(t("prescriptionSaveFail"));
    }
  }

  return (
    <div
      className="modal-overlay open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="modal-panel">
        <div className="modal-header">
          <div className="modal-title-row">
            <h2 className="modal-title" id="modal-title">
              {name}
            </h2>
            <button
              type="button"
              className={`modal-share${copied ? " is-copied" : ""}`}
              aria-label={t("copyLink")}
              title={t("copyLink")}
              onClick={async () => {
                const link = exerciseShareUrl(exercise.id);
                try {
                  await navigator.clipboard.writeText(link);
                } catch {
                  /* ignore */
                }
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1400);
              }}
            >
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
              >
                <path
                  d="M10 13a5 5 0 0 0 7.07 0l2.83-2.83a5 5 0 0 0-7.07-7.07L11 4.76"
                  strokeLinecap="round"
                />
                <path
                  d="M14 11a5 5 0 0 0-7.07 0L4.1 13.83a5 5 0 0 0 7.07 7.07L13 19.24"
                  strokeLinecap="round"
                />
              </svg>
              {copied ? <span className="modal-share-feedback">{t("linkCopied")}</span> : null}
            </button>
          </div>
          <button type="button" className="modal-close" aria-label="Close" onClick={requestClose}>
            ✕
          </button>
        </div>

        <div className="modal-media">
          <img
            className="modal-gif"
            src={assetUrl(exercise.gif_url || exercise.image)}
            alt={name}
          />
        </div>

        <div className="modal-meta">
          <MetaChip
            label={t("bodyPart")}
            value={valueLabel(exercise.body_part || exercise.category, lang)}
          />
          <MetaChip label={t("equipment")} value={valueLabel(exercise.equipment, lang)} />
          <MetaChip label={t("targetMeta")} value={valueLabel(exercise.target, lang)} />
        </div>

        {showPlanActions ? (
          <div className="modal-actions">
            {!isAssign && !isTraining && sessions.length > 1 ? (
              <label className="modal-rx-field">
                <span className="modal-rx-label">{t("trainingSessionsHeading")}</span>
                <select
                  value={targetSession?.id ?? ""}
                  onChange={(event) => setActiveSessionId(event.target.value || null)}
                >
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <div className="modal-actions-row">
              <button
                type="button"
                className={`modal-plan-btn${
                  !isAssign && planUndo
                    ? " is-undo"
                    : isAssign
                      ? assignInPlan
                        ? " is-remove"
                        : ""
                      : canRemove
                        ? " is-remove"
                        : inPlan
                          ? " is-in-plan"
                          : ""
                }${planBusy ? " is-busy" : ""}`}
                disabled={planBusy || (!isAssign && inPlan && !canRemove)}
                onClick={() => void (isAssign ? onAssignClick() : onPlanClick())}
              >
                <span className="modal-plan-btn-fill" hidden={!planUndo || isAssign} aria-hidden="true" />
                <span className="modal-plan-btn-label">
                  {planError ||
                    (planBusy
                      ? t("loading")
                      : isAssign
                        ? assignInPlan
                          ? t("sessionRemoveExercise")
                          : t("sessionAddTo")
                        : !user
                          ? t("addToPlanLogin")
                          : planUndo
                            ? t("undo")
                            : canRemove
                              ? t("removeFromPlan")
                              : inPlan
                                ? t("inPlan")
                                : targetSession
                                  ? t("addToSession", { name: targetSession.name })
                                  : t("addToPlan"))}
                </span>
              </button>
              {canEditRx ? (
                <button
                  type="button"
                  className={`modal-rx-btn${rxOpen ? " is-open" : ""}`}
                  aria-expanded={rxOpen}
                  title={t("editPrescription")}
                  onClick={() => setRxOpen((value) => !value)}
                >
                  <svg
                    viewBox="0 0 24 24"
                    width="16"
                    height="16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                  </svg>
                  <span className="sr-only">{t("editPrescription")}</span>
                </button>
              ) : null}
            </div>
            {canEditRx && !rxOpen ? (
              <RxSummary {...(rxItem ? { item: rxItem } : {})} emptyLabel={t("programBare")} />
            ) : null}
            {canEditRx && rxOpen ? (
              <form
                className="modal-rx-form is-open"
                onSubmit={(event) => void onPrescriptionSubmit(event)}
              >
                <div className="modal-rx-grid">
                  <label className="modal-rx-field">
                    <span className="modal-rx-label">{t("prescriptionSets")}</span>
                    <input
                      ref={rxSetsRef}
                      type="number"
                      name="sets"
                      min={1}
                      inputMode="numeric"
                      defaultValue={rxItem?.sets ?? ""}
                    />
                  </label>
                  <label className="modal-rx-field">
                    <span className="modal-rx-label">{t("prescriptionReps")}</span>
                    <input
                      type="text"
                      name="reps"
                      placeholder="6 o 8-12"
                      defaultValue={rxItem?.reps ? cleanReps(rxItem.reps) : ""}
                      onInput={(event) => {
                        const input = event.currentTarget;
                        const next = cleanReps(input.value);
                        if (input.value !== next) input.value = next;
                      }}
                    />
                  </label>
                  <label className="modal-rx-field">
                    <span className="modal-rx-label">{t("prescriptionRest")}</span>
                    <input
                      type="number"
                      name="rest"
                      min={0}
                      inputMode="numeric"
                      defaultValue={rxItem?.rest ?? ""}
                    />
                  </label>
                </div>
                <label className="modal-rx-field">
                  <span className="modal-rx-label">{t("prescriptionNotes")}</span>
                  <textarea name="notes" rows={1} defaultValue={rxItem?.notes ?? ""} />
                </label>
                {rxStatus ? <p className="modal-rx-status is-error">{rxStatus}</p> : null}
                <button type="submit" className="modal-rx-submit">
                  {t("prescriptionSave")}
                </button>
              </form>
            ) : null}
          </div>
        ) : null}

        <Muscles
          exercise={exercise}
          lang={lang}
          primaryLabel={t("primary")}
          secondaryLabel={t("secondary")}
          musclesLabel={t("muscles")}
        />

        {instrLangs.length > 0 ? (
          <div className="modal-instructions">
            <span className="modal-instructions-label">{t("instructions")}</span>
            {instrLangs.length > 1 ? (
              <div className="lang-tabs">
                {instrLangs.map((code) => (
                  <button
                    key={code}
                    type="button"
                    className={`lang-tab${(instrLangs.includes(instrLang) ? instrLang : instrLangs[0]) === code ? " active" : ""}`}
                    onClick={() => setInstrLang(code)}
                  >
                    {code === "es" ? "Español" : "English"}
                  </button>
                ))}
              </div>
            ) : null}
            <ol className="instructions-list">
              {activeSteps.map((step, index) => (
                <li key={`${index}-${step}`} className="instruction-step">
                  <span className="step-num">{index + 1}</span>
                  <span className="step-text">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function itemMatchesExercise(item: TrainingProgramItem, exerciseId: string | null) {
  if (!exerciseId) return false;
  return String(item.exercise?.id || item.exerciseId) === String(exerciseId);
}

function withoutExercise(current: MeUser, exerciseId: string): MeUser {
  return {
    ...current,
    trainingProgram: (current.trainingProgram ?? []).filter(
      (item) => !itemMatchesExercise(item, exerciseId),
    ),
  };
}

function MetaChip({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="meta-chip">
      <span className="meta-chip-label">{label}</span>
      <span className="meta-chip-value">{value}</span>
    </div>
  );
}

function Muscles({
  exercise,
  lang,
  primaryLabel,
  secondaryLabel,
  musclesLabel,
}: {
  exercise: Exercise;
  lang: Lang;
  primaryLabel: string;
  secondaryLabel: string;
  musclesLabel: string;
}) {
  const primary = exercise.target ? [exercise.target] : [];
  const secondary = (exercise.secondary_muscles ?? []).filter((name) => name !== exercise.target);
  if (!primary.length && !secondary.length) return null;

  return (
    <div className="modal-muscles">
      <div className="modal-muscles-label">{musclesLabel}</div>
      <div className="muscles-grid">
        {primary.length ? (
          <div className="muscles-group">
            <div className="muscles-group-label">{primaryLabel}</div>
            <div className="muscle-tags">
              {primary.map((name) => (
                <span key={name} className="muscle-tag primary">
                  {valueLabel(name, lang)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
        {secondary.length ? (
          <div className="muscles-group">
            <div className="muscles-group-label">{secondaryLabel}</div>
            <div className="muscle-tags">
              {secondary.map((name) => (
                <span key={name} className="muscle-tag">
                  {valueLabel(name, lang)}
                </span>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function RxSummary({ item, emptyLabel }: { item?: TrainingProgramItem; emptyLabel: string }) {
  const metrics = [
    item?.sets != null ? { ico: "🏋️", text: String(item.sets) } : null,
    item?.reps ? { ico: "🔁", text: String(item.reps) } : null,
    item?.rest != null ? { ico: "⏱️", text: `${item.rest}s` } : null,
  ].filter((row): row is { ico: string; text: string } => Boolean(row));
  const note = item?.notes?.trim() ?? "";

  if (!metrics.length && !note) {
    return (
      <div className="modal-rx-summary is-empty">
        <p className="modal-rx-summary-empty">{emptyLabel}</p>
      </div>
    );
  }

  return (
    <div className="modal-rx-summary">
      {metrics.length ? (
        <div className="modal-rx-metrics">
          {metrics.map((metric) => (
            <span key={metric.text} className="modal-rx-metric">
              <span className="modal-rx-metric-ico" aria-hidden="true">
                {metric.ico}
              </span>
              <span>{metric.text}</span>
            </span>
          ))}
        </div>
      ) : null}
      {note ? <p className="modal-rx-summary-note">{note}</p> : null}
    </div>
  );
}
