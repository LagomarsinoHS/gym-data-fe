/**
 * Recommend training: inline composer (zone + equipment) + result cards.
 * Labels from GET /exercises/labels via getFilterLabels().
 * Markup: #recommend-view, #recommend-composer, #recommend-grid, #recommend-note
 * Plan shape: { exercises: [{ id, name, …, sets, reps, rest }], note? }
 */
import { fillCardMedia } from '../utils/cards.js';
import { mapApiError } from '../utils/api-errors.js';
import { label, titleCase, ui } from '../utils/labels.js';
import { setInlineStatus } from '../utils/dom-status.js';
import { prescriptionLines } from '../utils/prescription.js';

const EQUIP_MAX = 2;

let openBtn;
let composer;
let form;
let zoneSelect;
let equipChips;
let submitBtn;
let statusEl;
let getFilterLabels = () => ({ category: [], equipment: [] });
let onSubmitPlan = async () => {};
let selectedEquipment = new Set();
/** @type {object|null} last successful recommend response */
let lastPlan = null;
let loading = false;
let noteStreamTimer = null;
let noteStreamToken = 0;

export function initRecommendUi({
  getFilterLabels: getLabelsFn,
  onSubmit: onSubmitFn,
} = {}) {
  if (getLabelsFn) getFilterLabels = getLabelsFn;
  if (onSubmitFn) onSubmitPlan = onSubmitFn;

  openBtn = document.getElementById('recommend-open-btn');
  composer = document.getElementById('recommend-composer');
  form = document.getElementById('recommend-form');
  zoneSelect = document.getElementById('recommend-zone');
  equipChips = document.getElementById('recommend-equip-chips');
  submitBtn = document.getElementById('recommend-submit');
  statusEl = document.getElementById('recommend-status');
  if (!composer || !form) return;

  openBtn?.addEventListener('click', toggleRecommendComposer);

  zoneSelect?.addEventListener('change', syncSubmitEnabled);
  form.addEventListener('submit', onSubmit);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && isComposerOpen() && !loading) {
      e.stopImmediatePropagation();
      closeRecommendComposer();
    }
  });

  syncRecommendLabels();
  syncRecommendChrome();
}

export function openRecommendComposer() {
  if (!composer || loading) return;
  selectedEquipment = new Set();
  setStatus('');
  populateOptions();
  syncSubmitEnabled();
  composer.classList.add('is-open');
  composer.setAttribute('aria-hidden', 'false');
  composer.inert = false;
  openBtn?.setAttribute('aria-expanded', 'true');
  requestAnimationFrame(() => {
    zoneSelect?.focus();
    composer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  });
}

export function closeRecommendComposer() {
  if (!composer || loading) return;
  composer.classList.remove('is-open');
  composer.setAttribute('aria-hidden', 'true');
  composer.inert = true;
  openBtn?.setAttribute('aria-expanded', 'false');
  setStatus('');
}

function toggleRecommendComposer() {
  if (isComposerOpen()) closeRecommendComposer();
  else openRecommendComposer();
}

function isComposerOpen() {
  return Boolean(composer?.classList.contains('is-open'));
}

/** Clears in-memory recommend results (e.g. on logout). */
export function clearRecommendPlan() {
  lastPlan = null;
  setLoading(false);
  closeRecommendComposer();
  const grid = document.getElementById('recommend-grid');
  if (grid) grid.innerHTML = '';
  renderRecommendNote('');
  syncRecommendChrome();
}

export function syncRecommendLabels() {
  document.querySelectorAll('#recommend-view [data-ui]').forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });

  if (loading) syncSubmitLabel();
  if (isComposerOpen()) populateOptions();
  if (lastPlan) renderRecommendPlan(lastPlan);
  else syncRecommendChrome();
}

/**
 * Paint recommend results.
 * Expects { exercises: [{ id, name, sets, reps, rest }], note }.
 */
