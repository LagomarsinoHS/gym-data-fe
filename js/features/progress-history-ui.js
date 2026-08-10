/**
 * Shared progress-photos history: chronological timeline + compare
 * (2 months side-by-side, 3+ dual carousels).
 * Used by coach progress-photos view and athlete Avances history.
 */
import { progressPhotoThumbUrl } from '../utils/cloudinary.js';
import { userProfile } from '../utils/helpers.js';
import { getLang, ui } from '../utils/labels.js';
import { openProgressPhotoLightbox } from './progress-photo-lightbox.js';

export function formatWeight(weight) {
  if (weight == null || weight === '') return '—';
  if (typeof weight === 'number' && Number.isFinite(weight)) {
    return `${weight} kg`;
  }
  const text = String(weight).trim();
  return text || '—';
}

export function flattenTimelineMonths(payload) {
  /** @type {Array<{ yearMonth: string, month: number, year?: number, weightKg?: number | null, front: any, back: any }>} */
  const entries = [];
  for (const yearEntry of payload?.years || []) {
    for (const monthEntry of yearEntry.months || []) {
      if (!monthEntry?.yearMonth) continue;
      const hasContent =
        monthEntry.front?.url ||
        monthEntry.back?.url ||
        (monthEntry.weightKg != null && monthEntry.weightKg !== '');
      if (!hasContent) continue;
      entries.push(monthEntry);
    }
  }
  entries.sort((a, b) => String(b.yearMonth).localeCompare(String(a.yearMonth)));
  return entries;
}

export function monthsWithPhotos(months) {
  return months.filter(m => m.front?.url || m.back?.url);
}

/**
 * Sync compare / cancel / view-comparison bar for timeline vs pick modes.
 * @param {{
 *   compareBar: HTMLElement | null | undefined,
 *   compareBtn: HTMLElement | null | undefined,
 *   compareConfirmBtn: HTMLButtonElement | null | undefined,
 *   viewMode: 'timeline' | 'pick' | 'compare',
 *   selectedYearMonths: string[],
 *   comparableMonths: unknown[],
 *   loading?: boolean,
 *   loadError?: unknown,
 * }} opts
 */
export function updateProgressCompareBar({
  compareBar,
  compareBtn,
  compareConfirmBtn,
  viewMode,
  selectedYearMonths,
  comparableMonths,
  loading = false,
  loadError = null,
}) {
  if (!compareBar || !compareBtn) return;
  const canCompare = comparableMonths.length >= 2;
  const showBar =
    viewMode !== 'compare' && canCompare && !loading && !loadError;
  compareBar.hidden = !showBar;
  if (!showBar) {
    if (compareConfirmBtn) compareConfirmBtn.hidden = true;
    return;
  }

  const labelEl = compareBtn.querySelector('[data-ui]');
  if (viewMode === 'timeline') {
    if (labelEl) labelEl.textContent = ui('progressPhotosCompare');
    else compareBtn.textContent = ui('progressPhotosCompare');
    if (compareConfirmBtn) {
      compareConfirmBtn.hidden = true;
      compareConfirmBtn.disabled = true;
    }
    return;
  }

  // pick mode
  if (labelEl) labelEl.textContent = ui('progressPhotosCompareCancel');
  else compareBtn.textContent = ui('progressPhotosCompareCancel');
  if (compareConfirmBtn) {
    compareConfirmBtn.hidden = false;
    const confirmLabel = compareConfirmBtn.querySelector('[data-ui]');
    if (confirmLabel) confirmLabel.textContent = ui('progressPhotosCompareView');
    compareConfirmBtn.disabled = selectedYearMonths.length < 2;
  }
}

/**
 * @param {{
 *   getPerson?: () => { firstName?: string, lastName?: string } | null | undefined,
 *   emptyLead?: string,
 *   getEmptyLead?: () => string,
 *   analyzeWithAi?: {
 *     canAccess?: () => boolean,
 *     getState?: () => { loading: boolean, sections: Array | null, error: string | null },
 *     onAnalyze?: (yearMonths: [string, string]) => void | Promise<void>,
 *   },
 * }} [opts]
 */
