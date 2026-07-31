/**
 * Login / register overlay (#auth-overlay in index.html).
 * API: js/api/auth.js · abierto desde js/main.js (botón #my-plan-btn).
 */
import { createUser, loginUser } from '../api/auth.js';
import { setToken } from '../api/token.js';
import { authErrorMessage } from '../utils/auth-errors.js';
import { ui } from '../utils/labels.js';

let overlay;
let form;
let titleEl;
let submitBtn;
let switchLink;
let statusEl;
let mode = 'login'; // 'login' | 'register'
let busy = false;
let onAuthSuccess = async () => {};

export function initAuthUi({ onAuthSuccess: cb } = {}) {
  if (cb) onAuthSuccess = cb;
  overlay = document.getElementById('auth-overlay');
  form = document.getElementById('auth-form');
  titleEl = document.getElementById('auth-title');
  submitBtn = document.getElementById('auth-submit');
  switchLink = document.getElementById('auth-switch');
  statusEl = document.getElementById('auth-status');
  if (!overlay || !form) return;

  document.getElementById('auth-close')?.addEventListener('click', closeAuth);
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeAuth();
  });

  switchLink?.addEventListener('click', e => {
    e.preventDefault();
    if (busy) return;
    mode = mode === 'login' ? 'register' : 'login';
    setStatus('');
    syncAuthLabels();
    focusFirstField();
  });

  form.addEventListener('submit', onSubmit);

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) {
      e.stopImmediatePropagation();
      closeAuth();
    }
  });

  syncAuthLabels();
}

async function onSubmit(e) {
  e.preventDefault();
  if (busy) return;

  const email = form.querySelector('#auth-email')?.value.trim() ?? '';
  const password = form.querySelector('#auth-password')?.value ?? '';
  setStatus('');

  busy = true;
  submitBtn.disabled = true;
  try {
    let accessToken;

    if (mode === 'login') {
      ({ accessToken } = await loginUser({ email, password }));
    } else {
      const firstName = form.querySelector('#auth-first-name')?.value.trim() ?? '';
      const lastName = form.querySelector('#auth-last-name')?.value.trim() ?? '';
      const role = form.querySelector('input[name="role"]:checked')?.value || 'athlete';
      ({ accessToken } = await createUser({ firstName, lastName, email, password, role }));
    }

    setToken(accessToken);
    closeAuth();
    await onAuthSuccess();
  } catch (err) {
    console.error(err);
    setStatus(authErrorMessage(err, mode), 'error');
  } finally {
    busy = false;
    submitBtn.disabled = false;
  }
}

function setStatus(text, kind = '') {
  if (!statusEl) return;
  statusEl.textContent = text;
  statusEl.classList.toggle('is-error', kind === 'error');
  statusEl.classList.toggle('is-ok', kind === 'ok');
  statusEl.hidden = !text;
}

function focusFirstField() {
  const id = mode === 'register' ? '#auth-first-name' : '#auth-email';
  requestAnimationFrame(() => form?.querySelector(id)?.focus());
}

export function openAuth(startMode = 'login') {
  if (!overlay) return;
  mode = startMode;
  busy = false;
  if (submitBtn) submitBtn.disabled = false;
  setStatus('');
  form?.reset();
  syncAuthLabels();
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  focusFirstField();
}

export function closeAuth() {
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  mode = 'login';
  setStatus('');
}

export function syncAuthLabels() {
  if (!overlay) return;

  const isLogin = mode === 'login';
  titleEl.textContent = ui(isLogin ? 'loginTitle' : 'registerTitle');
  submitBtn.textContent = ui(isLogin ? 'loginSubmit' : 'registerSubmit');
  switchLink.textContent = ui(isLogin ? 'createAccount' : 'haveAccount');

  form.querySelectorAll('.auth-register-only').forEach(el => {
    el.hidden = isLogin;
    el.querySelectorAll('input:not([type="radio"])').forEach(input => {
      input.required = !isLogin;
    });
  });

  const firstName = form.querySelector('#auth-first-name');
  const lastName = form.querySelector('#auth-last-name');
  const email = form.querySelector('#auth-email');
  const password = form.querySelector('#auth-password');
  const roleToggle = form.querySelector('#auth-role-toggle');

  if (firstName) firstName.placeholder = ui('firstName');
  if (lastName) lastName.placeholder = ui('lastName');
  if (email) email.placeholder = ui('email');
  if (password) {
    password.placeholder = ui('password');
    password.autocomplete = isLogin ? 'current-password' : 'new-password';
  }
  if (roleToggle) {
    roleToggle.setAttribute('aria-label', ui('authRole'));
  }

  form.querySelectorAll('[data-ui]').forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });
}
