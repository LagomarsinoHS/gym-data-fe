/**
 * Recommend training: modal (zone + equipment) + result cards.
 * Labels from GET /exercises/labels via getFilterLabels().
 * Markup: #recommend-overlay, #recommend-open-btn, #recommend-grid
 */
import { fillCardMedia } from '../utils/cards.js';
import { label, titleCase, ui } from '../utils/labels.js';

const EQUIP_MAX = 2;

let overlay;
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

export function initRecommendUi({
  getFilterLabels: getLabelsFn,
  onSubmit: onSubmitFn,
} = {}) {
  if (getLabelsFn) getFilterLabels = getLabelsFn;
  if (onSubmitFn) onSubmitPlan = onSubmitFn;

  overlay = document.getElementById('recommend-overlay');
  form = document.getElementById('recommend-form');
  zoneSelect = document.getElementById('recommend-zone');
  equipChips = document.getElementById('recommend-equip-chips');
  submitBtn = document.getElementById('recommend-submit');
  statusEl = document.getElementById('recommend-status');
  if (!overlay || !form) return;

  document.getElementById('recommend-open-btn')?.addEventListener('click', openRecommendModal);
  document.getElementById('recommend-again-btn')?.addEventListener('click', openRecommendModal);
  document.getElementById('recommend-modal-close')?.addEventListener('click', closeRecommendModal);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeRecommendModal();
  });

  zoneSelect?.addEventListener('change', syncSubmitEnabled);
  form.addEventListener('submit', onSubmit);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeRecommendModal();
    }
  });

  syncRecommendLabels();
  syncRecommendChrome();
}

export function openRecommendModal() {
  if (!overlay) return;
  selectedEquipment = new Set();
  setStatus('');
  populateOptions();
  syncSubmitEnabled();
  overlay.classList.add('open');
  zoneSelect?.focus();
}

export function closeRecommendModal() {
  overlay?.classList.remove('open');
  setStatus('');
}

/** Clears in-memory recommend results (e.g. on logout). */
export function clearRecommendPlan() {
  lastPlan = null;
  closeRecommendModal();
  const grid = document.getElementById('recommend-grid');
  if (grid) grid.innerHTML = '';
  syncRecommendChrome();
}

export function syncRecommendLabels() {
  document.querySelectorAll('#recommend-view [data-ui], #recommend-overlay [data-ui]')
    .forEach(el => {
      el.textContent = ui(el.dataset.ui);
    });

  if (overlay?.classList.contains('open')) populateOptions();
  if (lastPlan) renderRecommendPlan(lastPlan);
  else syncRecommendChrome();
}

/**
 * Paint recommend results. Expects { exercises: [{ role?, exercise }] }
 * or items with exercise fields inlined + role.
 */
export function renderRecommendPlan(plan) {
  const grid = document.getElementById('recommend-grid');
  if (!grid) return;

  lastPlan = plan;
  const items = normalizeRecommendItems(plan);
  grid.innerHTML = '';

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

  if (empty) empty.hidden = hasPlan;
  if (results) results.hidden = !hasPlan;
}

function normalizeRecommendItems(plan) {
  const list = Array.isArray(plan?.exercises) ? plan.exercises : [];
  return list
    .map(item => {
      if (!item) return null;
      if (item.exercise) {
        return { role: item.role, exercise: item.exercise };
      }
      if (item.id || item.name) {
        const { role, ...exercise } = item;
        return { role, exercise };
      }
      return null;
    })
    .filter(item => item?.exercise);
}

function createRecommendCard(item) {
  const ex = item.exercise;
  const id = String(ex.id || '');
  const role = item.role ? titleCase(item.role) : '';

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
    </div>`;

  fillCardMedia(article, ex, { nameSelector: '.training-card-name' });

  if (role) {
    const roleEl = article.querySelector('.recommend-card-role');
    roleEl.hidden = false;
    roleEl.textContent = role;
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
  if (!submitBtn) return;
  const zoneOk = Boolean(zoneSelect?.value);
  const equipOk = selectedEquipment.size >= 1 && selectedEquipment.size <= EQUIP_MAX;
  submitBtn.disabled = !(zoneOk && equipOk);
}

function setStatus(message, kind = '') {
  if (!statusEl) return;
  if (!message) {
    statusEl.hidden = true;
    statusEl.textContent = '';
    statusEl.classList.remove('is-error', 'is-ok');
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle('is-error', kind === 'error');
  statusEl.classList.toggle('is-ok', kind === 'ok');
}

async function onSubmit(e) {
  e.preventDefault();
  const zone = zoneSelect?.value;
  const equipment = [...selectedEquipment];
  if (!zone || equipment.length < 1 || equipment.length > EQUIP_MAX) {
    syncSubmitEnabled();
    return;
  }

  submitBtn.disabled = true;
  setStatus('');
  try {
    await onSubmitPlan({ zone, equipment });
    closeRecommendModal();
  } catch (err) {
    console.error(err);
    setStatus(err.message || ui('recommendFail'), 'error');
    syncSubmitEnabled();
  }
}
