import { useState } from "react";

import { assetUrl } from "@/lib/assets";
import { exerciseName, valueLabel } from "@/lib/labels";
import type { Lang } from "@/lib/prefs";
import type { Exercise } from "@/types/exercise";

export function ExerciseCard({
  exercise,
  lang,
  index,
  onOpen,
}: {
  exercise: Exercise;
  lang: Lang;
  index: number;
  onOpen: (id: string) => void;
}) {
  const name = exerciseName(exercise, lang);
  const gifSrc = assetUrl(exercise.gif_url);
  const [gifReady, setGifReady] = useState(false);

  return (
    <article
      className="exercise-card card-enter"
      data-id={exercise.id}
      style={{ ["--card-i" as string]: String(Math.min(index, 11)) }}
      onClick={() => onOpen(exercise.id)}
      onMouseEnter={() => {
        if (gifSrc) setGifReady(true);
      }}
    >
      <div className="card-media">
        <img
          className="card-thumb is-loaded"
          src={assetUrl(exercise.image)}
          alt={name}
          loading="lazy"
        />
        {gifReady && gifSrc ? <img className="card-gif" src={gifSrc} alt="" /> : null}
      </div>
      <div className="card-body">
        <h3 className="card-name">{name}</h3>
        <div className="card-tags">
          <span className="tag tag-cat">{valueLabel(exercise.category, lang)}</span>
          <span className="tag tag-equip">{valueLabel(exercise.equipment, lang)}</span>
        </div>
      </div>
    </article>
  );
}
