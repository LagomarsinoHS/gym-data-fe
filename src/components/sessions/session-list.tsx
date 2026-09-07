import { useState, type ReactNode } from "react";

import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { assetUrl } from "@/lib/assets";
import { exerciseName } from "@/lib/labels";
import { itemMatchesSearch, sessionSets } from "@/lib/training-sessions";
import type { TrainingProgramItem, TrainingSession } from "@/types/user";

export function SessionList({
  sessions,
  search = "",
  renderActions,
}: {
  sessions: TrainingSession[];
  search?: string;
  renderActions?: (session: TrainingSession) => ReactNode;
}) {
  const { t, lang } = useI18n();
  const { openExercise } = useCatalog();
  const [openId, setOpenId] = useState<string | null>(null);

  const visible = search.trim()
    ? sessions
        .map((session) => ({
          ...session,
          items: session.items.filter((item) => itemMatchesSearch(item, search)),
        }))
        .filter((session) => session.items.length > 0)
    : sessions;

  if (!visible.length) {
    return (
      <div className="empty-state">
        <p>🔍</p>
        <p>{t(search.trim() ? "empty" : "sessionEmptyItems")}</p>
      </div>
    );
  }

  return (
    <div className="coach-plan-sessions">
      {visible.map((session, index) => {
        const source = sessions.find((row) => row.id === session.id) ?? session;
        const isOpen = (openId ?? visible[0]?.id) === session.id;
        const sets = sessionSets(session);
        return (
          <section key={session.id} className={`coach-plan-session${isOpen ? " is-open" : ""}`}>
            <button
              type="button"
              className="coach-plan-session-header"
              aria-expanded={isOpen}
              onClick={() => setOpenId(isOpen ? "" : session.id)}
            >
              <span className="coach-plan-session-index">{String(index + 1).padStart(2, "0")}</span>
              <span className="coach-plan-session-title">{session.name}</span>
              <span className="coach-plan-session-meta">
                <span className="coach-plan-meta-chip">
                  <strong>{session.items.length}</strong>
                  <span>{t("sessionExercisesUnit")}</span>
                </span>
                {session.items.length ? (
                  <span className="coach-plan-meta-chip coach-plan-meta-chip--sets">
                    <strong>{sets}</strong>
                    <span>{t("sessionSetsUnit")}</span>
                  </span>
                ) : null}
              </span>
              <span className="coach-plan-session-chevron" aria-hidden="true" />
            </button>
            <div className="coach-plan-session-body">
              {renderActions ? (
                <div className="student-session-actions">{renderActions(source)}</div>
              ) : null}
              {session.items.length ? (
                <div className="coach-plan-workout-list">
                  {session.items.map((item, itemIndex) => (
                    <WorkoutRow
                      key={`${session.id}-${item.exerciseId}-${itemIndex}`}
                      item={item}
                      index={itemIndex}
                      lang={lang}
                      bareLabel={t("programBare")}
                      onOpen={() => openExercise(String(item.exercise?.id || item.exerciseId))}
                    />
                  ))}
                </div>
              ) : (
                <p className="coach-plan-session-empty">{t("sessionEmptyItems")}</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function WorkoutRow({
  item,
  index,
  lang,
  bareLabel,
  onOpen,
}: {
  item: TrainingProgramItem;
  index: number;
  lang: "es" | "en";
  bareLabel: string;
  onOpen: () => void;
}) {
  const name = exerciseName(item.exercise, lang) || item.exerciseId;
  const image = assetUrl(item.exercise?.image || item.exercise?.gif_url);
  const chips = [
    item.sets != null ? `🏋️ ${item.sets}` : null,
    item.reps ? `🔁 ${item.reps}` : null,
    item.rest != null ? `⏱️ ${item.rest}s` : null,
  ].filter((row): row is string => Boolean(row));
  const note = item.notes?.trim() ?? "";

  return (
    <article
      className="coach-plan-workout-item"
      style={{ ["--item-i" as string]: String(index) }}
      onClick={onOpen}
    >
      <div className={`coach-plan-workout-media${image ? "" : " is-fallback"}`}>
        {image ? (
          <img className="coach-plan-workout-thumb" src={image} alt={name} loading="lazy" />
        ) : (
          name.slice(0, 1).toUpperCase()
        )}
      </div>
      <div className="coach-plan-workout-main">
        <h4 className="coach-plan-workout-name">{name}</h4>
        <div className="coach-plan-workout-rx">
          {chips.length ? (
            chips.map((chip) => (
              <span key={chip} className="coach-plan-workout-chip">
                {chip}
              </span>
            ))
          ) : (
            <span className="coach-plan-workout-bare">{bareLabel}</span>
          )}
        </div>
        {note ? (
          <p className="coach-plan-workout-note" title={note}>
            {note}
          </p>
        ) : null}
      </div>
    </article>
  );
}
