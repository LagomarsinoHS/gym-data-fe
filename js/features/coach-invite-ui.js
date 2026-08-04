/**
 * Athlete — pending coach invite banner (accept / reject).
 * Markup: #coach-invite-banner, #nav-coach-plan-dot
 * API: GET /users/me/pending-coach-invite
 *      POST /users/me/pending-coach-invite/respond { action: 'accept' | 'reject' }
 *
 * Fetch: whenever /users/me is restored/refetched (onUserSynced), and when
 * the tab becomes visible. Not on every navigation / chrome re-render.
 */
import { getPendingCoachInvite, respondCoachInvite } from '../api/users.js';
import { ui } from '../utils/labels.js';
import { ApiErrorCode, mapApiError } from '../utils/api-errors.js';
import {
  getUser,
  isAthlete,
  onSessionChrome,
  onUserSynced,
  refreshUser,
  setView,
} from './session-ui.js';

const FLASH_MS = 4000;

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
let flashTimer = 0;

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
    if (!flashTimer) paintBanner();
  });

  // Paired with GET /users/me (restoreSession / refreshUser).
  onUserSynced(() => {
    if (flashTimer) return;
    loadPendingCoachInvite({ force: true });
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !flashTimer) {
      void loadPendingCoachInvite({ force: true });
    }
  });
}

/**
 * Load pending invite from API.
 * Concurrent calls share one in-flight request.
 */
export function loadPendingCoachInvite({ force = false } = {}) {
  const user = getUser();

  if (!user || !isAthlete(user)) {
    pendingInvite = null;
    if (!flashTimer) paintBanner();
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
    if (!flashTimer) paintBanner();
  })();

  inFlight = run.finally(() => {
    if (inFlight === run) inFlight = null;
  });
  return inFlight;
}

/** Re-paint banner labels (e.g. language change). No network. */
export function syncCoachInviteBanner() {
  if (!flashTimer) paintBanner();
}

function inviteChromeEls() {
  return {
    copy: banner?.querySelector('.coach-invite-banner-copy') ?? null,
    actions: banner?.querySelector('.coach-invite-banner-actions') ?? null,
  };
}

function paintBanner() {
  const show = Boolean(pendingInvite);
  const { copy, actions } = inviteChromeEls();

  if (copy) copy.hidden = !show;
  if (actions) actions.hidden = !show;

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

/**
 * Hide invite actions and show a temporary status message on the banner.
 */
function flashBannerMessage(message, kind = 'error') {
  clearFlashTimer();
  pendingInvite = null;
  setBusy(false);

  const { copy, actions } = inviteChromeEls();
  if (copy) copy.hidden = true;
  if (actions) actions.hidden = true;

  const dot = document.getElementById('nav-coach-plan-dot');
  if (dot) dot.hidden = true;

  if (banner) {
    banner.hidden = false;
    banner.style.animation = 'none';
    void banner.offsetWidth;
    banner.style.animation = '';
  }
  setStatus(message, kind);

  flashTimer = window.setTimeout(() => {
    flashTimer = 0;
    setStatus('');
    if (banner) banner.hidden = true;
    if (copy) copy.hidden = false;
    if (actions) actions.hidden = false;
  }, FLASH_MS);
}

function clearFlashTimer() {
  if (!flashTimer) return;
  window.clearTimeout(flashTimer);
  flashTimer = 0;
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

function respondErrorMessage(err, action) {
  return mapApiError(err, {
    byCode: {
      [ApiErrorCode.CoachAthleteQuotaFull]: 'coachInviteQuotaFull',
      [ApiErrorCode.NoPendingCoachInvite]:
        action === 'accept' ? 'coachInviteAcceptFail' : 'coachInviteRejectFail',
    },
    fallback: action === 'accept' ? 'coachInviteAcceptFail' : 'coachInviteRejectFail',
  });
}

async function onRespond(action) {
  if (busy || flashTimer) return;
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
    const message = respondErrorMessage(err, action);

    if (action === 'accept') {
      flashBannerMessage(message, 'error');
      return;
    }

    setStatus(message, 'error');
  } finally {
    if (!flashTimer) setBusy(false);
  }
}
