import { useEffect, useRef } from "react";

import { EasterEggPanel } from "@/components/catalog/easter-egg-panel";
import { ExerciseCard } from "@/components/catalog/exercise-card";
import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";

export function ExerciseGrid() {
  const { t, lang } = useI18n();
  const { exercises, easterEgg, ready, loading, hasMore, error, loadMore, openExercise } =
    useCatalog();
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [loadMore]);

  return (
    <div className="grid-wrapper">
      <div className="exercise-grid">
        {easterEgg ? (
          <EasterEggPanel egg={easterEgg} />
        ) : !ready ? (
          <div className="catalog-boot-loading">
            <div className="load-spinner visible" aria-hidden="true" />
            <span>{t("loading")}</span>
          </div>
        ) : error && exercises.length === 0 ? (
          <div className="empty-state">
            <p>⚠️</p>
            <p>{t("loadFail")}</p>
          </div>
        ) : exercises.length === 0 ? (
          <div className="empty-state">
            <p>🔍</p>
            <p>{t("empty")}</p>
          </div>
        ) : (
          exercises.map((exercise, index) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              lang={lang}
              index={index}
              onOpen={openExercise}
            />
          ))
        )}
      </div>
      {easterEgg ? null : (
        <div className="load-sentinel" ref={sentinelRef}>
          <div className={`load-spinner${loading && hasMore ? " visible" : ""}`} />
        </div>
      )}
    </div>
  );
}