export function createProgressHistoryRenderer(opts = {}) {
  /** @type {'timeline' | 'pick' | 'compare'} */
  let viewMode = 'timeline';
  /** @type {string[]} */
  let selectedYearMonths = [];
  /** @type {{ resultsEl: HTMLElement, payload: any, loading: boolean, loadError: any, onStateChange?: Function } | null} */
  let lastRender = null;

  function getPerson() {
    return typeof opts.getPerson === 'function' ? opts.getPerson() : null;
  }

  function resolveEmptyLead() {
    if (typeof opts.getEmptyLead === 'function') return opts.getEmptyLead();
    if (typeof opts.emptyLead === 'string') return opts.emptyLead;
    return ui('progressPhotosEmptyLead');
  }

  function notifyStateChange() {
    if (!lastRender) return;
    const months = flattenTimelineMonths(lastRender.payload);
    lastRender.onStateChange?.({
      viewMode,
      selectedYearMonths: [...selectedYearMonths],
      months,
      comparableMonths: monthsWithPhotos(months),
      loading: lastRender.loading,
      loadError: lastRender.loadError,
    });
  }

  function rerender() {
    if (!lastRender?.resultsEl) return;
    renderInto(lastRender);
  }

  /**
   * @param {{
   *   resultsEl: HTMLElement,
   *   payload: any,
   *   loading?: boolean,
   *   loadError?: any,
   *   onStateChange?: (state: {
   *     viewMode: 'timeline' | 'pick' | 'compare',
   *     selectedYearMonths: string[],
   *     months: any[],
   *     comparableMonths: any[],
   *     loading: boolean,
   *     loadError: any,
   *   }) => void,
   * }} renderOpts
   */
  function render(renderOpts) {
    lastRender = {
      resultsEl: renderOpts.resultsEl,
      payload: renderOpts.payload,
      loading: Boolean(renderOpts.loading),
      loadError: renderOpts.loadError ?? null,
      onStateChange: renderOpts.onStateChange,
    };
    renderInto(lastRender);
  }

  function renderInto({ resultsEl, payload, loading, loadError }) {
    resultsEl.replaceChildren();

    if (loading) {
      const p = document.createElement('p');
      p.className = 'progress-photos-status';
      p.textContent = ui('progressPhotosLoading');
      resultsEl.append(p);
      notifyStateChange();
      return;
    }

    if (loadError) {
      const p = document.createElement('p');
      p.className = 'progress-photos-status is-error';
      p.textContent = ui('progressPhotosLoadFail');
      resultsEl.append(p);
      notifyStateChange();
      return;
    }

    if (!payload) {
      notifyStateChange();
      return;
    }

    const months = flattenTimelineMonths(payload);
    const comparable = monthsWithPhotos(months);

    if (months.length === 0) {
      resultsEl.append(createEmptyState());
      notifyStateChange();
      return;
    }

    if (viewMode === 'pick') {
      resultsEl.append(createPickPanel(comparable));
      notifyStateChange();
      return;
    }

    if (viewMode === 'compare') {
      const selectedMonths = selectedYearMonths
        .map(ym => findMonth(payload, ym))
        .filter(Boolean);
      if (selectedMonths.length < 2) {
        viewMode = 'pick';
        resultsEl.append(createPickPanel(comparable));
        notifyStateChange();
        return;
      }
      // Newest first (slide 0 = most recent).
      selectedMonths.sort((a, b) =>
        String(b.yearMonth).localeCompare(String(a.yearMonth)),
      );
      resultsEl.append(createComparePanel(selectedMonths));
      notifyStateChange();
      return;
    }

    const timeline = document.createElement('div');
    timeline.className = 'progress-photos-timeline';
    timeline.setAttribute('role', 'list');

    for (const monthEntry of months) {
      timeline.append(createTimelineItem(monthEntry));
    }

    resultsEl.append(timeline);
    notifyStateChange();
  }

  function findMonth(payload, yearMonth) {
    return (
      flattenTimelineMonths(payload).find(
        m => String(m.yearMonth) === String(yearMonth),
      ) || null
    );
  }

  function createEmptyState() {
    const wrap = document.createElement('div');
    wrap.className = 'progress-photos-empty';

    const title = document.createElement('p');
    title.className = 'progress-photos-empty-title';
    title.textContent = ui('progressPhotosEmpty');

    const lead = document.createElement('p');
    lead.className = 'progress-photos-empty-lead';
    lead.textContent = resolveEmptyLead();

    wrap.append(title, lead);
    return wrap;
  }

  function createPickPanel(comparableMonths) {
    const panel = document.createElement('div');
    panel.className = 'progress-photos-compare-pick';

    const lead = document.createElement('p');
    lead.className = 'progress-photos-compare-pick-lead';
    lead.textContent = ui('progressPhotosComparePickLead');
    panel.append(lead);

    const list = document.createElement('div');
    list.className = 'progress-photos-compare-pick-list';
    list.setAttribute('role', 'listbox');
    list.setAttribute('aria-multiselectable', 'true');

    for (const monthEntry of comparableMonths) {
      const key = String(monthEntry.yearMonth);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'progress-photos-compare-pick-item';
      btn.setAttribute('role', 'option');
      const selected = selectedYearMonths.includes(key);
      btn.classList.toggle('is-selected', selected);
      btn.setAttribute('aria-selected', selected ? 'true' : 'false');

      const body = document.createElement('span');
      body.className = 'progress-photos-compare-pick-item-body';

      const title = document.createElement('span');
      title.className = 'progress-photos-compare-pick-item-title';
      title.textContent = timelineMonthLabel(monthEntry.yearMonth);

      const meta = document.createElement('span');
      meta.className = 'progress-photos-compare-pick-item-meta';
      meta.textContent =
        monthEntry.weightKg != null && monthEntry.weightKg !== ''
          ? formatWeight(monthEntry.weightKg)
          : ui('progressPhotosNoData');

      body.append(title, meta);

      const check = document.createElement('span');
      check.className = 'progress-photos-compare-pick-check';
      check.setAttribute('aria-hidden', 'true');
      check.innerHTML =
        '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 8.5l3 3 6-6"/></svg>';

      btn.append(body, check);
      btn.addEventListener('click', () => toggleMonthSelection(key));
      list.append(btn);
    }

    panel.append(list);
    return panel;
  }

  function toggleMonthSelection(yearMonth) {
    const key = String(yearMonth);
    const idx = selectedYearMonths.indexOf(key);
    if (idx >= 0) {
      selectedYearMonths = selectedYearMonths.filter(ym => ym !== key);
    } else {
      selectedYearMonths = [...selectedYearMonths, key];
    }
    rerender();
  }

  function exitToTimeline() {
    viewMode = 'timeline';
    selectedYearMonths = [];
    rerender();
  }

  function createComparePanel(months) {
    const panel = document.createElement('div');
    panel.className = 'progress-photos-compare';

    const toolbar = document.createElement('div');
    toolbar.className = 'progress-photos-compare-toolbar';

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'recommend-again-btn';
    back.textContent = ui('progressPhotosCompareBack');
    back.addEventListener('click', () => exitToTimeline());
    toolbar.append(back);

    if (opts.analyzeWithAi) {
      const allowed =
        typeof opts.analyzeWithAi.canAccess === 'function'
          ? Boolean(opts.analyzeWithAi.canAccess())
          : false;
      const aiState =
        typeof opts.analyzeWithAi.getState === 'function'
          ? opts.analyzeWithAi.getState()
          : null;
      const analyzing = Boolean(aiState?.loading);

      const analyzeBtn = document.createElement('button');
      analyzeBtn.type = 'button';
      analyzeBtn.className = 'progress-photos-analyze-ai-btn';
      analyzeBtn.textContent = analyzing
        ? ui('progressPhotosAnalyzeAiLoading')
        : ui('progressPhotosAnalyzeAi');
      analyzeBtn.disabled = !allowed || analyzing || months.length < 2;
      analyzeBtn.setAttribute(
        'aria-disabled',
        analyzeBtn.disabled ? 'true' : 'false',
      );
      analyzeBtn.classList.toggle('is-locked', !allowed);
      analyzeBtn.title = allowed ? '' : ui('progressPhotosAnalyzeAiLocked');
      analyzeBtn.addEventListener('click', () => {
        if (!allowed || analyzing || months.length < 2) return;
        const newest = months[0];
        const oldest = months[months.length - 1];
        const yearMonths = /** @type {[string, string]} */ ([
          String(oldest.yearMonth),
          String(newest.yearMonth),
        ]);
        void opts.analyzeWithAi.onAnalyze?.(yearMonths);
      });
      toolbar.append(analyzeBtn);
    }

    panel.append(toolbar);

    if (opts.analyzeWithAi) {
      const aiState =
        typeof opts.analyzeWithAi.getState === 'function'
          ? opts.analyzeWithAi.getState()
          : null;
      if (aiState?.loading || aiState?.sections?.length || aiState?.error) {
        panel.append(createAnalyzeAiResult(aiState));
      }
    }

    if (months.length === 2) {
      panel.append(createComparePair(months[0], months[1]));
    } else {
      const oldest = months[months.length - 1];
      const newest = months[0];
      const delta = formatWeightDelta(oldest?.weightKg, newest?.weightKg);
      if (delta) {
        const deltaRow = document.createElement('div');
        deltaRow.className = 'progress-photos-compare-delta';
        const label = document.createElement('span');
        label.textContent = ui('progressPhotosCompareWeightChange');
        const value = document.createElement('span');
        value.className = 'progress-photos-compare-delta-value';
        value.textContent = delta;
        deltaRow.append(label, value);
        panel.append(deltaRow);
      }
      panel.append(
        createCompareCarousel(ui('progressPhotosFront'), months, 'front'),
        createCompareCarousel(ui('progressPhotosBackSide'), months, 'back'),
      );
    }

    return panel;
  }

  function createAnalyzeAiResult(state) {
    const slot = document.createElement('div');
    slot.className = 'progress-photos-analyze-slot';

    const inner = document.createElement('div');
    inner.className = 'progress-photos-analyze-slot-inner';

    const wrap = document.createElement('div');
    wrap.className = 'progress-photos-analyze-result';

    /** @type {HTMLElement | null} */
    let delayedContent = null;

    if (state.loading) {
      const status = document.createElement('p');
      status.className = 'progress-photos-analyze-status';
      status.textContent = ui('progressPhotosAnalyzeAiLoading');
      wrap.append(status);
    } else if (state.error) {
      const status = document.createElement('p');
      status.className = 'progress-photos-analyze-status is-error';
      status.textContent = state.error;
      wrap.append(status);
    } else if (state.sections?.length) {
      delayedContent = document.createElement('div');
      delayedContent.className = 'progress-photos-analyze-content';

      const scroll = document.createElement('div');
      scroll.className = 'progress-photos-analyze-scroll';
      scroll.append(renderAnalyzeAiSections(state.sections));

      delayedContent.append(scroll);
      wrap.append(delayedContent);
    }

    inner.append(wrap);
    slot.append(inner);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        slot.classList.add('is-open');

        if (!delayedContent) return;

        let revealed = false;
        const reveal = () => {
          if (revealed || !delayedContent) return;
          revealed = true;
          delayedContent.classList.add('is-revealed');
        };

        const onEnd = event => {
          if (event.target !== slot) return;
          if (
            event.propertyName !== 'grid-template-rows' &&
            event.propertyName !== 'opacity'
          ) {
            return;
          }
          slot.removeEventListener('transitionend', onEnd);
          reveal();
        };

        slot.addEventListener('transitionend', onEnd);
        // Fallback if transitionend is missed (prefers-reduced-motion, etc.)
        window.setTimeout(reveal, 750);
      });
    });

    return slot;
  }

  /**
   * Two-month compare: large panel with Frente/Espalda tabs + side-by-side photos.
   * @param {*} newer newest month (left)
   * @param {*} older oldest month (right)
   */
  function createComparePair(newer, older) {
    const wrap = document.createElement('div');
    wrap.className = 'progress-photos-compare-pair';

    const tabs = document.createElement('div');
    tabs.className = 'progress-photos-compare-tabs';
    tabs.setAttribute('role', 'tablist');

    const stage = document.createElement('div');
    stage.className = 'progress-photos-compare-pair-stage';

    /** @type {'front' | 'back'} */
    let activeSide = monthSideHasPhoto(newer, older, 'front')
      ? 'front'
      : 'back';

    const tabDefs = [
      { side: 'front', label: ui('progressPhotosFront'), icon: compareSideIconSvg('front') },
      { side: 'back', label: ui('progressPhotosBackSide'), icon: compareSideIconSvg('back') },
    ];

    /** @type {Map<string, HTMLButtonElement>} */
    const tabButtons = new Map();

    for (const def of tabDefs) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'progress-photos-compare-tab';
      btn.setAttribute('role', 'tab');

      const icon = document.createElement('span');
      icon.className = 'progress-photos-compare-tab-ico';
      icon.setAttribute('aria-hidden', 'true');
      icon.innerHTML = def.icon;

      const text = document.createElement('span');
      text.className = 'progress-photos-compare-tab-label';
      text.textContent = def.label;

      btn.append(icon, text);
      const available = monthSideHasPhoto(newer, older, def.side);
      btn.disabled = !available;
      btn.hidden = !available;
      btn.addEventListener('click', () => {
        if (!available) return;
        activeSide = /** @type {'front' | 'back'} */ (def.side);
        syncTabs();
        renderStage();
      });
      tabButtons.set(def.side, btn);
      tabs.append(btn);
    }

    wrap.append(tabs, stage);

    const delta = formatWeightDelta(older.weightKg, newer.weightKg);
    if (delta) {
      const metrics = document.createElement('div');
      metrics.className = 'progress-photos-compare-metrics';
      const item = document.createElement('div');
      item.className = 'progress-photos-compare-metric';
      const label = document.createElement('span');
      label.className = 'progress-photos-compare-metric-label';
      label.textContent = ui('progressPhotosCompareWeightChange');
      const value = document.createElement('span');
      value.className = 'progress-photos-compare-metric-value';
      value.textContent = delta;
      item.append(label, value);
      metrics.append(item);
      wrap.append(metrics);
    }

    function syncTabs() {
      for (const [side, btn] of tabButtons) {
        const selected = side === activeSide;
        btn.classList.toggle('is-active', selected);
        btn.setAttribute('aria-selected', selected ? 'true' : 'false');
      }
    }

    function renderStage() {
      stage.replaceChildren();
      stage.append(createCompareSideBySide(newer, older, activeSide));
    }

    syncTabs();
    renderStage();
    return wrap;
  }

  /**
   * Side-by-side photos for one side (newer left, older right).
   * @param {'front' | 'back'} side
   */
  function createCompareSideBySide(newer, older, side) {
    const sideLabel =
      side === 'front' ? ui('progressPhotosFront') : ui('progressPhotosBackSide');
    const gallery = buildLightboxGallery([newer, older], side, sideLabel);
    const root = document.createElement('div');
    root.className = 'progress-photos-compare-sides';

    root.append(
      createCompareSideColumn(newer, side, sideLabel, gallery),
      createCompareSideColumn(older, side, sideLabel, gallery),
    );
    return root;
  }

  function createCompareSideColumn(monthEntry, side, sideLabel, gallery) {
    const col = document.createElement('article');
    col.className = 'progress-photos-compare-col';

    const head = document.createElement('div');
    head.className = 'progress-photos-compare-col-head';

    const month = document.createElement('h3');
    month.className = 'progress-photos-compare-col-month';
    month.textContent = timelineMonthLabel(monthEntry.yearMonth);

    const weight = document.createElement('span');
    weight.className = 'progress-photos-compare-col-weight';
    weight.textContent =
      monthEntry.weightKg != null && monthEntry.weightKg !== ''
        ? formatWeight(monthEntry.weightKg)
        : '—';

    head.append(month, weight);
    col.append(head);

    const photo = side === 'front' ? monthEntry.front : monthEntry.back;
    col.append(
      createPhotoCard(sideLabel, photo, side, {
        showTitle: false,
        gallery,
        yearMonth: monthEntry.yearMonth,
      }),
    );
    return col;
  }

  /**
   * @param {string} sideLabel
   * @param {Array<{ yearMonth: string, weightKg?: number | null, front?: any, back?: any }>} months
   * @param {'front' | 'back'} side
   */
  function createCompareCarousel(sideLabel, months, side) {
    let index = 0;

    const section = document.createElement('section');
    section.className = 'progress-photos-carousel';

    const head = document.createElement('div');
    head.className = 'progress-photos-carousel-head';

    const title = document.createElement('h4');
    title.className = 'progress-photos-carousel-title';
    title.textContent = sideLabel;

    const controls = document.createElement('div');
    controls.className = 'progress-photos-carousel-controls';

    const prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'progress-photos-carousel-nav';
    prevBtn.setAttribute('aria-label', ui('progressPhotosComparePrev'));
    prevBtn.innerHTML =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3L5 8l5 5"/></svg>';

    const counter = document.createElement('span');
    counter.className = 'progress-photos-carousel-counter';

    const nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'progress-photos-carousel-nav';
    nextBtn.setAttribute('aria-label', ui('progressPhotosCompareNext'));
    nextBtn.innerHTML =
      '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 3l5 5-5 5"/></svg>';

    controls.append(prevBtn, counter, nextBtn);
    head.append(title, controls);
    section.append(head);

    const stage = document.createElement('div');
    stage.className = 'progress-photos-carousel-stage';
    section.append(stage);

    const dots = document.createElement('div');
    dots.className = 'progress-photos-carousel-dots';
    dots.setAttribute('role', 'tablist');
    section.append(dots);

    function renderSlide() {
      const monthEntry = months[index];
      stage.replaceChildren();
      if (!monthEntry) return;

      const slide = document.createElement('article');
      slide.className = 'progress-photos-carousel-slide';

      const monthTitle = document.createElement('h5');
      monthTitle.className = 'progress-photos-carousel-month';
      monthTitle.textContent = timelineMonthLabel(monthEntry.yearMonth);

      const weight = document.createElement('p');
      weight.className = 'progress-photos-carousel-weight';
      weight.textContent =
        monthEntry.weightKg != null && monthEntry.weightKg !== ''
          ? `${ui('athleteAvancesMonthWeightPill')}: ${formatWeight(monthEntry.weightKg)}`
          : '—';

      slide.append(monthTitle, weight);

      const photo = side === 'front' ? monthEntry.front : monthEntry.back;
      const gallery = buildLightboxGallery(months, side, sideLabel);
      slide.append(
        createPhotoCard(sideLabel, photo, side, {
          showTitle: false,
          gallery,
          yearMonth: monthEntry.yearMonth,
        }),
      );
      stage.append(slide);

      counter.textContent = `${index + 1} / ${months.length}`;
      const canNavigate = months.length > 1;
      prevBtn.disabled = !canNavigate;
      nextBtn.disabled = !canNavigate;

      dots.replaceChildren();
      months.forEach((_, i) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = 'progress-photos-carousel-dot';
        dot.classList.toggle('is-active', i === index);
        dot.setAttribute('aria-label', `${i + 1} / ${months.length}`);
        dot.addEventListener('click', () => {
          index = i;
          renderSlide();
        });
        dots.append(dot);
      });
    }

    prevBtn.addEventListener('click', () => {
      if (months.length <= 1) return;
      index = (index - 1 + months.length) % months.length;
      renderSlide();
    });

    nextBtn.addEventListener('click', () => {
      if (months.length <= 1) return;
      index = (index + 1) % months.length;
      renderSlide();
    });

    // Light swipe support on the stage.
    let touchStartX = null;
    stage.addEventListener(
      'touchstart',
      event => {
        touchStartX = event.changedTouches[0]?.clientX ?? null;
      },
      { passive: true },
    );
    stage.addEventListener(
      'touchend',
      event => {
        if (touchStartX == null || months.length <= 1) return;
        const endX = event.changedTouches[0]?.clientX ?? touchStartX;
        const delta = endX - touchStartX;
        touchStartX = null;
        if (Math.abs(delta) < 40) return;
        if (delta < 0) {
          index = (index + 1) % months.length;
          renderSlide();
        } else {
          index = (index - 1 + months.length) % months.length;
          renderSlide();
        }
      },
      { passive: true },
    );

    renderSlide();
    return section;
  }

  function createTimelineItem(monthEntry) {
    const item = document.createElement('article');
    item.className = 'progress-photos-timeline-item';
    item.setAttribute('role', 'listitem');

    const header = document.createElement('div');
    header.className = 'progress-photos-timeline-header';

    const marker = document.createElement('span');
    marker.className = 'progress-photos-timeline-marker';
    marker.setAttribute('aria-hidden', 'true');

    const title = document.createElement('h3');
    title.className = 'progress-photos-timeline-title';
    title.textContent = timelineMonthLabel(monthEntry.yearMonth);

    header.append(marker, title);
    item.append(header);

    if (monthEntry.weightKg != null && monthEntry.weightKg !== '') {
      const pillRow = document.createElement('div');
      pillRow.className = 'progress-photos-timeline-weight-row';

      const pill = document.createElement('span');
      pill.className = 'progress-photos-timeline-weight-pill';
      pill.textContent = `${ui('athleteAvancesMonthWeightPill')}: ${formatWeight(monthEntry.weightKg)}`;

      pillRow.append(pill);
      item.append(pillRow);
    }

    const hasFront = Boolean(monthEntry.front?.url);
    const hasBack = Boolean(monthEntry.back?.url);

    if (!hasFront && !hasBack) {
      item.append(createNoDataState());
      return item;
    }

    const grid = document.createElement('div');
    grid.className = 'progress-photos-grid';
    grid.append(
      createPhotoCard(ui('progressPhotosFront'), monthEntry.front, 'front'),
      createPhotoCard(ui('progressPhotosBackSide'), monthEntry.back, 'back'),
    );
    item.append(grid);
    return item;
  }

  function createNoDataState() {
    const wrap = document.createElement('div');
    wrap.className = 'progress-photos-no-data';

    const pill = document.createElement('span');
    pill.className = 'progress-photos-no-data-pill';
    pill.textContent = ui('progressPhotosNoData');

    wrap.append(pill);
    return wrap;
  }

  function createPhotoCard(title, photo, side, { showTitle = true, gallery = null, yearMonth = null } = {}) {
    const card = document.createElement('article');
    card.className = 'progress-photos-card';

    if (showTitle) {
      const heading = document.createElement('h4');
      heading.className = 'progress-photos-card-title';
      heading.textContent = title;
      card.append(heading);
    }

    if (photo?.url) {
      const img = document.createElement('img');
      img.className = 'progress-photos-card-img';
      // List/grid: Cloudinary thumb. Lightbox/download keep the original `photo.url`.
      img.src = progressPhotoThumbUrl(photo.url);
      img.alt = title;
      img.loading = 'lazy';
      img.tabIndex = 0;
      img.setAttribute('role', 'button');
      img.setAttribute('aria-label', title);
      const open = () => {
        const person = userProfile(getPerson());
        const items =
          Array.isArray(gallery) && gallery.length > 0
            ? gallery
            : [
                {
                  url: photo.url,
                  title: yearMonth
                    ? `${title} · ${timelineMonthLabel(yearMonth)}`
                    : title,
                  side,
                  yearMonth: yearMonth || undefined,
                },
              ];
        const index = items.findIndex(item => item.url === photo.url);
        openProgressPhotoLightbox({
          items,
          index: index >= 0 ? index : 0,
          firstName: person.firstName,
          lastName: person.lastName,
        });
      };
      img.addEventListener('click', open);
      img.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          open();
        }
      });
      card.append(img);
    } else {
      const empty = document.createElement('div');
      empty.className = 'progress-photos-card-empty';
      empty.textContent = ui('progressPhotosNoPhoto');
      card.append(empty);
    }

    return card;
  }

  return {
    getViewMode: () => viewMode,
    getSelectedYearMonths: () => [...selectedYearMonths],
    resetCompareState() {
      viewMode = 'timeline';
      selectedYearMonths = [];
    },
    enterPickMode() {
      selectedYearMonths = [];
      viewMode = 'pick';
    },
    enterCompareMode() {
      if (selectedYearMonths.length < 2) return false;
      viewMode = 'compare';
      return true;
    },
    exitToTimeline() {
      exitToTimeline();
    },
    render,
  };
}

