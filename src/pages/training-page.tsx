import { useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { useAuth } from "@/context/auth-context";
import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { assetUrl } from "@/lib/assets";
import { exerciseName, valueLabel } from "@/lib/labels";
import { itemMatchesSearch } from "@/lib/training-sessions";
import type { Lang } from "@/lib/prefs";
import type { TrainingProgramItem } from "@/types/user";

export function TrainingPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { search, openExercise, flashExerciseId, clearFlashExercise } = useCatalog();

  const items = useMemo(
    () =>
      [...(user?.trainingProgram ?? [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [user],
  );
  const query = search.trim();
  const visible = useMemo(
    () => (query ? items.filter((item) => itemMatchesSearch(item, query)) : items),
    [items, query],
  );

  if (!items.length) {
    return (
      <div id="training-view" className="training-view">
        <div className="empty-state">
          <p>📋</p>
          <p>{t("trainingEmpty")}</p>
          <Link to="/" className="empty-state-cta">
            {t("goToCatalog")}
          </Link>
        </div>
      </div>
    );
  }

  if (!visible.length) {
    return (
      <div id="training-view" className="training-view">
        <div className="empty-state">
          <p>🔍</p>
          <p>{t("empty")}</p>
        </div>
      </div>
    );
  }

  return (
    <div id="training-view" className="training-view">
      <div className="training-grid">
        {visible.map((item, index) => (
          <TrainingCard
            key={`${item.exerciseId}-${index}`}
            item={item}
            lang={lang}
            bareLabel={t("programBare")}
            setsLabel={t("prescriptionSets")}
            repsLabel={t("prescriptionReps")}
            flashing={flashExerciseId === String(item.exercise?.id || item.exerciseId)}
            onFlashEnd={clearFlashExercise}
            onOpen={() => openExercise(String(item.exercise?.id || item.exerciseId))}
          />
        ))}
      </div>
    </div>
  );
}

function TrainingCard({
  item,
  lang,
  bareLabel,
  setsLabel,
  repsLabel,
  flashing,
  onFlashEnd,
  onOpen,
}: {
  item: TrainingProgramItem;
  lang: Lang;
  bareLabel: string;
  setsLabel: string;
  repsLabel: string;
  flashing: boolean;
  onFlashEnd: () => void;
  onOpen: () => void;
}) {
  const name = exerciseName(item.exercise, lang) || item.exerciseId;
  const thumb = assetUrl(item.exercise?.image);
  const gif = assetUrl(item.exercise?.gif_url);
  const [gifReady, setGifReady] = useState(false);
  const [mediaReady, setMediaReady] = useState(!thumb);
  const note = item.notes?.trim() ?? "";
  const lines = [
    item.sets != null ? { ico: "🏋️", text: `${item.sets} ${setsLabel}` } : null,
    item.reps ? { ico: "🔁", text: `${item.reps} ${repsLabel}` } : null,
    item.rest != null ? { ico: "⏱️", text: `${item.rest}s` } : null,
  ].filter((row): row is { ico: string; text: string } => Boolean(row));

  return (
    <article
      className={`training-card${flashing ? " is-updated" : ""}`}
      data-id={item.exerciseId}
      onAnimationEnd={flashing ? onFlashEnd : undefined}
      onClick={onOpen}
      onMouseEnter={() => {
        if (gif) setGifReady(true);
      }}
    >
      <div className={`training-card-media${mediaReady ? " is-media-ready" : ""}`}>
        {thumb ? (
          <img
            className={`card-thumb${mediaReady ? " is-loaded" : ""}`}
            src={thumb}
            alt={name}
            loading="lazy"
            onLoad={() => setMediaReady(true)}
          />
        ) : null}
        {gifReady && gif ? <img className="card-gif" src={gif} alt="" /> : null}
      </div>
      <div className="training-card-body">
        <h3 className="training-card-name">{name}</h3>
        <div className="card-tags">
          {item.exercise?.category ? (
            <span className="tag tag-cat">{valueLabel(item.exercise.category, lang)}</span>
          ) : null}
          {item.exercise?.equipment ? (
            <span className="tag tag-equip">{valueLabel(item.exercise.equipment, lang)}</span>
          ) : null}
        </div>
        <div className="training-rx-slot">
          {lines.length ? (
            <ul className="training-rx">
              {lines.map((line) => (
                <li key={line.text}>
                  <span className="training-rx-ico" aria-hidden="true">
                    {line.ico}
                  </span>
                  <span>{line.text}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="training-rx-empty">{bareLabel}</p>
          )}
        </div>
        <p className={`training-card-note${note ? "" : " is-empty"}`} title={note || undefined}>
          {note || "\u00a0"}
        </p>
      </div>
    </article>
  );
}