export function renderRecommendPlan(plan) {
  const grid = document.getElementById('recommend-grid');
  if (!grid) return;

  lastPlan = plan;
  const items = normalizeRecommendItems(plan);
  grid.innerHTML = '';
  renderRecommendNote(plan?.note);

  if (!items.length) {
    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `<p>🔍</p><p>${ui('empty')}</p>`;
    grid.appendChild(empty);
    syncRecommendChrome();
    return;
  }

  const frag = document.createDocumentFragment();
  items.forEach(item => frag.appendChild(createRecommendCard(item)));
  grid.appendChild(frag);
  syncRecommendChrome();
}

function syncRecommendChrome() {
  const empty = document.getElementById('recommend-empty');
  const results = document.getElementById('recommend-results');
  const hasPlan = Boolean(lastPlan) && normalizeRecommendItems(lastPlan).length > 0;

  if (empty) empty.hidden = false;
  if (results) results.hidden = !hasPlan;
}

function renderRecommendNote(note) {
  const section = document.getElementById('recommend-note');
  const body = document.getElementById('recommend-note-body');
  if (!section || !body) return;

  stopNoteStream();

  const text = String(note || '').trim();
  if (!text) {
    section.hidden = true;
    body.value = '';
    return;
  }

  const title = section.querySelector('[data-ui="recommendNoteTitle"]');
  if (title) title.textContent = ui('recommendNoteTitle');
  section.hidden = false;
  body.value = '';
  body.scrollTop = 0;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    body.value = text;
    return;
  }

  streamNoteChunks(body, text);
}

function stopNoteStream() {
  if (noteStreamTimer != null) {
    clearTimeout(noteStreamTimer);
    noteStreamTimer = null;
  }
  noteStreamToken += 1;
}

/** Reveal note in short word chunks (stream-style). */
function streamNoteChunks(body, text) {
  const words = text.match(/\S+\s*/g) || [text];
  const chunkSize = 2;
  const chunks = [];
  for (let i = 0; i < words.length; i += chunkSize) {
    chunks.push(words.slice(i, i + chunkSize).join(''));
  }

  const token = noteStreamToken;
  let index = 0;

  const tick = () => {
    if (token !== noteStreamToken) return;
    if (index >= chunks.length) {
      noteStreamTimer = null;
      return;
    }
    body.value += chunks[index];
    index += 1;
    body.scrollTop = body.scrollHeight;
    noteStreamTimer = setTimeout(tick, 90);
  };

  tick();
}

function normalizeRecommendItems(plan) {
  const list = Array.isArray(plan?.exercises) ? plan.exercises : [];
  return list
    .map(item => {
      if (!item) return null;
      if (item.exercise) {
        return {
          role: item.role,
          exercise: item.exercise,
          sets: item.sets ?? item.exercise.sets,
          reps: item.reps ?? item.exercise.reps,
          rest: item.rest ?? item.exercise.rest,
        };
      }
      if (item.id || item.name) {
        const { role, sets, reps, rest, ...exercise } = item;
        return {
          role,
          exercise,
          sets: sets ?? exercise.sets,
          reps: reps ?? exercise.reps,
          rest: rest ?? exercise.rest,
        };
      }
      return null;
    })
    .filter(item => item?.exercise);
}

function createRecommendCard(item) {
  const ex = item.exercise;
  const id = String(ex.id || '');
  const role = item.role ? titleCase(item.role) : '';
  const lines = prescriptionLines(item);

  const article = document.createElement('article');
  article.className = 'training-card recommend-card';
  if (id) article.dataset.id = id;
  article.innerHTML = `
    <div class="training-card-media">
      <img class="card-thumb" loading="lazy" alt="" />
      <img class="card-gif" alt="" />
    </div>
    <div class="training-card-body">
      <h3 class="training-card-name"></h3>
      <div class="card-tags">
        <span class="tag tag-cat"></span>
        <span class="tag tag-equip"></span>
      </div>
      <p class="recommend-card-role" hidden></p>
      <div class="training-rx-slot">
        <ul class="training-rx" hidden></ul>
      </div>
    </div>`;

  fillCardMedia(article, ex, { nameSelector: '.training-card-name' });

  if (role) {
    const roleEl = article.querySelector('.recommend-card-role');
    roleEl.hidden = false;
    roleEl.textContent = role;
  }

  if (lines.length) {
    const rx = article.querySelector('.training-rx');
    rx.hidden = false;
    lines.forEach(({ ico, text }) => {
      const li = document.createElement('li');
      const icoEl = document.createElement('span');
      icoEl.className = 'training-rx-ico';
      icoEl.setAttribute('aria-hidden', 'true');
      icoEl.textContent = ico;
      const textEl = document.createElement('span');
      textEl.textContent = text;
      li.append(icoEl, textEl);
      rx.appendChild(li);
    });
  }

  return article;
}

