import { useEffect, useMemo, useRef, useState } from "react";

import { ProgressPhotoLightbox } from "@/components/progress/progress-photo-lightbox";
import { useI18n } from "@/context/i18n-context";
import { progressPhotoThumbUrl } from "@/lib/cloudinary";
import type { ProgressLightboxItem } from "@/lib/progress-lightbox";
import { timelineMonthLabel } from "@/lib/year-month";
import type { AnalyzeAiState, ProgressMonth, ProgressPhotosResponse } from "@/types/progress";
import type { PersonName } from "@/types/user";

type OpenPhotoOpts = {
  url: string;
  title: string;
  side: "front" | "back";
  yearMonth?: string;
  gallery?: ProgressLightboxItem[];
};

type ViewMode = "timeline" | "pick" | "compare";

function flattenTimelineMonths(payload: ProgressPhotosResponse | null): ProgressMonth[] {
  const entries: ProgressMonth[] = [];
  for (const year of payload?.years ?? []) {
    for (const month of year.months ?? []) {
      if (!month?.yearMonth) continue;
      if (!month.front?.url && !month.back?.url && month.weightKg == null) continue;
      entries.push(month);
    }
  }
  return entries.sort((a, b) => String(b.yearMonth).localeCompare(String(a.yearMonth)));
}

