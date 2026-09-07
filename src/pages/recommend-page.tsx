import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";

import { getLabels, getRecommendedExercises } from "@/api/exercises";
import { useAuth } from "@/context/auth-context";
import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { canAccessRecommendPlan } from "@/lib/capabilities";
import { assetUrl } from "@/lib/assets";
import { exerciseName, valueLabel } from "@/lib/labels";
import type { Exercise, ExerciseLabels } from "@/types/exercise";

type Recommended = Exercise & { sets: number; reps: string; rest: number };

export function RecommendPage() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const { openExercise } = useCatalog();
  const [labels, setLabels] = useState<ExerciseLabels>({ category: [], equipment: [], target: [] });
  const [zone, setZone] = useState("");
  const [equipment, setEquipment] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [results, setResults] = useState<Recommended[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void getLabels()
      .then(setLabels)
      .catch(() => undefined);
  }, []);

  if (!canAccessRecommendPlan(user)) {
    return <Navigate to="/" replace />;
  }

  function toggleEquip(value: string) {
    setEquipment((prev) => {
      if (prev.includes(value)) return prev.filter((item) => item !== value);
      if (prev.length >= 2) return prev;
      return [...prev, value];
    });
  }

  async function submit() {
    if (!zone || !equipment.length) return;
    setBusy(true);
    setError("");
    try {
      const data = await getRecommendedExercises({
        zone,
        equipment: equipment.join(","),
        locale: lang,
      });
      setNote(data.note);
      setResults(data.exercises ?? []);
      setOpen(false);
    } catch {
      setError(t("recommendFail"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="recommend-view">
      {!results.length ? (
        <div className="recommend-panel">
          <h1 className="recommend-title">{t("recommendPlan")}</h1>
          <p className="recommend-lead">{t("recommendPlanLead")}</p>
          <button type="button" className="recommend-cta" onClick={() => setOpen(true)}>
            {t("recommendGetPlan")}
          </button>
        </div>
      ) : null}

      {open || !results.length ? (
        <form
          className="recommend-composer"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label>
            <span>{t("recommendZone")}</span>
            <select value={zone} onChange={(event) => setZone(event.target.value)}>
              <option value="">{t("recommendZonePlaceholder")}</option>
              {labels.category.map((item) => (
                <option key={item} value={item}>
                  {valueLabel(item, lang)}
                </option>
              ))}
            </select>
          </label>
          <div>
            <span>{t("recommendEquipment")}</span>
            <p>{t("recommendEquipmentHint")}</p>
            <div className="recommend-equip-list">
              {labels.equipment.map((item) => (
                <button
                  key={item}
                  type="button"
                  className={`recommend-equip-chip${equipment.includes(item) ? " is-active" : ""}`}
                  onClick={() => toggleEquip(item)}
                >
                  {valueLabel(item, lang)}
                </button>
              ))}
            </div>
          </div>
          {error ? <p className="student-plan-save-error">{error}</p> : null}
          <button
            type="submit"
            className="recommend-submit"
            disabled={busy || !zone || !equipment.length}
          >
            {busy ? t("recommendGenerating") : t("recommendSubmit")}
          </button>
        </form>
      ) : null}

      {results.length ? (
        <>
          <div className="recommend-grid">
            {results.map((exercise) => (
              <article
                key={exercise.id}
                className="recommend-card training-card"
                onClick={() => openExercise(exercise.id)}
              >
                <img
                  src={assetUrl(exercise.image || exercise.gif_url)}
                  alt={exerciseName(exercise, lang)}
                />
                <h3>{exerciseName(exercise, lang)}</h3>
                <p>
                  {exercise.sets} × {exercise.reps} · {exercise.rest}s
                </p>
              </article>
            ))}
          </div>
          {note ? (
            <aside className="recommend-note">
              <h2>{t("recommendNoteTitle")}</h2>
              <p>{note}</p>
            </aside>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
