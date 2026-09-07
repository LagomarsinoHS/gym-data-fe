import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate } from "react-router-dom";

import { getLabels, getRecommendedExercises } from "@/api/exercises";
import { useAuth } from "@/context/auth-context";
import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { assetUrl } from "@/lib/assets";
import { canAccessRecommendPlan } from "@/lib/capabilities";
import { exerciseName, valueLabel } from "@/lib/labels";
import type { Exercise, ExerciseLabels } from "@/types/exercise";

const EQUIP_MAX = 2;

type Recommended = Exercise & { sets: number; reps: string; rest: number; role?: string };

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
  const [streamedNote, setStreamedNote] = useState("");
  const [results, setResults] = useState<Recommended[]>([]);
  const [open, setOpen] = useState(false);
  const zoneRef = useRef<HTMLSelectElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void getLabels()
      .then(setLabels)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!open || busy) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      closeComposer();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  useEffect(() => {
    const text = note.trim();
    if (!text) {
      setStreamedNote("");
      return;
    }
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStreamedNote(text);
      return;
    }
    const words = text.match(/\S+\s*/g) ?? [text];
    const chunks: string[] = [];
    for (let i = 0; i < words.length; i += 2) {
      chunks.push(words.slice(i, i + 2).join(""));
    }
    let index = 0;
    let acc = "";
    setStreamedNote("");
    const tick = () => {
      if (index >= chunks.length) return;
      acc += chunks[index];
      index += 1;
      setStreamedNote(acc);
      noteRef.current && (noteRef.current.scrollTop = noteRef.current.scrollHeight);
      timer = window.setTimeout(tick, 90);
    };
    let timer = window.setTimeout(tick, 90);
    return () => window.clearTimeout(timer);
  }, [note]);

  const zones = useMemo(() => sortedLabels(labels.category, lang), [labels.category, lang]);
  const equipOptions = useMemo(
    () => sortedLabels(labels.equipment, lang),
    [labels.equipment, lang],
  );

  if (!canAccessRecommendPlan(user)) {
    return <Navigate to="/" replace />;
  }

  function openComposer() {
    if (busy) return;
    setEquipment([]);
    setError("");
    setOpen(true);
    requestAnimationFrame(() => {
      zoneRef.current?.focus();
      zoneRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  }

  function closeComposer() {
    if (busy) return;
    setOpen(false);
    setError("");
  }

  function toggleEquip(value: string) {
    setEquipment((prev) => {
      if (prev.includes(value)) {
        setError("");
        return prev.filter((item) => item !== value);
      }
      if (prev.length >= EQUIP_MAX) {
        setError(t("recommendEquipmentMax"));
        return prev;
      }
      setError("");
      return [...prev, value];
    });
  }

  async function submit() {
    if (!zone || !equipment.length || busy) return;
    setBusy(true);
    setError("");
    try {
      const data = await getRecommendedExercises({
        zone,
        equipment: equipment.join(","),
        locale: lang,
      });
      setNote(data.note ?? "");
      setResults(data.exercises ?? []);
      setOpen(false);
      setError("");
    } catch {
      setError(t("recommendFail"));
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = Boolean(zone) && equipment.length >= 1 && equipment.length <= EQUIP_MAX && !busy;

  return (
    <div id="recommend-view" className="recommend-view">
      <div className="recommend-panel" id="recommend-empty">
        <h2 className="recommend-title">{t("recommendPlan")}</h2>
        <p className="recommend-lead">{t("recommendPlanLead")}</p>
        <button
          type="button"
          className="recommend-cta"
          aria-expanded={open}
          aria-controls="recommend-composer"
          disabled={busy}
          onClick={() => {
            if (open) closeComposer();
            else openComposer();
          }}
        >
          <span>{t("recommendGetPlan")}</span>
        </button>
        <div
          className={`recommend-composer${open ? " is-open" : ""}`}
          id="recommend-composer"
          aria-hidden={!open}
          {...(open ? {} : { inert: true })}
        >
          <div className="recommend-composer-inner">
            <form
              className={`recommend-form${busy ? " is-loading" : ""}`}
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <label className="recommend-field">
                <span className="recommend-label">{t("recommendZone")}</span>
                <select
                  ref={zoneRef}
                  name="zone"
                  required
                  disabled={busy}
                  value={zone}
                  onChange={(event) => setZone(event.target.value)}
                >
                  <option value="">{t("recommendZonePlaceholder")}</option>
                  {zones.map((item) => (
                    <option key={item} value={item}>
                      {valueLabel(item, lang)}
                    </option>
                  ))}
                </select>
              </label>
              <div className="recommend-field">
                <span className="recommend-label">{t("recommendEquipment")}</span>
                <p className="recommend-hint">{t("recommendEquipmentHint")}</p>
                <div
                  className="recommend-equip-chips"
                  role="group"
                  aria-label={t("recommendEquipment")}
                >
                  {equipOptions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`recommend-equip-chip${equipment.includes(item) ? " is-active" : ""}`}
                      aria-pressed={equipment.includes(item)}
                      disabled={busy}
                      onClick={() => toggleEquip(item)}
                    >
                      {valueLabel(item, lang)}
                    </button>
                  ))}
                </div>
              </div>
              <p className={`recommend-status${error ? " is-error" : ""}`} hidden={!error}>
                {error}
              </p>
              <button
                type="submit"
                className={`recommend-submit${busy ? " is-loading" : ""}`}
                disabled={!canSubmit}
              >
                <span className="recommend-submit-spinner load-spinner" aria-hidden="true" />
                <span className="recommend-submit-label">
                  {busy ? t("recommendGenerating") : t("recommendSubmit")}
                </span>
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="recommend-results" id="recommend-results" hidden={!results.length}>
        <div className="recommend-toolbar">
          <h2 className="recommend-toolbar-title">{t("recommendPlan")}</h2>
        </div>
        <section className="recommend-note" hidden={!note}>
          <label className="recommend-note-label" htmlFor="recommend-note-body">
            {t("recommendNoteTitle")}
          </label>
          <textarea
            id="recommend-note-body"
            ref={noteRef}
            className="recommend-note-body"
            readOnly
            rows={5}
            aria-live="polite"
            value={streamedNote}
          />
        </section>
        <div className="recommend-grid" id="recommend-grid">
          {results.map((exercise) => (
            <RecommendCard
              key={exercise.id}
              exercise={exercise}
              onOpen={() => openExercise(exercise.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function RecommendCard({
  exercise,
  onOpen,
}: {
  exercise: Recommended;
  onOpen: () => void;
}) {
  const { t, lang } = useI18n();
  const name = exerciseName(exercise, lang);
  const thumb = assetUrl(exercise.image);
  const gif = assetUrl(exercise.gif_url);
  const [gifReady, setGifReady] = useState(false);
  const [mediaReady, setMediaReady] = useState(!thumb);
  const role = exercise.role ? valueLabel(exercise.role, lang) : "";
  const lines = [
    exercise.sets != null ? { ico: "🏋️", text: `${exercise.sets} ${t("prescriptionSets")}` } : null,
    exercise.reps ? { ico: "🔁", text: `${exercise.reps} ${t("prescriptionReps")}` } : null,
    exercise.rest != null ? { ico: "⏱️", text: `${exercise.rest}s` } : null,
  ].filter((row): row is { ico: string; text: string } => Boolean(row));

  return (
    <article
      className="training-card recommend-card"
      data-id={exercise.id}
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
          {exercise.category ? (
            <span className="tag tag-cat">{valueLabel(exercise.category, lang)}</span>
          ) : null}
          {exercise.equipment ? (
            <span className="tag tag-equip">{valueLabel(exercise.equipment, lang)}</span>
          ) : null}
        </div>
        {role ? <p className="recommend-card-role">{role}</p> : null}
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
          ) : null}
        </div>
      </div>
    </article>
  );
}

function sortedLabels(values: string[], lang: "es" | "en") {
  return [...new Set(values)].sort((a, b) =>
    valueLabel(a, lang).localeCompare(valueLabel(b, lang), undefined, { sensitivity: "base" }),
  );
}