export function ProgressHistory({
  payload,
  emptyLead,
  title,
  heightCm,
  resultsClassName,
  analyzeWithAi,
  onModeChange,
  person,
}: {
  payload: ProgressPhotosResponse | null;
  emptyLead: string;
  title?: string;
  heightCm?: number | null;
  resultsClassName?: string;
  analyzeWithAi?: {
    canAccess: boolean;
    state: AnalyzeAiState;
    onAnalyze: (yearMonths: [string, string]) => void;
  };
  onModeChange?: (mode: ViewMode) => void;
  person?: PersonName | null;
}) {
  const { t, lang } = useI18n();
  const [mode, setMode] = useState<ViewMode>("timeline");
  const [selected, setSelected] = useState<string[]>([]);
  const [compareSide, setCompareSide] = useState<"front" | "back">("front");
  const [lightbox, setLightbox] = useState<{ items: ProgressLightboxItem[]; index: number } | null>(
    null,
  );

  const months = useMemo(() => flattenTimelineMonths(payload), [payload]);
  const timelineGallery = useMemo(
    () =>
      timelineLightboxGallery(months, t("progressPhotosFront"), t("progressPhotosBackSide"), lang),
    [lang, months, t],
  );
  const comparable = months.filter((month) => month.front?.url || month.back?.url);
  const showCompareBar = mode !== "compare" && comparable.length >= 2;

  const compared = comparable
    .filter((month) => selected.includes(month.yearMonth))
    .sort((a, b) => String(b.yearMonth).localeCompare(String(a.yearMonth)));

  const onModeChangeRef = useRef(onModeChange);
  onModeChangeRef.current = onModeChange;
  useEffect(() => {
    onModeChangeRef.current?.(mode);
  }, [mode]);

  function setView(next: ViewMode) {
    setMode(next);
  }

  function exitCompare() {
    setSelected([]);
    setView("timeline");
  }

  function openPhoto(opts: OpenPhotoOpts) {
    const fallback: ProgressLightboxItem = {
      url: opts.url,
      title: opts.title,
      side: opts.side,
      ...(opts.yearMonth ? { yearMonth: opts.yearMonth } : {}),
    };
    const items = opts.gallery && opts.gallery.length > 0 ? opts.gallery : [fallback];
    const index = items.findIndex((item) => item.url === opts.url);
    setLightbox({ items, index: index >= 0 ? index : 0 });
  }

  const compareBar = showCompareBar ? (
    <div className="progress-photos-compare-bar">
      {mode === "pick" ? (
        <button
          type="button"
          className="recommend-cta progress-photos-compare-confirm-btn"
          disabled={selected.length < 2}
          onClick={() => {
            if (selected.length < 2) return;
            const newer = compared[0];
            setCompareSide(newer?.front?.url ? "front" : "back");
            setView("compare");
          }}
        >
          {t("progressPhotosCompareView")}
        </button>
      ) : null}
      <button
        type="button"
        className="recommend-again-btn progress-photos-compare-btn"
        onClick={() => {
          if (mode === "timeline") {
            setSelected([]);
            setView("pick");
            return;
          }
          setSelected([]);
          setView("timeline");
        }}
      >
        {mode === "pick" ? t("progressPhotosCompareCancel") : t("progressPhotosCompare")}
      </button>
    </div>
  ) : null;

  return (
    <>
      {title || compareBar ? (
        <div className="athlete-avances-history-header">
          {title ? <h3 className="athlete-avances-history-title">{title}</h3> : <span />}
          {compareBar}
        </div>
      ) : null}

      <div className={["progress-photos-results", resultsClassName].filter(Boolean).join(" ")}>
        {mode === "pick" ? (
          <div className="progress-photos-compare-pick">
            <p className="progress-photos-compare-pick-lead">
              {t("progressPhotosComparePickLead")}
            </p>
            <div
              className="progress-photos-compare-pick-list"
              role="listbox"
              aria-multiselectable="true"
            >
              {comparable.map((month) => {
                const active = selected.includes(month.yearMonth);
                return (
                  <button
                    key={month.yearMonth}
                    type="button"
                    className={`progress-photos-compare-pick-item${active ? " is-selected" : ""}`}
                    role="option"
                    aria-selected={active}
                    onClick={() =>
                      setSelected((prev) =>
                        prev.includes(month.yearMonth)
                          ? prev.filter((id) => id !== month.yearMonth)
                          : [...prev, month.yearMonth],
                      )
                    }
                  >
                    <span className="progress-photos-compare-pick-item-body">
                      <span className="progress-photos-compare-pick-item-title">
                        {timelineMonthLabel(month.yearMonth, lang)}
                      </span>
                      <span className="progress-photos-compare-pick-item-meta">
                        {month.weightKg != null
                          ? `${month.weightKg} kg`
                          : t("progressPhotosNoData")}
                      </span>
                    </span>
                    <span className="progress-photos-compare-pick-check" aria-hidden="true">
                      <svg
                        viewBox="0 0 16 16"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M3.5 8.5l3 3 6-6" />
                      </svg>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {mode === "compare" && compared.length >= 2 ? (
          <div className="progress-photos-compare">
            <div className="progress-photos-compare-toolbar">
              <button type="button" className="recommend-again-btn" onClick={exitCompare}>
                {t("progressPhotosCompareBack")}
              </button>
              {analyzeWithAi ? (
                <button
                  type="button"
                  className={`progress-photos-analyze-ai-btn${analyzeWithAi.canAccess ? "" : " is-locked"}`}
                  disabled={
                    !analyzeWithAi.canAccess || analyzeWithAi.state.loading || compared.length < 2
                  }
                  aria-disabled={
                    !analyzeWithAi.canAccess || analyzeWithAi.state.loading || compared.length < 2
                  }
                  title={analyzeWithAi.canAccess ? "" : t("progressPhotosAnalyzeAiLocked")}
                  onClick={() => {
                    if (!analyzeWithAi.canAccess || analyzeWithAi.state.loading) return;
                    const newest = compared[0];
                    const oldest = compared[compared.length - 1];
                    if (!newest || !oldest) return;
                    analyzeWithAi.onAnalyze([oldest.yearMonth, newest.yearMonth]);
                  }}
                >
                  {analyzeWithAi.state.loading
                    ? t("progressPhotosAnalyzeAiLoading")
                    : t("progressPhotosAnalyzeAi")}
                </button>
              ) : null}
            </div>
            {analyzeWithAi &&
            (analyzeWithAi.state.loading ||
              analyzeWithAi.state.sections?.length ||
              analyzeWithAi.state.error) ? (
              <AnalyzeAiResult state={analyzeWithAi.state} />
            ) : null}
            {compared.length === 2 && compared[0] && compared[1] ? (
              <ComparePair
                newer={compared[0]}
                older={compared[1]}
                side={compareSide}
                heightCm={heightCm ?? null}
                onSide={setCompareSide}
                onOpenPhoto={openPhoto}
              />
            ) : (
              <>
                <CompareMetrics
                  fromWeight={compared[compared.length - 1]?.weightKg ?? null}
                  toWeight={compared[0]?.weightKg ?? null}
                  heightCm={heightCm ?? null}
                />
                <CompareCarousel
                  side="front"
                  months={compared}
                  onOpenPhoto={openPhoto}
                />
                <CompareCarousel
                  side="back"
                  months={compared}
                  onOpenPhoto={openPhoto}
                />
              </>
            )}
          </div>
        ) : null}

        {mode === "timeline" ? (
          months.length ? (
            <div className="progress-photos-timeline" role="list">
              {months.map((month) => (
                <TimelineItem
                  key={month.yearMonth}
                  month={month}
                  gallery={timelineGallery}
                  onOpenPhoto={openPhoto}
                />
              ))}
            </div>
          ) : (
            <div className="progress-photos-empty">
              <p className="progress-photos-empty-title">{t("progressPhotosEmpty")}</p>
              <p className="progress-photos-empty-lead">{emptyLead}</p>
            </div>
          )
        ) : null}
      </div>
      <ProgressPhotoLightbox
        open={Boolean(lightbox)}
        items={lightbox?.items ?? []}
        index={lightbox?.index ?? 0}
        {...(person?.firstName ? { firstName: person.firstName } : {})}
        {...(person?.lastName ? { lastName: person.lastName } : {})}
        onClose={() => setLightbox(null)}
      />
    </>
  );
}

function TimelineItem({
  month,
  gallery,
  onOpenPhoto,
}: {
  month: ProgressMonth;
  gallery: ProgressLightboxItem[];
  onOpenPhoto: (opts: OpenPhotoOpts) => void;
}) {
  const { t, lang } = useI18n();
  const hasFront = Boolean(month.front?.url);
  const hasBack = Boolean(month.back?.url);

  return (
    <article className="progress-photos-timeline-item" role="listitem">
      <div className="progress-photos-timeline-header">
        <span className="progress-photos-timeline-marker" aria-hidden="true" />
        <h3 className="progress-photos-timeline-title">
          {timelineMonthLabel(month.yearMonth, lang)}
        </h3>
      </div>
      {month.weightKg != null ? (
        <div className="progress-photos-timeline-weight-row">
          <span className="progress-photos-timeline-weight-pill">
            {t("athleteAvancesMonthWeightPill")}: {month.weightKg} kg
          </span>
        </div>
      ) : null}
      {hasFront || hasBack ? (
        <div className="progress-photos-grid">
          <PhotoCard
            title={t("progressPhotosFront")}
            photo={month.front}
            side="front"
            yearMonth={month.yearMonth}
            gallery={gallery}
            onOpen={onOpenPhoto}
          />
          <PhotoCard
            title={t("progressPhotosBackSide")}
            photo={month.back}
            side="back"
            yearMonth={month.yearMonth}
            gallery={gallery}
            onOpen={onOpenPhoto}
          />
        </div>
      ) : (
        <div className="progress-photos-no-data">
          <span className="progress-photos-no-data-pill">{t("progressPhotosNoData")}</span>
        </div>
      )}
    </article>
  );
}

function PhotoCard({
  title,
  photo,
  side,
  yearMonth,
  gallery,
  onOpen,
  showTitle = true,
}: {
  title: string;
  photo: ProgressMonth["front"];
  side: "front" | "back";
  yearMonth?: string;
  gallery?: ProgressLightboxItem[];
  onOpen: (opts: OpenPhotoOpts) => void;
  showTitle?: boolean;
}) {
  const { t, lang } = useI18n();
  const labeled = yearMonth ? `${title} · ${timelineMonthLabel(yearMonth, lang)}` : title;
  function open() {
    if (!photo?.url) return;
    onOpen({
      url: photo.url,
      title: labeled,
      side,
      ...(yearMonth ? { yearMonth } : {}),
      ...(gallery ? { gallery } : {}),
    });
  }
  return (
    <article className="progress-photos-card">
      {showTitle ? <h4 className="progress-photos-card-title">{title}</h4> : null}
      {photo?.url ? (
        <img
          className="progress-photos-card-img"
          src={progressPhotoThumbUrl(photo.url)}
          alt={title}
          loading="lazy"
          role="button"
          tabIndex={0}
          onClick={open}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              open();
            }
          }}
        />
      ) : (
        <div className="progress-photos-card-empty">{t("progressPhotosNoPhoto")}</div>
      )}
    </article>
  );
}

function ComparePair({
  newer,
  older,
  side,
  heightCm,
  onSide,
  onOpenPhoto,
}: {
  newer: ProgressMonth;
  older: ProgressMonth;
  side: "front" | "back";
  heightCm: number | null;
  onSide: (side: "front" | "back") => void;
  onOpenPhoto: (opts: OpenPhotoOpts) => void;
}) {
  const { t, lang } = useI18n();
  const hasFront = Boolean(newer.front?.url || older.front?.url);
  const hasBack = Boolean(newer.back?.url || older.back?.url);
  const sideLabel = side === "front" ? t("progressPhotosFront") : t("progressPhotosBackSide");

  return (
    <div className="progress-photos-compare-pair">
      <div className="progress-photos-compare-tabs" role="tablist">
        <CompareTab
          side="front"
          active={side === "front"}
          available={hasFront}
          label={t("progressPhotosFront")}
          onSelect={onSide}
        />
        <CompareTab
          side="back"
          active={side === "back"}
          available={hasBack}
          label={t("progressPhotosBackSide")}
          onSelect={onSide}
        />
      </div>
      <div className="progress-photos-compare-pair-stage">
        <div className="progress-photos-compare-sides">
          <CompareColumn
            month={newer}
            side={side}
            sideLabel={sideLabel}
            gallery={lightboxGallery([newer, older], side, sideLabel, lang)}
            onOpenPhoto={onOpenPhoto}
          />
          <CompareColumn
            month={older}
            side={side}
            sideLabel={sideLabel}
            gallery={lightboxGallery([newer, older], side, sideLabel, lang)}
            onOpenPhoto={onOpenPhoto}
          />
        </div>
      </div>
      <CompareMetrics
        fromWeight={older.weightKg}
        toWeight={newer.weightKg}
        heightCm={heightCm}
      />
    </div>
  );
}

function CompareTab({
  side,
  active,
  available,
  label,
  onSelect,
}: {
  side: "front" | "back";
  active: boolean;
  available: boolean;
  label: string;
  onSelect: (side: "front" | "back") => void;
}) {
  return (
    <button
      type="button"
      className={`progress-photos-compare-tab${active ? " is-active" : ""}`}
      role="tab"
      aria-selected={active}
      hidden={!available}
      disabled={!available}
      onClick={() => onSelect(side)}
    >
      <span className="progress-photos-compare-tab-ico" aria-hidden="true">
        <CompareSideIcon side={side} />
      </span>
      <span className="progress-photos-compare-tab-label">{label}</span>
    </button>
  );
}

function CompareColumn({
  month,
  side,
  sideLabel,
  gallery,
  onOpenPhoto,
}: {
  month: ProgressMonth;
  side: "front" | "back";
  sideLabel: string;
  gallery: ProgressLightboxItem[];
  onOpenPhoto: (opts: OpenPhotoOpts) => void;
}) {
  const { lang } = useI18n();
  const photo = side === "front" ? month.front : month.back;
  return (
    <article className="progress-photos-compare-col">
      <div className="progress-photos-compare-col-head">
        <h3 className="progress-photos-compare-col-month">
          {timelineMonthLabel(month.yearMonth, lang)}
        </h3>
        <span className="progress-photos-compare-col-weight">
          {month.weightKg != null ? `${month.weightKg} kg` : "—"}
        </span>
      </div>
      <PhotoCard
        title={sideLabel}
        photo={photo}
        side={side}
        yearMonth={month.yearMonth}
        gallery={gallery}
        onOpen={onOpenPhoto}
        showTitle={false}
      />
    </article>
  );
}

function CompareMetrics({
  fromWeight,
  toWeight,
  heightCm,
}: {
  fromWeight: number | null;
  toWeight: number | null;
  heightCm: number | null;
}) {
  const { t } = useI18n();
  const delta = formatWeightDelta(fromWeight, toWeight);
  const height =
    heightCm != null && Number.isFinite(heightCm) ? `${Math.round(heightCm)} cm` : null;
  if (!delta && !height) return null;

  return (
    <div className="progress-photos-compare-metrics">
      {delta ? (
        <div className="progress-photos-compare-metric">
          <span className="progress-photos-compare-metric-label">
            {t("progressPhotosCompareWeightChange")}
          </span>
          <span className="progress-photos-compare-metric-value">{delta}</span>
        </div>
      ) : null}
      {height ? (
        <div className="progress-photos-compare-metric">
          <span className="progress-photos-compare-metric-label">{t("profileHeight")}</span>
          <span className="progress-photos-compare-metric-value is-static">{height}</span>
        </div>
      ) : null}
    </div>
  );
}

function CompareCarousel({
  side,
  months,
  onOpenPhoto,
}: {
  side: "front" | "back";
  months: ProgressMonth[];
  onOpenPhoto: (opts: OpenPhotoOpts) => void;
}) {
  const { t, lang } = useI18n();
  const [index, setIndex] = useState(0);
  const month = months[index];
  const sideLabel = side === "front" ? t("progressPhotosFront") : t("progressPhotosBackSide");
  const photo = month ? (side === "front" ? month.front : month.back) : null;
  const canNavigate = months.length > 1;

  return (
    <section className="progress-photos-carousel">
      <div className="progress-photos-carousel-head">
        <h4 className="progress-photos-carousel-title">{sideLabel}</h4>
        <div className="progress-photos-carousel-controls">
          <button
            type="button"
            className="progress-photos-carousel-nav"
            aria-label={t("progressPhotosComparePrev")}
            disabled={!canNavigate}
            onClick={() => setIndex((prev) => (prev - 1 + months.length) % months.length)}
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M10 3L5 8l5 5" />
            </svg>
          </button>
          <span className="progress-photos-carousel-counter">
            {index + 1} / {months.length}
          </span>
          <button
            type="button"
            className="progress-photos-carousel-nav"
            aria-label={t("progressPhotosCompareNext")}
            disabled={!canNavigate}
            onClick={() => setIndex((prev) => (prev + 1) % months.length)}
          >
            <svg
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M6 3l5 5-5 5" />
            </svg>
          </button>
        </div>
      </div>
      <div className="progress-photos-carousel-stage">
        {month ? (
          <article className="progress-photos-carousel-slide">
            <h5 className="progress-photos-carousel-month">
              {timelineMonthLabel(month.yearMonth, lang)}
            </h5>
            <p className="progress-photos-carousel-weight">
              {month.weightKg != null
                ? `${t("athleteAvancesMonthWeightPill")}: ${month.weightKg} kg`
                : "—"}
            </p>
            <PhotoCard
              title={sideLabel}
              photo={photo}
              side={side}
              yearMonth={month.yearMonth}
              gallery={lightboxGallery(months, side, sideLabel, lang)}
              onOpen={onOpenPhoto}
              showTitle={false}
            />
          </article>
        ) : null}
      </div>
      <div className="progress-photos-carousel-dots" role="tablist">
        {months.map((item, i) => (
          <button
            key={item.yearMonth}
            type="button"
            className={`progress-photos-carousel-dot${i === index ? " is-active" : ""}`}
            aria-label={`${i + 1} / ${months.length}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </section>
  );
}

function AnalyzeAiResult({ state }: { state: AnalyzeAiState }) {
  const [open, setOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    setOpen(false);
    setRevealed(false);
    const frame = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setOpen(true));
    });
    const timer = window.setTimeout(() => setRevealed(true), 750);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [state.loading, state.error, state.sections]);

  return (
    <div className={`progress-photos-analyze-slot${open ? " is-open" : ""}`}>
      <div className="progress-photos-analyze-slot-inner">
        <div className="progress-photos-analyze-result">
          {state.loading ? (
            <AnalyzeLoading />
          ) : state.error ? (
            <p className="progress-photos-analyze-status is-error">{state.error}</p>
          ) : state.sections?.length ? (
            <div
              className={`progress-photos-analyze-content${revealed ? " is-revealed" : ""}`}
            >
              <div className="progress-photos-analyze-scroll">
                <div className="progress-photos-analyze-body">
                  {state.sections.map((section) => (
                    <AnalyzeSection key={section.title} section={section} />
                  ))}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function AnalyzeLoading() {
  const { t } = useI18n();
  return <p className="progress-photos-analyze-status">{t("progressPhotosAnalyzeAiLoading")}</p>;
}

function AnalyzeSection({
  section,
}: {
  section: NonNullable<AnalyzeAiState["sections"]>[number];
}) {
  return (
    <>
      <h4 className="progress-photos-analyze-heading is-h1">{section.title}</h4>
      {section.blocks.map((block, index) => {
        if (block.type === "paragraph" && block.text.trim()) {
          return <p key={`${section.title}-p-${index}`}>{block.text.trim()}</p>;
        }
        if (block.type === "subtitle" && block.title?.trim() && block.text.trim()) {
          return (
            <div key={`${section.title}-s-${index}`}>
              <h5 className="progress-photos-analyze-heading is-h2">{block.title.trim()}</h5>
              <p>{block.text.trim()}</p>
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

function CompareSideIcon({ side }: { side: "front" | "back" }) {
  if (side === "back") {
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="5" r="2.5" />
        <path d="M8 10.5c1.2-1 2.5-1.5 4-1.5s2.8.5 4 1.5" />
        <path d="M12 9.5v6.5" />
        <path d="M9 22l3-6 3 6" />
        <path d="M7.5 14.5L12 12l4.5 2.5" />
      </svg>
    );
  }
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="5" r="2.5" />
      <path d="M8.5 22v-6.5L12 10l3.5 5.5V22" />
      <path d="M7 13.5 12 10l5 3.5" />
    </svg>
  );
}

function formatWeightDelta(fromWeight?: number | null, toWeight?: number | null) {
  if (fromWeight == null || toWeight == null) return null;
  const from = Number(fromWeight);
  const to = Number(toWeight);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const rounded = Math.round((to - from) * 10) / 10;
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded} kg`;
}

function lightboxGallery(
  months: ProgressMonth[],
  side: "front" | "back",
  sideLabel: string,
  lang: "es" | "en",
): ProgressLightboxItem[] {
  const items: ProgressLightboxItem[] = [];
  for (const month of months) {
    const photo = side === "front" ? month.front : month.back;
    if (!photo?.url || !month.yearMonth) continue;
    items.push({
      url: photo.url,
      title: `${sideLabel} · ${timelineMonthLabel(month.yearMonth, lang)}`,
      side,
      yearMonth: month.yearMonth,
    });
  }
  return items;
}

function timelineLightboxGallery(
  months: ProgressMonth[],
  frontLabel: string,
  backLabel: string,
  lang: "es" | "en",
): ProgressLightboxItem[] {
  const items: ProgressLightboxItem[] = [];
  for (const month of months) {
    if (month.front?.url) {
      items.push({
        url: month.front.url,
        title: `${frontLabel} · ${timelineMonthLabel(month.yearMonth, lang)}`,
        side: "front",
        yearMonth: month.yearMonth,
      });
    }
    if (month.back?.url) {
      items.push({
        url: month.back.url,
        title: `${backLabel} · ${timelineMonthLabel(month.yearMonth, lang)}`,
        side: "back",
        yearMonth: month.yearMonth,
      });
    }
  }
  return items;
}
