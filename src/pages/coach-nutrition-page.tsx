import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { listNutritionPlans } from "@/api/nutrition-plans";
import { getAthleteNutrition } from "@/api/users";
import { AthletePicker } from "@/components/coach/athlete-picker";
import { CoachNutritionPlans } from "@/components/nutrition/coach-nutrition-plans";
import {
  CoachNutritionProfile,
  highlightActivity,
  highlightFasted,
  highlightTime,
} from "@/components/nutrition/coach-nutrition-profile";
import { useI18n } from "@/context/i18n-context";
import { ageFromBirthDate, goalLabelKey, sexLabelKey } from "@/lib/coach-athletes";
import { personName } from "@/lib/user-display";
import type { AthleteNutrition, NutritionPlan } from "@/types/nutrition";
import type { CoachAthlete } from "@/types/user";

export function CoachNutritionPage() {
  const { t, lang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();
  const [athlete, setAthlete] = useState<CoachAthlete | null>(() => {
    const fromState = (location.state as { athlete?: CoachAthlete } | null)?.athlete;
    return fromState ?? null;
  });
  const [profile, setProfile] = useState<AthleteNutrition | null>(null);
  const [draft, setDraft] = useState<AthleteNutrition | null>(null);
  const [plans, setPlans] = useState<NutritionPlan[]>([]);
  const [mode, setMode] = useState<"profile" | "plan">("profile");
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [plansError, setPlansError] = useState(false);

  function loadProfile(athleteId: string) {
    setProfileLoading(true);
    setProfileError(false);
    return getAthleteNutrition(athleteId)
      .then((next) => {
        setProfile(next);
        setDraft(next);
      })
      .catch(() => setProfileError(true))
      .finally(() => setProfileLoading(false));
  }

  function loadPlans(athleteId: string) {
    setPlansLoading(true);
    setPlansError(false);
    return listNutritionPlans({ athleteId })
      .then((next) => setPlans(next.data ?? []))
      .catch(() => setPlansError(true))
      .finally(() => setPlansLoading(false));
  }

  useEffect(() => {
    if (!athlete) {
      setProfile(null);
      setDraft(null);
      setPlans([]);
      setMode("profile");
      setProfileError(false);
      setPlansError(false);
      return;
    }
    let cancelled = false;
    setProfile(null);
    setDraft(null);
    setPlans([]);
    setProfileLoading(true);
    setPlansLoading(true);
    setProfileError(false);
    setPlansError(false);
    void getAthleteNutrition(athlete.id)
      .then((nextProfile) => {
        if (cancelled) return;
        setProfile(nextProfile);
        setDraft(nextProfile);
      })
      .catch(() => {
        if (!cancelled) setProfileError(true);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });
    void listNutritionPlans({ athleteId: athlete.id })
      .then((nextPlans) => {
        if (!cancelled) setPlans(nextPlans.data ?? []);
      })
      .catch(() => {
        if (!cancelled) setPlansError(true);
      })
      .finally(() => {
        if (!cancelled) setPlansLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [athlete?.id]);

  const goalKey = athlete ? goalLabelKey(athlete.goal) : null;
  const sexKey = athlete ? sexLabelKey(athlete.profile.sex) : null;
  const age = athlete ? ageFromBirthDate(athlete.profile.birthDate) : null;
  const metaParts = athlete
    ? [
        age != null ? t("nutritionAgeYears", { n: age }) : "",
        athlete.currentWeightKg != null ? `${athlete.currentWeightKg} kg` : "",
        athlete.profile.heightCm != null ? `${Math.round(athlete.profile.heightCm)} cm` : "",
      ].filter(Boolean)
    : [];

  return (
    <div id="nutrition-view" className="nutrition-view">
      <div className="nutrition">
        <header className="nutrition-header" id="nutrition-header" hidden={Boolean(athlete)}>
          <h2 className="nutrition-title">{t("navNutrition")}</h2>
          <p className="nutrition-lead">{t("nutritionLead")}</p>
        </header>

        <AthletePicker
          active={!athlete}
          onSelect={(row) => {
            setAthlete(row);
            setMode("profile");
          }}
          onInvite={() => navigate("/alumnos")}
        />

        <div id="nutrition-workspace" className="nutrition-workspace" hidden={!athlete}>
          {athlete ? (
            <>
              <div className="nutrition-workspace-context">
                <div className="nutrition-workspace-top">
                  <button
                    type="button"
                    className="session-editor-back"
                    onClick={() => setAthlete(null)}
                  >
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
                    <span>{t("nutritionBack")}</span>
                  </button>
                  <nav className="nutrition-mode-toggle" role="tablist" aria-label={t("nutritionModeList")}>
                    <button
                      type="button"
                      className={`nutrition-mode-tab${mode === "profile" ? " is-active" : ""}`}
                      role="tab"
                      aria-selected={mode === "profile"}
                      onClick={() => setMode("profile")}
                    >
                      <span>{t("nutritionModeProfile")}</span>
                    </button>
                    <button
                      type="button"
                      className={`nutrition-mode-tab${mode === "plan" ? " is-active" : ""}`}
                      role="tab"
                      aria-selected={mode === "plan"}
                      onClick={() => setMode("plan")}
                    >
                      <span>{t("nutritionModePlan")}</span>
                    </button>
                  </nav>
                </div>
                <article className="nutrition-athlete-card">
                  <div className="nutrition-athlete-identity">
                    <span className="nutrition-athlete-avatar" aria-hidden="true">
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M20 21a8 8 0 0 0-16 0" />
                        <circle cx="12" cy="8" r="4" />
                      </svg>
                    </span>
                    <div className="nutrition-athlete-copy">
                      <p className="nutrition-athlete-kicker">{t("nutritionAthleteKicker")}</p>
                      <h3 className="nutrition-athlete-name">
                        {personName(athlete.profile) || athlete.email}
                      </h3>
                      <p className="nutrition-athlete-meta">
                        {metaParts.length
                          ? metaParts.map((part, index) => (
                              <span key={part}>
                                {index ? (
                                  <span className="nutrition-athlete-meta-dot" aria-hidden="true" />
                                ) : null}
                                <strong>{part}</strong>
                              </span>
                            ))
                          : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="nutrition-athlete-aside">
                    <div className="nutrition-athlete-chip">
                      <div>
                        <strong>{goalKey ? t(goalKey) : "—"}</strong>
                        <span>{t("profileGoal")}</span>
                      </div>
                    </div>
                    <div className="nutrition-athlete-chip">
                      <div>
                        <strong>{sexKey ? t(sexKey) : "—"}</strong>
                        <span>{t("profileSex")}</span>
                      </div>
                    </div>
                  </div>
                </article>
                <div className="nutrition-highlights" hidden={mode === "plan"}>
                  <Highlight label={t("nutritionSummaryActivity")} value={highlightActivity(draft, t)} />
                  <Highlight
                    label={t("nutritionHighlightTrainingsWeek")}
                    value={draft?.trainingsPerWeek != null ? String(draft.trainingsPerWeek) : "—"}
                  />
                  <Highlight
                    label={t("nutritionProfileDuration")}
                    value={
                      draft?.avgDurationMin != null
                        ? `${draft.avgDurationMin} ${t("nutritionProfileDurationUnit")}`
                        : "—"
                    }
                  />
                  <Highlight
                    label={t("nutritionProfileSteps")}
                    value={draft?.dailySteps != null ? String(draft.dailySteps) : "—"}
                  />
                  <Highlight
                    label={t("nutritionSummaryTraining")}
                    value={highlightTime(draft?.trainingTime, lang)}
                  />
                  <Highlight
                    label={t("nutritionHighlightFasted")}
                    value={highlightFasted(draft, t)}
                    fasted={Boolean(draft?.trainFasted)}
                  />
                </div>
              </div>

              <div className="nutrition-workspace-main">
                <div className="nutrition-workspace-panels">
                  <section
                    className="nutrition-profile"
                    hidden={mode !== "profile"}
                    aria-label={t("nutritionProfileTitle")}
                  >
                    {profileLoading ? (
                      <div className="nutrition-profile-loading">
                        <div className="load-spinner visible" aria-hidden="true" />
                        <span>{t("nutritionProfileLoading")}</span>
                      </div>
                    ) : null}
                    {profileError && !profileLoading ? (
                      <div className="nutrition-profile-error">
                        <p>{t("nutritionProfileLoadFail")}</p>
                        <button
                          type="button"
                          className="recommend-again-btn"
                          onClick={() => {
                            if (!athlete) return;
                            void loadProfile(athlete.id);
                          }}
                        >
                          <span>{t("nutritionProfileRetry")}</span>
                        </button>
                      </div>
                    ) : null}
                    {profile && !profileLoading ? (
                      <CoachNutritionProfile
                        key={athlete.id}
                        athleteId={athlete.id}
                        profile={profile}
                        onDraftChange={setDraft}
                        onSaved={setProfile}
                      />
                    ) : null}
                  </section>
                  <CoachNutritionPlans
                    key={athlete.id}
                    hidden={mode !== "plan"}
                    plans={plans}
                    loading={plansLoading}
                    error={plansError}
                    onRetry={() => {
                      void loadPlans(athlete.id);
                    }}
                    onPlansChange={setPlans}
                  />
                </div>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Highlight({
  label,
  value,
  fasted = false,
}: {
  label: string;
  value: string;
  fasted?: boolean;
}) {
  return (
    <div className="nutrition-highlight">
      <span className="nutrition-highlight-label">{label}</span>
      <strong className={`nutrition-highlight-value${fasted ? " is-fasted" : ""}`}>{value}</strong>
    </div>
  );
}