function populateOptions() {
  const { category = [], equipment = [] } = getFilterLabels() || {};
  const zoneValue = zoneSelect?.value || '';

  if (zoneSelect) {
    const placeholder = ui('recommendZonePlaceholder');
    zoneSelect.innerHTML = '';
    const empty = document.createElement('option');
    empty.value = '';
    empty.textContent = placeholder;
    zoneSelect.appendChild(empty);

    sortedValues(category).forEach(value => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = label(value);
      zoneSelect.appendChild(opt);
    });
    zoneSelect.value = category.includes(zoneValue) ? zoneValue : '';
  }

  if (equipChips) {
    equipChips.innerHTML = '';
    sortedValues(equipment).forEach(value => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'recommend-equip-chip';
      btn.dataset.value = value;
      btn.textContent = label(value);
      btn.setAttribute('aria-pressed', String(selectedEquipment.has(value)));
      if (selectedEquipment.has(value)) btn.classList.add('is-active');
      btn.addEventListener('click', () => toggleEquipment(value, btn));
      equipChips.appendChild(btn);
    });
  }
}

function sortedValues(values) {
  return [...new Set(values)].sort((a, b) =>
    label(a).localeCompare(label(b), undefined, { sensitivity: 'base' }));
}

function toggleEquipment(value, btn) {
  if (selectedEquipment.has(value)) {
    selectedEquipment.delete(value);
    btn.classList.remove('is-active');
    btn.setAttribute('aria-pressed', 'false');
  } else if (selectedEquipment.size < EQUIP_MAX) {
    selectedEquipment.add(value);
    btn.classList.add('is-active');
    btn.setAttribute('aria-pressed', 'true');
  } else {
    setStatus(ui('recommendEquipmentMax'), 'error');
    return;
  }
  setStatus('');
  syncSubmitEnabled();
}

function syncSubmitEnabled() {
  if (!submitBtn || loading) return;
  const zoneOk = Boolean(zoneSelect?.value);
  const equipOk = selectedEquipment.size >= 1 && selectedEquipment.size <= EQUIP_MAX;
  submitBtn.disabled = !(zoneOk && equipOk);
}

function syncSubmitLabel() {
  const labelEl = submitBtn?.querySelector('.recommend-submit-label');
  if (!labelEl) return;
  labelEl.textContent = ui(loading ? 'recommendGenerating' : 'recommendSubmit');
}

function setLoading(show) {
  loading = show;
  form?.classList.toggle('is-loading', show);
  submitBtn?.classList.toggle('is-loading', show);
  if (openBtn) openBtn.disabled = show;
  if (zoneSelect) zoneSelect.disabled = show;
  syncSubmitLabel();
  if (show) {
    if (submitBtn) submitBtn.disabled = true;
  } else {
    syncSubmitEnabled();
  }
}

function setStatus(message, kind = '') {
  setInlineStatus(statusEl, message, kind);
}

async function onSubmit(e) {
  e.preventDefault();
  if (loading || submitBtn?.disabled) return;
  const zone = zoneSelect?.value;
  const equipment = [...selectedEquipment];

  setStatus('');
  setLoading(true);
  try {
    await onSubmitPlan({ zone, equipment });
    setLoading(false);
    closeRecommendComposer();
  } catch (err) {
    console.error(err);
    setLoading(false);
    setStatus(mapApiError(err, { fallback: 'recommendFail' }), 'error');
  }
}
