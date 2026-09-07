import { useEffect, useState } from "react";

import { setAthleteNutrition } from "@/api/users";
import { useI18n } from "@/context/i18n-context";
import type { MessageKey } from "@/i18n";
import type { AthleteNutrition } from "@/types/nutrition";

type Tab = "summary" | "activity" | "habits" | "prefs" | "restrictions";

const DEFAULT_MEAL_KEYS: MessageKey[] = [
  "nutritionProfileBreakfast",
  "nutritionProfileLunch",
  "nutritionProfileSnack",
  "nutritionProfileDinner",
];

const TABS: { id: Tab; label: MessageKey; icon: "doc" | "run" | "clock" | "heart" | "clip" }[] = [
  { id: "summary", label: "nutritionTabSummary", icon: "doc" },
  { id: "activity", label: "nutritionTabActivity", icon: "run" },
  { id: "habits", label: "nutritionTabHabits", icon: "clock" },
  { id: "prefs", label: "nutritionTabPrefs", icon: "heart" },
  { id: "restrictions", label: "nutritionTabRestrictions", icon: "clip" },
];

export function CoachNutritionProfile({
  athleteId,
  profile,
  onDraftChange,
  onSaved,
}: {
  athleteId: string;
  profile: AthleteNutrition;
  onDraftChange: (draft: AthleteNutrition) => void;
  onSaved: (next: AthleteNutrition) => void;
}) {
  const { t, lang } = useI18n();
  const [tab, setTab] = useState<Tab>("summary");
  const [draft, setDraft] = useState(() => normalizeDraft(profile, t));
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const next = normalizeDraft(profile, t);
    setDraft(next);
    setTab("summary");
    setError("");
    onDraftChange(next);
  }, [athleteId, profile, t]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && tab !== "summary") {
        event.preventDefault();
        setTab("summary");
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tab]);

  function patch(next: Partial<AthleteNutrition>) {
    setDraft((prev) => {
      const merged = { ...prev, ...next };
      onDraftChange(merged);
      return merged;
    });
    setError("");
    setSaved(false);
  }

  async function onSave() {
    if (saving) return;
    setSaving(true);
    setError("");
    try {
      const next = await setAthleteNutrition(athleteId, toPayload(draft));
      const normalized = normalizeDraft(next, t);
      setDraft(normalized);
      onDraftChange(normalized);
      onSaved(next);
      setTab("summary");
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1500);
    } catch {
      setError(t("nutritionProfileSaveFail"));
    } finally {
      setSaving(false);
    }
  }

  const meals = draft.meals.length ? draft.meals : defaultMeals(t);
  const likes = draft.likes ?? [];
  const avoids = draft.avoids ?? [];
  const restrictions = draft.restrictions ?? [];
  const hasPrefs = likes.length > 0 || avoids.length > 0;

  return (
    <form
      id="nutrition-profile-form"
      className="nutrition-profile-form"
      onSubmit={(event) => {
        event.preventDefault();
        void onSave();
      }}
    >
      <nav className="nutrition-profile-tabs" role="tablist" aria-label={t("nutritionTabList")}>
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            className="nutrition-profile-tab"
            role="tab"
            aria-selected={tab === item.id}
            onClick={() => setTab(item.id)}
          >
            <TabIcon name={item.icon} />
            <span>{t(item.label)}</span>
          </button>
        ))}
      </nav>

      <div className="nutrition-profile-body">
        <div id="nutrition-summary" className="nutrition-summary" hidden={tab !== "summary"}>
          <button type="button" className="nutrition-summary-card" onClick={() => setTab("activity")}>
            <h4 className="nutrition-summary-title">
              <TabIcon name="pulse" className="nutrition-summary-ico" />
              <span>{t("nutritionProfileActivity")}</span>
            </h4>
            <dl className="nutrition-summary-facts">
              <Fact label={t("nutritionSummaryActivity")} value={activityLabel(draft, t)} />
              <Fact label={t("nutritionProfileTrainingsWeek")} value={num(draft.trainingsPerWeek)} />
              <Fact
                label={t("nutritionProfileDuration")}
                value={num(draft.avgDurationMin, t("nutritionProfileDurationUnit"))}
              />
              <Fact label={t("nutritionProfileSteps")} value={num(draft.dailySteps)} />
              <Fact
                label={t("nutritionProfileCardio")}
                value={num(draft.weeklyCardioMin, t("nutritionProfileCardioUnit"))}
              />
              <Fact label={t("nutritionProfileExtraActivity")} value={draft.extraActivity?.trim() || "—"} />
            </dl>
          </button>
          <button
            type="button"
            className="nutrition-summary-card nutrition-summary-card--capped"
            onClick={() => setTab("habits")}
          >
            <h4 className="nutrition-summary-title">
              <TabIcon name="clock" className="nutrition-summary-ico" />
              <span>{t("nutritionProfileHabits")}</span>
              {draft.trainFasted ? (
                <span
                  className={`nutrition-summary-pill${draft.trainFasted === "fasted" ? " is-fasted" : " is-after-meal"}`}
                >
                  {draft.trainFasted === "fasted"
                    ? t("nutritionSummaryTrainsFasted")
                    : t("nutritionSummaryTrainsAfterMeal")}
                </span>
              ) : null}
            </h4>
            <div className="nutrition-summary-scroll">
              <dl className="nutrition-summary-facts">
                {meals.map((meal, index) => (
                  <Fact
                    key={`${meal.name}-${index}`}
                    label={mealName(meal, index, t)}
                    value={formatTime(meal.time, lang)}
                  />
                ))}
              </dl>
            </div>
          </button>
          <button
            type="button"
            className="nutrition-summary-card nutrition-summary-card--fill"
            onClick={() => setTab("prefs")}
          >
            <h4 className="nutrition-summary-title">
              <TabIcon name="heart" className="nutrition-summary-ico" />
              <span>{t("nutritionTabPrefs")}</span>
            </h4>
            <div className="nutrition-summary-scroll">
              <p className="nutrition-summary-empty-lead" hidden={hasPrefs}>
                {t("nutritionPrefsSummaryEmpty")}
              </p>
              <div className="nutrition-summary-prefs-cols" hidden={!hasPrefs}>
                <div className="nutrition-summary-sub">
                  <p className="nutrition-summary-sub-label">{t("nutritionProfileLikes")}</p>
                  <TagPills tags={likes} />
                </div>
                <div className="nutrition-summary-sub">
                  <p className="nutrition-summary-sub-label">{t("nutritionSummaryAvoids")}</p>
                  <TagPills tags={avoids} />
                </div>
              </div>
            </div>
          </button>
          <button
            type="button"
            className="nutrition-summary-card nutrition-summary-card--fill"
            onClick={() => setTab("restrictions")}
          >
            <h4 className="nutrition-summary-title">
              <TabIcon name="clip" className="nutrition-summary-ico" />
              <span>{t("nutritionTabRestrictions")}</span>
              {dietLabel(draft, t) ? (
                <span className="nutrition-summary-pill">{dietLabel(draft, t)}</span>
              ) : null}
            </h4>
            <div className="nutrition-summary-restrictions">
              <div className="nutrition-summary-scroll">
                <TagPills tags={restrictions} />
              </div>
              {draft.notes?.trim() ? (
                <p className="nutrition-summary-notes">{draft.notes.trim()}</p>
              ) : null}
            </div>
          </button>
        </div>

        <fieldset className="nutrition-profile-block" hidden={tab !== "activity"}>
          <legend>{t("nutritionProfileActivity")}</legend>
          <div className="nutrition-profile-grid">
            <label className="nutrition-profile-field">
              <span className="nutrition-profile-label">{t("nutritionProfileDailyActivity")}</span>
              <select
                value={draft.dailyActivity ?? ""}
                onChange={(event) =>
                  patch({ dailyActivity: (event.target.value || null) as AthleteNutrition["dailyActivity"] })
                }
              >
                <option value="">{t("nutritionProfileUnspecified")}</option>
                <option value="sedentary">{t("nutritionActivitySedentary")}</option>
                <option value="standing">{t("nutritionActivityStanding")}</option>
                <option value="active">{t("nutritionActivityActive")}</option>
                <option value="demanding">{t("nutritionActivityDemanding")}</option>
              </select>
            </label>
            <NumberField
              label={t("nutritionProfileTrainingsWeek")}
              value={draft.trainingsPerWeek}
              min={0}
              max={14}
              onChange={(value) => patch({ trainingsPerWeek: value })}
            />
            <label className="nutrition-profile-field">
              <span className="nutrition-profile-label">{t("nutritionProfileDuration")}</span>
              <span className="nutrition-profile-input-unit">
                <input
                  type="number"
                  min={0}
                  max={300}
                  value={draft.avgDurationMin ?? ""}
                  onChange={(event) => patch({ avgDurationMin: toNumber(event.target.value) })}
                />
                <span>{t("nutritionProfileDurationUnit")}</span>
              </span>
            </label>
            <NumberField
              label={t("nutritionProfileSteps")}
              value={draft.dailySteps}
              min={0}
              step={100}
              onChange={(value) => patch({ dailySteps: value })}
            />
            <label className="nutrition-profile-field">
              <span className="nutrition-profile-label">{t("nutritionProfileCardio")}</span>
              <span className="nutrition-profile-input-unit">
                <input
                  type="number"
                  min={0}
                  value={draft.weeklyCardioMin ?? ""}
                  onChange={(event) => patch({ weeklyCardioMin: toNumber(event.target.value) })}
                />
                <span>{t("nutritionProfileCardioUnit")}</span>
              </span>
            </label>
            <label className="nutrition-profile-field nutrition-profile-field--wide">
              <span className="nutrition-profile-label">{t("nutritionProfileExtraActivity")}</span>
              <input
                value={draft.extraActivity ?? ""}
                placeholder={t("nutritionProfileExtraActivityPh")}
                onChange={(event) => patch({ extraActivity: event.target.value })}
              />
            </label>
          </div>
        </fieldset>

        <fieldset className="nutrition-profile-block" hidden={tab !== "habits"}>
          <legend>{t("nutritionProfileHabits")}</legend>
          <div className="nutrition-profile-grid">
            <div className="nutrition-meals-list">
              {meals.map((meal, index) => (
                <div key={index} className="nutrition-profile-field nutrition-meal-card">
                  {meals.length > 1 ? (
                    <button
                      type="button"
                      className="nutrition-meal-remove"
                      aria-label={t("nutritionProfileRemoveMeal")}
                      onClick={() =>
                        patch({ meals: meals.filter((_, mealIndex) => mealIndex !== index) })
                      }
                    >
                      ×
                    </button>
                  ) : null}
                  <input
                    type="text"
                    className="nutrition-meal-name"
                    value={mealName(meal, index, t)}
                    placeholder={t("nutritionProfileMealNamePh")}
                    autoComplete="off"
                    onChange={(event) => {
                      const next = meals.map((row, mealIndex) =>
                        mealIndex === index ? { ...row, name: event.target.value } : row,
                      );
                      patch({ meals: next });
                    }}
                  />
                  <span className="nutrition-profile-label">{t("nutritionProfileMealTime")}</span>
                  <input
                    type="time"
                    className="nutrition-meal-time"
                    value={meal.time ?? ""}
                    onChange={(event) => {
                      const next = meals.map((row, mealIndex) =>
                        mealIndex === index ? { ...row, time: event.target.value || null } : row,
                      );
                      patch({ meals: next });
                    }}
                  />
                </div>
              ))}
              {meals.length < 8 ? (
                <button
                  type="button"
                  className="nutrition-meal-add"
                  aria-label={t("nutritionProfileAddMeal")}
                  onClick={() =>
                    patch({
                      meals: [...meals, { name: t("nutritionProfileMealN", { n: meals.length + 1 }), time: null }],
                    })
                  }
                >
                  +
                </button>
              ) : null}
            </div>
            <label className="nutrition-profile-field">
              <span className="nutrition-profile-label">{t("nutritionProfileTrainingTime")}</span>
              <input
                type="time"
                value={draft.trainingTime ?? ""}
                onChange={(event) => patch({ trainingTime: event.target.value || null })}
              />
            </label>
            <label className="nutrition-profile-field">
              <span className="nutrition-profile-label">{t("nutritionProfileTrainFasted")}</span>
              <select
                value={draft.trainFasted ?? ""}
                onChange={(event) =>
                  patch({ trainFasted: (event.target.value || null) as AthleteNutrition["trainFasted"] })
                }
              >
                <option value="">{t("nutritionProfileUnspecified")}</option>
                <option value="after_meal">{t("nutritionProfileTrainAfterMeal")}</option>
                <option value="fasted">{t("nutritionProfileTrainFastedYes")}</option>
              </select>
            </label>
          </div>
        </fieldset>

        <fieldset className="nutrition-profile-block" hidden={tab !== "prefs"}>
          <legend>{t("nutritionProfilePrefs")}</legend>
          <div className="nutrition-prefs-grid">
            <TagEditor
              title={t("nutritionProfileLikes")}
              placeholder={t("nutritionProfileLikesPh")}
              tags={likes}
              onChange={(next) => patch({ likes: next })}
            />
            <TagEditor
              title={t("nutritionSummaryAvoids")}
              placeholder={t("nutritionProfileAvoidsPh")}
              tags={avoids}
              onChange={(next) => patch({ avoids: next })}
            />
          </div>
        </fieldset>

        <fieldset className="nutrition-profile-block" hidden={tab !== "restrictions"}>
          <legend>{t("nutritionProfileRestrictions")}</legend>
          <div className="nutrition-restrictions-split">
            <div className="nutrition-restrictions-left">
              <label className="nutrition-profile-field">
                <span className="nutrition-profile-label">{t("nutritionProfileDietType")}</span>
                <select
                  value={draft.dietType ?? ""}
                  onChange={(event) =>
                    patch({ dietType: (event.target.value || null) as AthleteNutrition["dietType"] })
                  }
                >
                  <option value="">{t("nutritionProfileUnspecified")}</option>
                  <option value="none">{t("nutritionDietNone")}</option>
                  <option value="vegetarian">{t("nutritionDietVegetarian")}</option>
                  <option value="vegan">{t("nutritionDietVegan")}</option>
                  <option value="other">{t("nutritionDietOther")}</option>
                </select>
              </label>
              <TagEditor
                title={t("nutritionProfileRestrictionTags")}
                placeholder={t("nutritionProfileAddTagPh")}
                tags={restrictions}
                onChange={(next) => patch({ restrictions: next })}
              />
            </div>
            <div className="nutrition-pref-card nutrition-notes-card">
              <h4 className="nutrition-pref-title">{t("nutritionProfileNotes")}</h4>
              <textarea
                className="nutrition-notes-input"
                value={draft.notes ?? ""}
                placeholder={t("nutritionProfileNotesPh")}
                onChange={(event) => patch({ notes: event.target.value })}
              />
            </div>
          </div>
        </fieldset>
      </div>

      <div className="nutrition-profile-footer">
        <p className={`nutrition-profile-status${error ? " is-error" : ""}`} hidden={!error}>
          {error}
        </p>
        <button type="submit" className={`recommend-cta${saved ? " is-saved" : ""}`} disabled={saving}>
          <svg
            className="nutrition-profile-save-ico"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          <span>
            {saved ? t("nutritionProfileSaved") : saving ? t("nutritionProfileSaving") : t("nutritionProfileSave")}
          </span>
        </button>
      </div>
    </form>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number | null;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number | null) => void;
}) {
  return (
    <label className="nutrition-profile-field">
      <span className="nutrition-profile-label">{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value ?? ""}
        onChange={(event) => onChange(toNumber(event.target.value))}
      />
    </label>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function TagPills({ tags }: { tags: string[] }) {
  return (
    <div className="nutrition-summary-tags">
      {tags.length ? (
        tags.map((tag) => (
          <span key={tag} className="nutrition-summary-tag">
            {tag}
          </span>
        ))
      ) : (
        <span className="nutrition-summary-empty">—</span>
      )}
    </div>
  );
}

function TagEditor({
  title,
  placeholder,
  tags,
  onChange,
}: {
  title: string;
  placeholder: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const { t } = useI18n();
  const [value, setValue] = useState("");

  function add() {
    const next = value.trim();
    if (!next) return;
    onChange([...tags, next]);
    setValue("");
  }

  return (
    <div className="nutrition-pref-card">
      <h4 className="nutrition-pref-title">{title}</h4>
      <div className="nutrition-pref-body">
        <div
          className="nutrition-tag-list"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest(".nutrition-tag-remove")) return;
            event.currentTarget.querySelector("input")?.focus();
          }}
        >
          {tags.map((tag, index) => (
            <span key={`${tag}-${index}`} className="nutrition-pref-tag">
              {tag}
              <button
                type="button"
                className="nutrition-tag-remove"
                aria-label={`${t("nutritionProfileRemoveTag")} ${tag}`}
                onClick={() => onChange(tags.filter((_, tagIndex) => tagIndex !== index))}
              >
                ×
              </button>
            </span>
          ))}
          <input
            type="text"
            className="nutrition-tag-inline"
            value={value}
            placeholder={tags.length ? "" : placeholder}
            autoComplete="off"
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                add();
                return;
              }
              if (event.key === "Backspace" && !value && tags.length) {
                event.preventDefault();
                onChange(tags.slice(0, -1));
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function TabIcon({
  name,
  className,
}: {
  name: "doc" | "run" | "clock" | "heart" | "clip" | "pulse";
  className?: string;
}) {
  const props = {
    className,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "doc") {
    return (
      <svg {...props}>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
      </svg>
    );
  }
  if (name === "run") {
    return (
      <svg {...props}>
        <circle cx="13" cy="4" r="2.1" />
        <path d="m9 21 3-6 2 2 3-6" />
        <path d="M6 12l4 2 1-3" />
        <path d="m5 20 3-1" />
      </svg>
    );
  }
  if (name === "clock") {
    return (
      <svg {...props}>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </svg>
    );
  }
  if (name === "heart") {
    return (
      <svg {...props}>
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    );
  }
  if (name === "pulse") {
    return (
      <svg {...props}>
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    );
  }
  return (
    <svg {...props}>
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="M9 12h6M9 16h6" />
    </svg>
  );
}

function normalizeDraft(
  profile: AthleteNutrition,
  t: (key: MessageKey) => string,
): AthleteNutrition {
  return {
    ...profile,
    meals: profile.meals?.length
      ? profile.meals.map((meal) => ({ ...meal }))
      : defaultMeals(t),
    likes: [...(profile.likes ?? [])],
    avoids: [...(profile.avoids ?? [])],
    restrictions: [...(profile.restrictions ?? [])],
  };
}

function defaultMeals(t: (key: MessageKey) => string) {
  return DEFAULT_MEAL_KEYS.map((key) => ({ name: t(key), time: null }));
}

function toPayload(draft: AthleteNutrition): Partial<AthleteNutrition> {
  return {
    dailyActivity: draft.dailyActivity,
    trainingsPerWeek: draft.trainingsPerWeek,
    avgDurationMin: draft.avgDurationMin,
    dailySteps: draft.dailySteps,
    weeklyCardioMin: draft.weeklyCardioMin,
    extraActivity: draft.extraActivity?.trim() || null,
    trainingTime: draft.trainingTime || null,
    trainFasted: draft.trainFasted,
    meals: (draft.meals ?? [])
      .map((meal) => ({ name: meal.name.trim(), time: meal.time || null }))
      .filter((meal) => meal.name),
    likes: draft.likes ?? [],
    avoids: draft.avoids ?? [],
    dietType: draft.dietType,
    restrictions: draft.restrictions ?? [],
    notes: draft.notes?.trim() || null,
  };
}

function toNumber(value: string) {
  if (!value) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function num(value: number | null | undefined, unit?: string) {
  if (value == null) return "—";
  return unit ? `${value} ${unit}` : String(value);
}

function mealName(
  meal: { name: string },
  index: number,
  t: (key: MessageKey, vars?: Record<string, string | number>) => string,
) {
  return meal.name.trim() || t("nutritionProfileMealN", { n: index + 1 });
}

function formatTime(value: string | null | undefined, lang: "es" | "en") {
  const raw = String(value || "").trim();
  if (!raw) return "—";
  const match = raw.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return raw;
  const date = new Date(1970, 0, 1, Number(match[1]), Number(match[2]));
  return date.toLocaleTimeString(lang === "es" ? "es-CL" : "en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function activityLabel(profile: AthleteNutrition, t: (key: MessageKey) => string) {
  if (profile.dailyActivity === "sedentary") return t("nutritionActivitySedentary");
  if (profile.dailyActivity === "standing") return t("nutritionActivityStanding");
  if (profile.dailyActivity === "active") return t("nutritionActivityActive");
  if (profile.dailyActivity === "demanding") return t("nutritionActivityDemanding");
  return "—";
}

function dietLabel(profile: AthleteNutrition, t: (key: MessageKey) => string) {
  if (profile.dietType === "none") return t("nutritionDietNone");
  if (profile.dietType === "vegetarian") return t("nutritionDietVegetarian");
  if (profile.dietType === "vegan") return t("nutritionDietVegan");
  if (profile.dietType === "other") return t("nutritionDietOther");
  return "";
}

export function highlightActivity(profile: AthleteNutrition | null, t: (key: MessageKey) => string) {
  return profile ? activityLabel(profile, t) : "—";
}

export function highlightFasted(profile: AthleteNutrition | null, t: (key: MessageKey) => string) {
  if (profile?.trainFasted === "fasted") return t("nutritionProfileTrainFastedYes");
  if (profile?.trainFasted === "after_meal") return t("nutritionProfileTrainAfterMeal");
  return "—";
}

export function highlightTime(value: string | null | undefined, lang: "es" | "en") {
  return formatTime(value, lang);
}