function formatWeightDelta(fromWeight, toWeight) {
  if (
    fromWeight == null ||
    fromWeight === '' ||
    toWeight == null ||
    toWeight === ''
  ) {
    return null;
  }
  const from = Number(fromWeight);
  const to = Number(toWeight);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  const delta = to - from;
  const rounded = Math.round(delta * 10) / 10;
  const sign = rounded > 0 ? '+' : '';
  return `${sign}${rounded} kg`;
}

/**
 * Render structured AI analysis: section titles + paragraph/subtitle blocks.
 */
function renderAnalyzeAiSections(sections) {
  const root = document.createElement('div');
  root.className = 'progress-photos-analyze-body';

  for (const section of sections || []) {
    const title = typeof section?.title === 'string' ? section.title.trim() : '';
    if (!title) continue;

    const heading = document.createElement('h4');
    heading.className = 'progress-photos-analyze-heading is-h1';
    heading.textContent = title;
    root.append(heading);

    for (const block of section.blocks || []) {
      if (block?.type === 'paragraph' && typeof block.text === 'string' && block.text.trim()) {
        const p = document.createElement('p');
        p.textContent = block.text.trim();
        root.append(p);
        continue;
      }

      if (block?.type === 'subtitle') {
        const blockTitle = typeof block.title === 'string' ? block.title.trim() : '';
        const text = typeof block.text === 'string' ? block.text.trim() : '';
        if (!blockTitle || !text) continue;

        const sub = document.createElement('h5');
        sub.className = 'progress-photos-analyze-heading is-h2';
        sub.textContent = blockTitle;
        root.append(sub);

        const p = document.createElement('p');
        p.textContent = text;
        root.append(p);
      }
    }
  }

  return root;
}

