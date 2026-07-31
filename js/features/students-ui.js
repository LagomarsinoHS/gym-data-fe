/**
 * Coach — Mis alumnos: list shell + “Agregar alumno” modal (email exacto).
 * Markup: #students-view, #add-student-overlay
 * API de vincular: pendiente en back.
 */
import { ui } from '../utils/labels.js';

let overlay;
let form;
let emailInput;
let statusEl;
let submitBtn;

export function initStudentsUi() {
  overlay = document.getElementById('add-student-overlay');
  form = document.getElementById('add-student-form');
  emailInput = document.getElementById('add-student-email');
  statusEl = document.getElementById('add-student-status');
  submitBtn = document.getElementById('add-student-submit');
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

export function openAddStudentModal() {
  if (!overlay) return;
  setStatus('');
  form?.reset();
  overlay.classList.add('open');
  emailInput?.focus();
}

export function closeAddStudentModal() {
  overlay?.classList.remove('open');
  setStatus('');
}

export function syncStudentsLabels() {
  document.querySelectorAll('#students-view [data-ui], #add-student-overlay [data-ui]')
    .forEach(el => {
      el.textContent = ui(el.dataset.ui);
    });

  if (emailInput) emailInput.placeholder = ui('email');
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
  const email = emailInput?.value.trim() ?? '';
  if (!email) return;

  // API pendiente: por ahora solo feedback de UI.
  setStatus(ui('addStudentSoon'), 'ok');
  if (submitBtn) submitBtn.disabled = true;
  window.setTimeout(() => {
    if (submitBtn) submitBtn.disabled = false;
  }, 600);
}
