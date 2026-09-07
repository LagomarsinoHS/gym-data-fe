import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getCoachTemplates, setCoachTemplates } from "@/api/coach-templates";
import { listCoachAthletes, setAthleteCoachProgram } from "@/api/users";
import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { assetUrl } from "@/lib/assets";
import { exerciseName } from "@/lib/labels";
import {
  athleteEditorPath,
  hasSeenFeatureHint,
  markFeatureHintSeen,
  templateEditorPath,
} from "@/lib/session-editor";
import { patchStudentProgram } from "@/lib/students-cache";
import { sessionSets } from "@/lib/training-sessions";
import { personName } from "@/lib/user-display";
import type { TrainingProgramItem, TrainingSession } from "@/types/user";

export function SessionEditorPage() {
  const { sessionId = "", athleteId } = useParams();
  const isTemplate = !athleteId;
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const { assignTarget, setAssignTarget, openExercise } = useCatalog();
  const [sessions, setSessions] = useState<TrainingSession[]>([]);
  const [athleteName, setAthleteName] = useState("");
  const [loading, setLoading] = useState(true);
  const [draftName, setDraftName] = useState("");
  const [showHint, setShowHint] = useState(() => !hasSeenFeatureHint("reorder-exercises"));

  const session = useMemo(
    () => sessions.find((row) => row.id === sessionId) ?? null,
    [sessions, sessionId],
  );

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (isTemplate ? loadTemplates() : loadAthlete())
      .catch(() => {
        if (!cancelled) {
          setSessions([]);
          setAthleteName("");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isTemplate, athleteId, sessionId]);

  useEffect(() => {
    if (
      assignTarget &&
      assignTarget.sessionId === sessionId &&
      (isTemplate ? assignTarget.kind === "template" : assignTarget.athleteId === athleteId)
    ) {
      setSessions(assignTarget.sessions);
      setDraftName(assignTarget.sessionName);
    }
  }, [assignTarget, athleteId, isTemplate, sessionId]);

  useEffect(() => {
    if (session) setDraftName(session.name);
  }, [session?.id, session?.name]);

  async function loadTemplates() {
    const data = await getCoachTemplates();
    const next = data.coachTemplates ?? [];
    setSessions(next);
    setAthleteName(t("coachTemplates"));
  }

  async function loadAthlete() {
    if (!athleteId) return;
    const data = await listCoachAthletes({ page: 1, limit: 50 });
    const athlete = (data.data ?? []).find((row) => row.id === athleteId);
    if (!athlete) {
      setSessions([]);
      setAthleteName("");
      return;
    }
    setSessions(athlete.coachTrainingProgram ?? []);
    setAthleteName(personName(athlete.profile) || athlete.email);
  }

  async function persist(next: TrainingSession[]) {
    if (isTemplate) {
      const data = await setCoachTemplates(next);
      const saved = data.coachTemplates ?? next;
      setSessions(saved);
      syncAssign(saved);
      return saved;
    }
    if (!athleteId) return next;
    await setAthleteCoachProgram(athleteId, next);
    patchStudentProgram(athleteId, next);
    setSessions(next);
    syncAssign(next);
    return next;
  }

  function syncAssign(next: TrainingSession[]) {
    if (!assignTarget || assignTarget.sessionId !== sessionId) return;
    const current = next.find((row) => row.id === sessionId);
    setAssignTarget({
      ...assignTarget,
      sessions: next,
      sessionName: current?.name ?? assignTarget.sessionName,
    });
  }

  function editorPath() {
    return isTemplate ? templateEditorPath(sessionId) : athleteEditorPath(athleteId!, sessionId);
  }

  function backPath() {
    return isTemplate ? "/plantillas" : "/alumnos";
  }

  function armAssign(nextSessions = sessions) {
    const current = nextSessions.find((row) => row.id === sessionId);
    if (!current) return;
    setAssignTarget({
      kind: isTemplate ? "template" : "athlete",
      athleteId: athleteId || "__templates__",
      sessionId,
      sessionName: current.name,
      athleteName: isTemplate ? t("coachTemplates") : athleteName,
      returnTo: editorPath(),
      sessions: nextSessions,
    });
  }

  async function onRename() {
    const nextName = draftName.trim().slice(0, 80);
    if (!session || !nextName || nextName === session.name) {
      setDraftName(session?.name ?? "");
      return;
    }
    await persist(
      sessions.map((row) => (row.id === session.id ? { ...row, name: nextName } : row)),
    );
  }

  async function onReorder(exerciseId: string, toIndex: number) {
    if (!session) return;
    const sorted = sortItems(session.items);
    const from = sorted.findIndex(
      (item) => String(item.exercise?.id || item.exerciseId) === exerciseId,
    );
    const clamped = Math.max(0, Math.min(sorted.length - 1, toIndex));
    if (from < 0 || clamped === from) return;
    const nextItems = [...sorted];
    const [moved] = nextItems.splice(from, 1);
    if (!moved) return;
    nextItems.splice(clamped, 0, moved);
    const nextSessions = sessions.map((row) =>
      row.id === session.id
        ? { ...row, items: nextItems.map((item, order) => ({ ...item, order })) }
        : row,
    );
    markFeatureHintSeen("reorder-exercises");
    setShowHint(false);
    setSessions(nextSessions);
    await persist(nextSessions);
  }

  async function onRemoveItem(exerciseId: string) {
    if (!session) return;
    await persist(
      sessions.map((row) =>
        row.id === session.id
          ? {
              ...row,
              items: row.items.filter(
                (item) => String(item.exercise?.id || item.exerciseId) !== exerciseId,
              ),
            }
          : row,
      ),
    );
  }

  const items = sortItems(session?.items ?? []);
  const sets = session ? sessionSets(session) : 0;
  const subtitle = [
    isTemplate ? null : athleteName,
    items.length === 1 ? "1 ejercicio" : t("sessionExercisesCount", { n: items.length }),
    items.length ? (sets === 1 ? "1 serie" : t("sessionSetsCount", { n: sets })) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  if (!loading && !session) {
    return (
      <div className="session-editor-view">
        <div className="session-editor">
          <button type="button" className="session-editor-back" onClick={() => navigate(backPath())}>
            <BackIcon />
            <span>{isTemplate ? t("coachTemplates") : t("sessionEditorBack")}</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="session-editor-view" id="session-editor-view">
      <div className="session-editor">
        <div className="session-editor-chrome">
          <button
            type="button"
            className="session-editor-back"
            onClick={() => {
              setAssignTarget(null);
              navigate(backPath());
            }}
          >
            <BackIcon />
            <span>{isTemplate ? t("coachTemplates") : t("sessionEditorBack")}</span>
          </button>
          <header className="session-editor-header">
            <div className="session-editor-heading">
              <p className="session-editor-kicker">
                {isTemplate ? t("coachTemplatesKicker") : t("sessionEditorKicker")}
              </p>
              <input
                type="text"
                className="session-editor-title"
                name="sessionName"
                maxLength={80}
                autoComplete="off"
                aria-label={isTemplate ? t("coachTemplatesKicker") : t("sessionEditorKicker")}
                value={draftName}
                onChange={(event) => setDraftName(event.target.value)}
                onBlur={() => void onRename()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              <p className="session-editor-subtitle">{subtitle}</p>
            </div>
            <button
              type="button"
              className="recommend-cta session-editor-add"
              onClick={() => {
                armAssign();
                navigate("/");
              }}
            >
              <span>{t("sessionAddExercises")}</span>
            </button>
          </header>
        </div>
        <div
          id="session-editor-hint"
          className="session-editor-hint-host"
          hidden={!showHint || items.length < 2}
        >
          {showHint && items.length >= 2 ? (
            <div className="feature-hint feature-hint--editor" role="status" data-hint-id="reorder-exercises">
              <div className="feature-hint-bubble">
                <p className="feature-hint-text">{t("hintReorderExercises")}</p>
                <button
                  type="button"
                  className="feature-hint-dismiss"
                  onClick={() => {
                    markFeatureHintSeen("reorder-exercises");
                    setShowHint(false);
                  }}
                >
                  {t("hintDismiss")}
                </button>
              </div>
              <span className="feature-hint-tail" aria-hidden="true" />
            </div>
          ) : null}
        </div>
        <div className="session-editor-list">
          {items.map((item) => {
            const id = String(item.exercise?.id || item.exerciseId || "");
            const name = exerciseName(item.exercise, lang) || id || "—";
            return (
              <EditorItem
                key={`${sessionId}-${id}`}
                item={item}
                name={name}
                canDrag={items.length >= 2}
                onMoved={(draggedId, before) => {
                  if (!draggedId || draggedId === id) return;
                  const fromIndex = items.findIndex(
                    (row) => String(row.exercise?.id || row.exerciseId) === draggedId,
                  );
                  const targetIndex = items.findIndex(
                    (row) => String(row.exercise?.id || row.exerciseId) === id,
                  );
                  if (fromIndex < 0 || targetIndex < 0) return;
                  let toIndex = before ? targetIndex : targetIndex + 1;
                  if (fromIndex < toIndex) toIndex -= 1;
                  void onReorder(draggedId, toIndex);
                }}
                onEdit={() => {
                  if (!id) return;
                  armAssign();
                  openExercise(id);
                }}
                onRemove={() => {
                  if (id) void onRemoveItem(id);
                }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

let activeExerciseDrag: string | null = null;

function sortItems(items: TrainingProgramItem[]) {
  return [...items].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

function EditorItem({
  item,
  name,
  canDrag,
  onMoved,
  onEdit,
  onRemove,
}: {
  item: TrainingProgramItem;
  name: string;
  canDrag: boolean;
  onMoved: (draggedId: string, before: boolean) => void;
  onEdit: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const rowRef = useRef<HTMLElement | null>(null);
  const imageSrc = assetUrl(item.exercise?.image || item.exercise?.gif_url);
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const lines = prescriptionLines(item, {
    sets: t("prescriptionSets"),
    reps: t("prescriptionReps"),
  });
  const note = String(item.notes || "").trim();
  const exerciseId = String(item.exercise?.id || item.exerciseId || "");

  function clearDraggable() {
    const row = rowRef.current;
    if (row && !activeExerciseDrag) row.draggable = false;
  }

  function clearDropMarkers(except?: HTMLElement | null) {
    const parent = rowRef.current?.parentElement;
    parent?.querySelectorAll<HTMLElement>(".session-editor-item").forEach((el) => {
      if (el === except) return;
      el.classList.remove("is-drop-before", "is-drop-after");
    });
  }

  return (
    <article
      ref={(el) => {
        rowRef.current = el;
      }}
      className={`session-editor-item${canDrag ? " is-draggable" : ""}`}
      data-id={exerciseId}
      title={canDrag ? t("sessionExerciseDragHandle") : undefined}
      onPointerDown={(event) => {
        if (!canDrag || (event.button != null && event.button !== 0)) return;
        const row = rowRef.current;
        if (!row) return;
        const target = event.target as Element | null;
        if (target?.closest("button, a, input, select, textarea")) {
          row.draggable = false;
          return;
        }
        row.draggable = true;
      }}
      onPointerUp={clearDraggable}
      onPointerCancel={clearDraggable}
      onDragStart={(event) => {
        const row = rowRef.current;
        if (!canDrag || !row?.draggable) {
          event.preventDefault();
          return;
        }
        activeExerciseDrag = exerciseId;
        row.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", exerciseId);
        try {
          event.dataTransfer.setDragImage(row, 40, 24);
        } catch {
          /* some browsers reject custom drag image */
        }
      }}
      onDragEnd={() => {
        const row = rowRef.current;
        if (row) {
          row.draggable = false;
          row.classList.remove("is-dragging", "is-drop-before", "is-drop-after");
        }
        clearDropMarkers();
        activeExerciseDrag = null;
      }}
      onDragOver={(event) => {
        if (!activeExerciseDrag || activeExerciseDrag === exerciseId) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        const row = rowRef.current;
        if (!row) return;
        const rect = row.getBoundingClientRect();
        const before = event.clientY < rect.top + rect.height / 2;
        row.classList.toggle("is-drop-before", before);
        row.classList.toggle("is-drop-after", !before);
        clearDropMarkers(row);
      }}
      onDragLeave={(event) => {
        const row = rowRef.current;
        if (!row || row.contains(event.relatedTarget as Node | null)) return;
        row.classList.remove("is-drop-before", "is-drop-after");
      }}
      onDrop={(event) => {
        if (!activeExerciseDrag) return;
        event.preventDefault();
        event.stopPropagation();
        const row = rowRef.current;
        const draggedId = activeExerciseDrag;
        const before = Boolean(row?.classList.contains("is-drop-before"));
        row?.classList.remove("is-drop-before", "is-drop-after");
        clearDropMarkers();
        onMoved(draggedId, before);
      }}
    >
      <div
        className={`session-editor-item-media${imageSrc && !broken ? "" : " is-fallback"}${loaded ? " has-image" : ""}`}
      >
        {imageSrc && !broken ? (
          <img
            className="session-editor-thumb"
            src={imageSrc}
            alt={name}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
          />
        ) : (
          name.slice(0, 1).toUpperCase() || "?"
        )}
      </div>
      <div className="session-editor-item-main">
        <h3 className="session-editor-item-name">{name}</h3>
        <div className="session-editor-item-rx">
          {lines.length ? (
            lines.map((line) => (
              <span key={line.text} className="session-editor-rx-chip">
                <span aria-hidden="true">{line.ico}</span>
                <span>{line.text}</span>
              </span>
            ))
          ) : (
            <span className="session-editor-rx-bare">{t("programBare")}</span>
          )}
        </div>
        {note ? (
          <p className="session-editor-item-note" title={note}>
            {note}
          </p>
        ) : null}
      </div>
      <div className="session-editor-item-actions">
        <button type="button" className="session-editor-item-edit" onClick={onEdit}>
          {t("sessionEditExercise")}
        </button>
        <button
          type="button"
          className="session-editor-item-remove"
          aria-label={t("sessionRemoveExercise")}
          title={t("sessionRemoveExercise")}
          onClick={onRemove}
        >
          <svg
            viewBox="0 0 16 16"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M4 4l8 8M12 4L4 12" />
          </svg>
        </button>
      </div>
    </article>
  );
}

function prescriptionLines(item: TrainingProgramItem, labels: { sets: string; reps: string }) {
  const lines: { ico: string; text: string }[] = [];
  if (item.sets != null) lines.push({ ico: "🏋️", text: `${item.sets} ${labels.sets}` });
  if (item.reps) lines.push({ ico: "🔁", text: `${item.reps} ${labels.reps}` });
  if (item.rest != null) lines.push({ ico: "⏱️", text: `${item.rest}s` });
  return lines;
}

function BackIcon() {
  return (
    <span className="session-editor-back-ico" aria-hidden="true">
      <svg
        viewBox="0 0 16 16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M10 3L5 8l5 5" />
      </svg>
    </span>
  );
}