function compareSideIconSvg(side) {
  if (side === 'back') {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
      '<circle cx="12" cy="5" r="2.5"/>' +
      '<path d="M8 10.5c1.2-1 2.5-1.5 4-1.5s2.8.5 4 1.5"/>' +
      '<path d="M12 9.5v6.5"/>' +
      '<path d="M9 22l3-6 3 6"/>' +
      '<path d="M7.5 14.5L12 12l4.5 2.5"/>' +
      '</svg>'
    );
  }
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="5" r="2.5"/>' +
    '<path d="M8.5 22v-6.5L12 10l3.5 5.5V22"/>' +
    '<path d="M7 13.5 12 10l5 3.5"/>' +
    '</svg>'
  );
}

function monthSideHasPhoto(newer, older, side) {
  const pick = month => (side === 'front' ? month?.front : month?.back);
  return Boolean(pick(newer)?.url || pick(older)?.url);
}

function buildLightboxGallery(months, side, sideLabel) {
  /** @type {Array<{ url: string, title: string, side: 'front' | 'back', yearMonth: string }>} */
  const items = [];
  for (const monthEntry of months || []) {
    const photo = side === 'front' ? monthEntry.front : monthEntry.back;
    if (!photo?.url || !monthEntry?.yearMonth) continue;
    items.push({
      url: photo.url,
      title: `${sideLabel} · ${timelineMonthLabel(monthEntry.yearMonth)}`,
      side,
      yearMonth: String(monthEntry.yearMonth),
    });
  }
  return items;
}

function timelineMonthLabel(yearMonth) {
  const match = String(yearMonth || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return String(yearMonth || '');
  const year = Number(match[1]);
  const month = Number(match[2]);
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  const raw = new Intl.DateTimeFormat(locale, {
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, 1)));
  const monthText = raw.replace(/\.$/, '');
  const capped = monthText
    ? monthText.charAt(0).toUpperCase() + monthText.slice(1)
    : monthText;
  return `${capped} ${year}`;
}
