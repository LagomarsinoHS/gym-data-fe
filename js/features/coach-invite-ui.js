/**
 * Athlete — pending coach invite banner (accept / reject).
 * Markup: #coach-invite-banner, #nav-coach-plan-dot
 * API: GET /users/me/pending-coach-invite
 *      POST /users/me/pending-coach-invite/respond { action: 'accept' | 'reject' }
 *
 * Fetch: once on session start (login / restore), and again when the tab
 * becomes visible. Not on every navigation / chrome re-render.
 */
import { getPendingCoachInvite, respondCoachInvite } from '../api/users.js';
import { ui } from '../utils/labels.js';
import {
  getUser,
  isAthlete,
  onSessionChrome,
  refreshUser,
  setView,
} from './session-ui.js';

let banner;
let messageEl;
let statusEl;
let acceptBtn;
let rejectBtn;
let busy = false;
/** @type {object | null} */
let pendingInvite = null;
/** @type {Promise<void> | null} */
let inFlight = null;

export function initCoachInviteUi() {
  banner = document.getElementById('coach-invite-banner');
  messageEl = document.getElementById('coach-invite-message');
  statusEl = document.getElementById('coach-invite-status');
  acceptBtn = document.getElementById('coach-invite-accept');
  rejectBtn = document.getElementById('coach-invite-reject');
  if (!banner) return;

  acceptBtn?.addEventListener('click', () => onRespond('accept'));
  rejectBtn?.addEventListener('click', () => onRespond('reject'));

  // Logout / role change: clear and paint only (no network).
  onSessionChrome(() => {
    const user = getUser();
    if (!user || !isAthlete(user)) pendingInvite = null;
    paintBanner();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      void loadPendingCoachInvite({ force: true });
    }
  });
}

/**
 * Load pending invite from API (session start or tab focus).
 * Concurrent calls share one in-flight request.
 */
export function loadPendingCoachInvite({ force = false } = {}) {
  const user = getUser();

  if (!user || !isAthlete(user)) {
    pendingInvite = null;
    paintBanner();
    return Promise.resolve();
  }

  if (inFlight && !force) return inFlight;

  const run = (async () => {
    try {
      const data = await getPendingCoachInvite();
      pendingInvite = data.invite;
    } catch (err) {
      console.error(err);
      pendingInvite = null;
    }
    paintBanner();
  })();

  inFlight = run.finally(() => {
    if (inFlight === run) inFlight = null;
  });
  return inFlight;
}

/** Re-paint banner labels (e.g. language change). No network. */
export function syncCoachInviteBanner() {
  paintBanner();
}

function paintBanner() {
  const show = Boolean(pendingInvite);

  if (banner) {
    const wasHidden = banner.hidden;
    banner.hidden = !show;
    if (show && wasHidden) {
      banner.style.animation = 'none';
      void banner.offsetWidth;
      banner.style.animation = '';
    }
  }

  const dot = document.getElementById('nav-coach-plan-dot');
  if (dot) dot.hidden = !show;

  if (!show) {
    setStatus('');
    setBusy(false);
    return;
  }

  if (messageEl) {
    const coach = pendingInvite.coach || {};
    const name = [coach.firstName, coach.lastName].filter(Boolean).join(' ').trim()
      || 'Coach';
    const nameEl = document.createElement('strong');
    nameEl.className = 'coach-invite-name';
    nameEl.textContent = name;
    messageEl.replaceChildren(nameEl, ` ${ui('coachInviteBannerRest')}`);
  }
}

function setStatus(message, kind = '') {
  if (!statusEl) return;
  if (!message) {
    statusEl.hidden = true;
    statusEl.textContent = '';
    statusEl.classList.remove('is-error');
    return;
  }
  statusEl.hidden = false;
  statusEl.textContent = message;
  statusEl.classList.toggle('is-error', kind === 'error');
}

function setBusy(next) {
  busy = next;
  if (acceptBtn) acceptBtn.disabled = next;
  if (rejectBtn) rejectBtn.disabled = next;
}

async function onRespond(action) {
  if (busy) return;
  setStatus('');
  setBusy(true);

  try {
    await respondCoachInvite(action);
    pendingInvite = null;
    paintBanner();
    await refreshUser();
    if (action === 'accept') setView('coach-plan');
  } catch (err) {
    console.error(err);
    setStatus(
      ui(action === 'accept' ? 'coachInviteAcceptFail' : 'coachInviteRejectFail'),
      'error',
    );
  } finally {
    setBusy(false);
  }
}
