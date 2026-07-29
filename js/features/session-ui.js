/**
 * Session shell: guest vs logged-in sidebar, catalog | training views.
 * Markup: #sidebar-guest, #sidebar-auth, #catalog-view, #training-view in index.html
 * Training grid rendering is driven by main.js (filters live there).
 */
import { getMe } from '../api/users.js';
import { clearToken, isLoggedIn } from '../api/token.js';
import { ui } from '../utils/labels.js';

let view = 'catalog'; // 'catalog' | 'training'
let user = null;
let onViewChange = () => {};

export function initSessionUi({ onViewChange: cb } = {}) {
  if (cb) onViewChange = cb;

  document.getElementById('nav-training')?.addEventListener('click', () => setView('training'));
  document.getElementById('nav-catalog')?.addEventListener('click', () => setView('catalog'));
  document.getElementById('logout-btn')?.addEventListener('click', logout);

  syncSessionLabels();
  renderSessionChrome();
}

export async function restoreSession() {
  if (!isLoggedIn()) {
    user = null;
    renderSessionChrome();
    return null;
  }

  try {
    user = await getMe();
    renderSessionChrome();
    return user;
  } catch (err) {
    console.error(err);
    clearToken();
    user = null;
    renderSessionChrome();
    return null;
  }
}

export function getUser() {
  return user;
}

export function getView() {
  return view;
}

export function setView(next) {
  if (next !== 'catalog' && next !== 'training') return;
  view = next;
  renderSessionChrome();
  onViewChange(view);
}

export function logout() {
  clearToken();
  user = null;
  view = 'catalog';
  renderSessionChrome();
  onViewChange(view);
}

export function syncSessionLabels() {
  document.querySelectorAll('#sidebar-guest [data-ui], #sidebar-auth [data-ui]')
    .forEach(el => {
      el.textContent = ui(el.dataset.ui);
    });

  const myPlanBtn = document.getElementById('my-plan-btn');
  if (myPlanBtn) myPlanBtn.title = ui('myPlan');

  renderUserName();
  syncNavActive();
}

function renderUserName() {
  const el = document.getElementById('sidebar-user-name');
  if (!el || !user) return;
  el.textContent = `${user.firstName} ${user.lastName}`;
}

function syncNavActive() {
  const training = document.getElementById('nav-training');
  const catalog = document.getElementById('nav-catalog');
  const onTraining = view === 'training';

  training?.classList.toggle('is-active', onTraining);
  catalog?.classList.toggle('is-active', !onTraining);

  if (onTraining) {
    training?.setAttribute('aria-current', 'page');
    catalog?.removeAttribute('aria-current');
  } else {
    catalog?.setAttribute('aria-current', 'page');
    training?.removeAttribute('aria-current');
  }
}

function renderSessionChrome() {
  const guest = document.getElementById('sidebar-guest');
  const auth = document.getElementById('sidebar-auth');
  const catalogView = document.getElementById('catalog-view');
  const trainingView = document.getElementById('training-view');
  const catalogBar = document.getElementById('catalog-bar-extras');
  const loggedIn = Boolean(user);

  if (guest) guest.hidden = loggedIn;
  if (auth) auth.hidden = !loggedIn;

  const showTraining = loggedIn && view === 'training';
  if (catalogView) catalogView.hidden = showTraining;
  if (trainingView) trainingView.hidden = !showTraining;
  if (catalogBar) catalogBar.hidden = showTraining;

  renderUserName();
  syncNavActive();
}
