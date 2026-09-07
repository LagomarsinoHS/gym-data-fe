import { useRef, useState } from "react";

import { useI18n } from "@/context/i18n-context";
import { assetUrl } from "@/lib/assets";
import { exerciseName } from "@/lib/labels";
import { hasSeenFeatureHint, markFeatureHintSeen } from "@/lib/session-editor";
import { sessionSets } from "@/lib/training-sessions";
import type { TrainingProgramItem, TrainingSession } from "@/types/user";

let activeSessionDrag: string | null = null;

function sortSessions(sessions: TrainingSession[]) {
  return [...sessions].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export function StudentPlan({
  title,
  addLabel,
  emptyLabel,
  sessions,
  extraAction,
  onAdd,
  onToggleSession,
  onRemoveSession,
  onEditSession,
  onApplyTemplate,
  onReorderSessions,
  openSessionId,
}: {
  title: string;
  addLabel: string;
  emptyLabel: string;
  sessions: TrainingSession[];
  extraAction?: { label: string; onClick: () => void };
  onAdd: () => void;
  onToggleSession: (sessionId: string) => void;
  onRemoveSession: (session: TrainingSession) => void;
  onEditSession: (session: TrainingSession) => void;
  onApplyTemplate?: (session: TrainingSession) => void;
  onReorderSessions?: (sessions: TrainingSession[]) => void;
  openSessionId: string | null;
}) {
  const { t } = useI18n();
  const ordered = sortSessions(sessions);
  const canDrag = Boolean(onReorderSessions) && ordered.length >= 2;
  const [showHint, setShowHint] = useState(() => !hasSeenFeatureHint("reorder-sessions"));

  function moveSession(sessionId: string, toIndex: number) {
    const from = ordered.findIndex((row) => row.id === sessionId);
    const clamped = Math.max(0, Math.min(ordered.length - 1, toIndex));
    if (from < 0 || clamped === from) return;
    const next = [...ordered];
    const [moved] = next.splice(from, 1);
    if (!moved) return;
    next.splice(clamped, 0, moved);
    markFeatureHintSeen("reorder-sessions");
    setShowHint(false);
    onReorderSessions?.(next.map((session, order) => ({ ...session, order })));
  }

  return (
    <div className="student-plan">
      <div className="student-plan-head">
        <span className="student-plan-title">{title}</span>
        <div className="student-plan-head-actions">
          <button type="button" className="student-plan-add" onClick={onAdd}>
            {addLabel}
          </button>
          {extraAction ? (
            <button
              type="button"
              className="student-plan-use-template"
              onClick={extraAction.onClick}
            >
              {extraAction.label}
            </button>
          ) : null}
        </div>
      </div>
      {canDrag && showHint ? (
        <div className="feature-hint feature-hint--plan" role="status" data-hint-id="reorder-sessions">
          <div className="feature-hint-bubble">
            <p className="feature-hint-text">{t("hintReorderSessions")}</p>
            <button
              type="button"
              className="feature-hint-dismiss"
              onClick={() => {
                markFeatureHintSeen("reorder-sessions");
                setShowHint(false);
              }}
            >
              {t("hintDismiss")}
            </button>
          </div>
          <span className="feature-hint-tail" aria-hidden="true" />
        </div>
      ) : null}
      <div className="student-session-list">
        {!ordered.length ? <p className="student-plan-empty">{emptyLabel}</p> : null}
        {ordered.map((session) => (
          <StudentSessionRow
            key={session.id}
            session={session}
            open={openSessionId === session.id}
            canDrag={canDrag}
            onMoved={(draggedId, before) => {
              if (!draggedId || draggedId === session.id) return;
              const fromIndex = ordered.findIndex((row) => row.id === draggedId);
              const targetIndex = ordered.findIndex((row) => row.id === session.id);
              if (fromIndex < 0 || targetIndex < 0) return;
              let toIndex = before ? targetIndex : targetIndex + 1;
              if (fromIndex < toIndex) toIndex -= 1;
              moveSession(draggedId, toIndex);
            }}
            onToggle={() => onToggleSession(session.id)}
            onRemove={() => onRemoveSession(session)}
            onEdit={() => onEditSession(session)}
            onApply={onApplyTemplate ? () => onApplyTemplate(session) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function StudentSessionRow({
  session,
  open,
  canDrag,
  onMoved,
  onToggle,
  onRemove,
  onEdit,
  onApply,
}: {
  session: TrainingSession;
  open: boolean;
  canDrag: boolean;
  onMoved: (draggedId: string, before: boolean) => void;
  onToggle: () => void;
  onRemove: () => void;
  onEdit: () => void;
  onApply?: () => void;
}) {
  const { t } = useI18n();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const suppressClickRef = useRef(false);
  const items = session.items ?? [];
  const sets = sessionSets(session);

  function toggleUnlessDrag() {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }
    onToggle();
  }

  function clearDraggable() {
    const row = rowRef.current;
    if (row && !activeSessionDrag) row.draggable = false;
  }

  function clearDropMarkers(except?: HTMLElement | null) {
    const parent = rowRef.current?.parentElement;
    parent?.querySelectorAll<HTMLElement>(".student-session").forEach((el) => {
      if (el === except) return;
      el.classList.remove("is-drop-before", "is-drop-after");
    });
  }

  return (
    <div
      ref={rowRef}
      className={`student-session${open ? " is-open" : ""}${canDrag ? " is-draggable" : ""}`}
      data-session-id={session.id}
      title={canDrag ? t("sessionDragHandle") : undefined}
      onPointerDown={(event) => {
        if (!canDrag || (event.button != null && event.button !== 0)) return;
        const row = rowRef.current;
        if (!row) return;
        const target = event.target as Element | null;
        if (
          target?.closest(
            ".student-session-remove, .student-session-edit, .student-session-actions button, button, a, input, select, textarea",
          )
        ) {
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
        activeSessionDrag = session.id;
        suppressClickRef.current = true;
        row.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", session.id);
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
        activeSessionDrag = null;
      }}
      onDragOver={(event) => {
        if (!activeSessionDrag || activeSessionDrag === session.id) return;
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
        if (!activeSessionDrag) return;
        event.preventDefault();
        event.stopPropagation();
        const row = rowRef.current;
        const draggedId = activeSessionDrag;
        const before = Boolean(row?.classList.contains("is-drop-before"));
        row?.classList.remove("is-drop-before", "is-drop-after");
        clearDropMarkers();
        onMoved(draggedId, before);
      }}
    >
      <div className="student-session-top">
        <div
          className="student-session-header"
          role="button"
          tabIndex={0}
          aria-expanded={open}
          onClick={toggleUnlessDrag}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              toggleUnlessDrag();
            }
          }}
        >
          <span className="student-session-name">{session.name}</span>
          <span className="student-session-meta">
            <span className="student-session-stat">
              <strong className="student-session-stat-value">{items.length}</strong>
              <span className="student-session-stat-unit">{t("sessionExercisesUnit")}</span>
            </span>
            {items.length ? (
              <span className="student-session-stat student-session-stat--sets">
                <strong className="student-session-stat-value">{sets}</strong>
                <span className="student-session-stat-unit">{t("sessionSetsUnit")}</span>
              </span>
            ) : null}
          </span>
          <span className="student-session-chevron" aria-hidden="true" />
        </div>
        <button
          type="button"
          className="student-session-remove"
          aria-label={t("sessionRemove")}
          title={t("sessionRemove")}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
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
      <div className="student-session-body">
        {items.length ? (
          <div className="student-session-summary">
            {items.map((item, index) => (
              <MiniCard key={`${session.id}-${item.exerciseId}-${index}`} item={item} />
            ))}
          </div>
        ) : (
          <p className="student-session-empty">{t("sessionEmptyItems")}</p>
        )}
        <div className="student-session-actions">
          <button
            type="button"
            className="student-session-edit"
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          >
            {items.length ? t("sessionEdit") : t("sessionAddExercises")}
          </button>
          {onApply ? (
            <button
              type="button"
              className="student-session-apply"
              disabled={!items.length}
              title={items.length ? t("templateApply") : t("templateApplyNeedsExercises")}
              onClick={(event) => {
                event.stopPropagation();
                onApply();
              }}
            >
              {t("templateApply")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function MiniCard({ item }: { item: TrainingProgramItem }) {
  const { t, lang } = useI18n();
  const [broken, setBroken] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const name = exerciseName(item.exercise, lang) || item.exerciseId || "—";
  const image = !broken ? assetUrl(item.exercise?.image || item.exercise?.gif_url) : "";
  const lines = [
    item.sets != null ? { ico: "🏋️", text: `${item.sets} ${t("prescriptionSets")}` } : null,
    item.reps ? { ico: "🔁", text: `${item.reps} ${t("prescriptionReps")}` } : null,
    item.rest != null ? { ico: "⏱️", text: `${item.rest}s` } : null,
  ].filter((row): row is { ico: string; text: string } => Boolean(row));
  const note = item.notes?.trim() ?? "";

  return (
    <article className="student-session-mini">
      <div
        className={`student-session-mini-media${image ? "" : " is-fallback"}${loaded ? " has-image" : ""}`}
      >
        {image ? (
          <img
            className="student-session-mini-thumb"
            src={image}
            alt={name}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setBroken(true)}
          />
        ) : (
          name.slice(0, 1).toUpperCase() || "?"
        )}
      </div>
      <div className="student-session-mini-main">
        <h4 className="student-session-mini-name">{name}</h4>
        <div className="student-session-mini-rx">
          {lines.length ? (
            lines.map((line) => (
              <span key={line.text} className="student-session-mini-chip">
                <span aria-hidden="true">{line.ico}</span>
                <span>{line.text}</span>
              </span>
            ))
          ) : (
            <span className="student-session-mini-bare">{t("programBare")}</span>
          )}
        </div>
        {note ? (
          <p className="student-session-mini-note" title={note}>
            {note}
          </p>
        ) : null}
      </div>
    </article>
  );
}
