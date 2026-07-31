/**
 * Coach — Mis alumnos: list shell + invite modal (email exacto).
 * Markup: #students-view, #add-student-overlay
 * API: POST /users/coach/invites · GET /users/coach/athletes
 */
import { getCoachAthletes, inviteCoachAthlete } from '../api/users.js';
import { ui } from '../utils/labels.js';

const SUCCESS_CLOSE_MS = 1200;

let overlay;
let form;
let emailInput;
let statusEl;
let submitBtn;
let submitLabel;
let submitFill;
let closeTimer = 0;
let athletes = [];
let athletesLoaded = false;
let loadSeq = 0;

export function initStudentsUi() {
  overlay = document.getElementById('add-student-overlay');
  form = document.getElementById('add-student-form');
  emailInput = document.getElementById('add-student-email');
  statusEl = document.getElementById('add-student-status');
  submitBtn = document.getElementById('add-student-submit');
  submitLabel = submitBtn?.querySelector('.recommend-submit-label');
  submitFill = document.getElementById('add-student-submit-fill');
  if (!overlay || !form) return;

  document.getElementById('students-add-btn')?.addEventListener('click', openAddStudentModal);
  document.getElementById('students-empty-add-btn')?.addEventListener('click', openAddStudentModal);
  document.getElementById('add-student-close')?.addEventListener('click', closeAddStudentModal);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeAddStudentModal();
  });
  form.addEventListener('submit', onSubmit);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeAddStudentModal();
    }
  });

  syncStudentsLabels();
}

/**
 * Fetch linked athletes for the authenticated coach.
 * Cached in memory until force refresh, logout, or session restore.
 * @param {{ force?: boolean }} [opts]
 */
export async function loadCoachAthletes({ force = false } = {}) {
  if (athletesLoaded && !force) return athletes;

  const seq = ++loadSeq;
  try {
    const data = await getCoachAthletes();
    if (seq !== loadSeq) return athletes;
    athletes = Array.isArray(data) ? data : [];
    athletesLoaded = true;
    return athletes;
  } catch (err) {
    console.error(err);
    if (seq !== loadSeq) return athletes;
    athletes = [];
    athletesLoaded = false;
    return athletes;
  }
}

export function clearCoachAthletesCache() {
  loadSeq += 1;
  athletes = [];
  athletesLoaded = false;
}

export function getStudents() {
  return athletes;
}

export function openAddStudentModal() {
  if (!overlay) return;
  clearCloseTimer();
  setStatus('');
  form?.reset();
  resetSubmitBtn();
  overlay.classList.add('open');
  emailInput?.focus();
}

export function closeAddStudentModal() {
  clearCloseTimer();
  overlay?.classList.remove('open');
  setStatus('');
  resetSubmitBtn();
}

export function syncStudentsLabels() {
  document.querySelectorAll('#students-view [data-ui], #add-student-overlay [data-ui]')
    .forEach(el => {
      el.textContent = ui(el.dataset.ui);
    });

  if (emailInput) emailInput.placeholder = ui('inviteEmailPlaceholder');
  if (submitBtn && !submitBtn.classList.contains('is-sent') && submitLabel) {
    submitLabel.textContent = ui('addStudentSubmit');
  }
}

function clearCloseTimer() {
  if (!closeTimer) return;
  window.clearTimeout(closeTimer);
  closeTimer = 0;
}

function resetSubmitBtn() {
  if (!submitBtn) return;
  submitBtn.disabled = false;
  submitBtn.classList.remove('is-sent');
  if (submitLabel) {
    submitLabel.dataset.ui = 'addStudentSubmit';
    submitLabel.textContent = ui('addStudentSubmit');
  }
  stopSubmitFill();
}

function stopSubmitFill() {
  if (!submitFill) return;
  submitFill.hidden = true;
  submitFill.style.animation = 'none';
  submitFill.style.width = '0%';
}

function startSubmitFill() {
  if (!submitFill) return;
  submitFill.hidden = false;
  submitFill.style.width = '';
  submitFill.style.animation = 'none';
  void submitFill.offsetWidth;
  submitFill.style.animation = '';
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

function inviteErrorMessage(err) {
  const status = err?.status;
  const raw = Array.isArray(err?.message) ? err.message.join(' ') : String(err?.message || '');
  const lower = raw.toLowerCase();

  if (status === 404) return ui('inviteNotFound');
  if (status === 409) {
    if (lower.includes('pending')) return ui('invitePending');
    return ui('inviteHasCoach');
  }
  return ui('inviteFail');
}

async function onSubmit(e) {
  e.preventDefault();
  const email = emailInput?.value.trim() ?? '';
  if (!email) return;

  clearCloseTimer();
  setStatus('');
  if (submitBtn) submitBtn.disabled = true;

  try {
    await inviteCoachAthlete(email);
    void loadCoachAthletes({ force: true });
    if (submitBtn) {
      submitBtn.classList.add('is-sent');
      submitBtn.disabled = true;
    }
    if (submitLabel) {
      submitLabel.dataset.ui = 'inviteSent';
      submitLabel.textContent = ui('inviteSent');
    }
    startSubmitFill();
    closeTimer = window.setTimeout(() => {
      closeTimer = 0;
      closeAddStudentModal();
    }, SUCCESS_CLOSE_MS);
  } catch (err) {
    console.error(err);
    setStatus(inviteErrorMessage(err), 'error');
    resetSubmitBtn();
  }
}
