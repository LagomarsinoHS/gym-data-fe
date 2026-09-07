import { useEffect, useRef, useState, type FormEvent } from "react";

import { getProgressPhotos, uploadProgressPhotos } from "@/api/users";
import { ProgressHistory } from "@/components/progress/progress-history";
import { useAuth } from "@/context/auth-context";
import { useI18n } from "@/context/i18n-context";
import {
  currentYearMonthUtc,
  formatMonthLabel,
  isValidYearMonth,
  monthShortLabels,
  normalizeYearMonth,
} from "@/lib/year-month";
import type { ProgressPhotosResponse } from "@/types/progress";

const WEIGHT_MIN = 20;
const WEIGHT_MAX = 400;

export function AvancesPage() {
  const { user, refreshUser } = useAuth();
  const { t, lang } = useI18n();
  const [data, setData] = useState<ProgressPhotosResponse | null>(null);
  const [status, setStatus] = useState("");
  const [statusError, setStatusError] = useState(false);
  const [toast, setToast] = useState<{ title: string; detail: string } | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [yearMonth, setYearMonth] = useState(currentYearMonthUtc);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerYear, setPickerYear] = useState(() => Number(currentYearMonthUtc().slice(0, 4)));
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [weight, setWeight] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const frontUrls = useRef<string | null>(null);
  const backUrls = useRef<string | null>(null);
  const toastTimer = useRef(0);

  async function load() {
    if (!user) return;
    setData(await getProgressPhotos(user.id));
  }

  useEffect(() => {
    void load().catch(() => undefined);
  }, [user?.id]);

  useEffect(() => {
    if (!pickerOpen) return;
    const onDoc = (event: MouseEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, [pickerOpen]);

  useEffect(() => {
    return () => {
      if (frontUrls.current) URL.revokeObjectURL(frontUrls.current);
      if (backUrls.current) URL.revokeObjectURL(backUrls.current);
      window.clearTimeout(toastTimer.current);
    };
  }, []);

  function showSaveToast(savedMonth: string) {
    window.clearTimeout(toastTimer.current);
    setToast({
      title: t("athleteAvancesSaveOk"),
      detail: t("athleteAvancesSaveOkDetailMonth", {
        month: formatMonthLabel(savedMonth, lang),
      }),
    });
    setToastVisible(false);
    requestAnimationFrame(() => setToastVisible(true));
    toastTimer.current = window.setTimeout(() => {
      setToastVisible(false);
      toastTimer.current = window.setTimeout(() => setToast(null), 320);
    }, 3400);
  }

  const current = currentYearMonthUtc();
  const maxYear = Number(current.slice(0, 4));
  const maxMonth = Number(current.slice(5, 7));
  const monthHint = t("athleteAvancesMonthHintFor", {
    month: formatMonthLabel(yearMonth, lang),
  });
  const currentWeight = data?.currentWeightKg ?? user?.currentWeightKg;
  const canSave =
    Number(weight) >= WEIGHT_MIN &&
    Number(weight) <= WEIGHT_MAX &&
    Boolean(frontPreview || backPreview) &&
    !busy;

  function setPreview(side: "front" | "back", file?: File) {
    const prev = side === "front" ? frontUrls : backUrls;
    if (prev.current) URL.revokeObjectURL(prev.current);
    if (!file) {
      prev.current = null;
      if (side === "front") setFrontPreview(null);
      else setBackPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    prev.current = url;
    if (side === "front") setFrontPreview(url);
    else setBackPreview(url);
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const weightKg = Number(form.get("weightKg"));
    const front = (form.get("front") as File | null) ?? undefined;
    const back = (form.get("back") as File | null) ?? undefined;
    if (!Number.isFinite(weightKg) || weightKg < WEIGHT_MIN || weightKg > WEIGHT_MAX) {
      setStatus(t("athleteAvancesNeedWeight"));
      setStatusError(true);
      return;
    }
    if (!front?.size && !back?.size) {
      setStatus(t("athleteAvancesNeedPhoto"));
      setStatusError(true);
      return;
    }
    setBusy(true);
    setStatus("");
    setStatusError(false);
    try {
      const savedMonth = normalizeYearMonth(yearMonth);
      await uploadProgressPhotos({
        weightKg,
        yearMonth: savedMonth,
        front: front?.size ? front : undefined,
        back: back?.size ? back : undefined,
      });
      formRef.current?.reset();
      setWeight("");
      setPreview("front");
      setPreview("back");
      showSaveToast(savedMonth);
      await refreshUser();
      await load();
    } catch {
      setStatus(t("athleteAvancesSaveFail"));
      setStatusError(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div id="athlete-avances-view" className="athlete-avances-view">
      <div className="athlete-avances">
        <header className="athlete-avances-header">
          <h2 className="athlete-avances-title">{t("athleteAvances")}</h2>
          <p className="athlete-avances-month-hint">{monthHint}</p>
          {currentWeight != null ? (
            <p className="athlete-avances-current-weight">
              <span>{t("progressPhotosInfoCurrentWeight")}</span>
              <strong>{currentWeight} kg</strong>
            </p>
          ) : null}
        </header>

        <div className="athlete-avances-body">
          <div className="athlete-avances-body-inner">
            <section className="athlete-avances-upload">
              <div
                className={`athlete-avances-toast${toastVisible ? " is-visible" : ""}`}
                hidden={!toast}
                role="status"
              >
                <span className="athlete-avances-toast-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.75" />
                    <path
                      d="M8 12.5l2.5 2.5L16.5 9"
                      stroke="currentColor"
                      strokeWidth="1.75"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                <div className="athlete-avances-toast-copy">
                  <p className="athlete-avances-toast-title">{toast?.title}</p>
                  <p className="athlete-avances-toast-detail">{toast?.detail}</p>
                </div>
              </div>

              <form
                ref={formRef}
                className="athlete-avances-form"
                onSubmit={(event) => void onSubmit(event)}
              >
                <div className="athlete-avances-pair">
                  <p className="athlete-avances-pair-title">{t("athleteAvancesPairTitle")}</p>
                  <div className="athlete-avances-pair-frame">
                    <PhotoSlot
                      name="front"
                      badge={t("progressPhotosFront")}
                      preview={frontPreview}
                      onFile={(file) => setPreview("front", file)}
                    />
                    <div className="athlete-avances-pair-divider" aria-hidden="true" />
                    <PhotoSlot
                      name="back"
                      badge={t("progressPhotosBackSide")}
                      preview={backPreview}
                      onFile={(file) => setPreview("back", file)}
                    />
                  </div>
                </div>

                <div className="athlete-avances-form-footer">
                  <div className="athlete-avances-weight-block">
                    <label className="athlete-avances-field athlete-avances-field-weight">
                      <span className="athlete-avances-field-label">
                        {t("athleteAvancesWeight")}
                      </span>
                      <input
                        type="number"
                        name="weightKg"
                        inputMode="decimal"
                        step="0.1"
                        min={WEIGHT_MIN}
                        max={WEIGHT_MAX}
                        required
                        value={weight}
                        onChange={(event) => setWeight(event.target.value)}
                      />
                    </label>

                    <div className="month-picker athlete-avances-month-caption" ref={pickerRef}>
                      <button
                        type="button"
                        className="athlete-avances-month-caption-btn"
                        aria-haspopup="dialog"
                        aria-expanded={pickerOpen}
                        onClick={(event) => {
                          event.stopPropagation();
                          setPickerYear(Number(yearMonth.slice(0, 4)));
                          setPickerOpen((open) => !open);
                        }}
                      >
                        <span className="athlete-avances-month-caption-value">
                          {yearMonth === current
                            ? t("athleteAvancesMonthCurrent")
                            : formatMonthLabel(yearMonth, lang)}
                        </span>
                        <span className="athlete-avances-month-caption-sep" aria-hidden="true">
                          ·
                        </span>
                        <span className="athlete-avances-month-caption-action">
                          {t("athleteAvancesChangeMonth")}
                        </span>
                      </button>
                      <div className="month-picker-panel" role="dialog" hidden={!pickerOpen}>
                        <div className="month-picker-year">
                          <button
                            type="button"
                            className="month-picker-year-btn"
                            aria-label={t("athleteAvancesPrevYear")}
                            onClick={() => setPickerYear((year) => year - 1)}
                          >
                            ‹
                          </button>
                          <span className="month-picker-year-label">{pickerYear}</span>
                          <button
                            type="button"
                            className="month-picker-year-btn"
                            aria-label={t("athleteAvancesNextYear")}
                            disabled={pickerYear >= maxYear}
                            onClick={() => setPickerYear((year) => Math.min(maxYear, year + 1))}
                          >
                            ›
                          </button>
                        </div>
                        <div className="month-picker-grid">
                          {monthShortLabels(lang).map((label, index) => {
                            const month = String(index + 1).padStart(2, "0");
                            const value = `${pickerYear}-${month}`;
                            const disabled =
                              pickerYear > maxYear ||
                              (pickerYear === maxYear && index + 1 > maxMonth);
                            return (
                              <button
                                key={value}
                                type="button"
                                className={`month-picker-month${value === yearMonth ? " is-selected" : ""}`}
                                disabled={disabled}
                                onClick={() => {
                                  if (!isValidYearMonth(value)) return;
                                  setYearMonth(value);
                                  setPickerOpen(false);
                                }}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="athlete-avances-form-actions">
                    <button type="submit" className="recommend-cta" disabled={!canSave}>
                      {busy ? t("athleteAvancesSaving") : t("athleteAvancesSave")}
                    </button>
                    {status ? (
                      <p
                        className={`athlete-avances-form-status${statusError ? " is-error" : ""}`}
                        role="status"
                      >
                        {status}
                      </p>
                    ) : null}
                  </div>
                </div>
              </form>
            </section>

            <section className="athlete-avances-history">
              <ProgressHistory
                payload={data}
                title={t("athleteAvancesHistoryTitle")}
                emptyLead={t("progressPhotosEmptyLeadAthlete")}
                heightCm={user?.profile.heightCm}
                resultsClassName="athlete-avances-results"
                person={user?.profile}
              />
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}

function PhotoSlot({
  name,
  badge,
  preview,
  onFile,
}: {
  name: string;
  badge: string;
  preview: string | null;
  onFile: (file?: File) => void;
}) {
  return (
    <label className="athlete-avances-field athlete-avances-photo-field athlete-avances-photo-field--pair">
      <span className="athlete-avances-photo-slot">
        <input
          type="file"
          name={name}
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => onFile(event.currentTarget.files?.[0])}
        />
        <span className="athlete-avances-photo-plus" aria-hidden="true">
          +
        </span>
        {preview ? <img className="athlete-avances-photo-preview" src={preview} alt="" /> : null}
        <span className="athlete-avances-photo-badge">{badge}</span>
      </span>
    </label>
  );
}
