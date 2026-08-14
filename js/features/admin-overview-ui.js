/**
 * Admin — Overview: product health stats.
 * Markup: #admin-overview-view
 * Data: GET /admin/stats
 */
import { getAdminStats } from '../api/admin.js';
import { ui } from '../utils/labels.js';
import { setInlineStatus } from '../utils/dom-status.js';
import { openAdminUsers } from './admin-users-ui.js';
import { isAdmin, setView } from './session-ui.js';

let loadingEl;
let statusEl;
let bodyEl;
let attentionEl;

let totalEl;
let athletesEl;
let coachesEl;
let adminsEl;
let freeEl;
let premiumEl;
let growthEl;
let proEl;
let usersDelta30El;
let activity30El;
let activity7El;
let attentionCopyEl;

/** @type {null | object} */
let lastStats = null;
let loadSeq = 0;

export function initAdminOverviewUi() {
  loadingEl = document.getElementById('admin-overview-loading');
  statusEl = document.getElementById('admin-overview-status');
  bodyEl = document.getElementById('admin-overview-body');
  attentionEl = document.getElementById('admin-overview-attention');

  totalEl = document.getElementById('admin-stat-total');
  athletesEl = document.getElementById('admin-stat-athletes');
  coachesEl = document.getElementById('admin-stat-coaches');
  adminsEl = document.getElementById('admin-stat-admins');
  freeEl = document.getElementById('admin-stat-free');
  premiumEl = document.getElementById('admin-stat-premium');
  growthEl = document.getElementById('admin-stat-growth');
  proEl = document.getElementById('admin-stat-pro');
  usersDelta30El = document.getElementById('admin-stat-users-delta-30');
  activity30El = document.getElementById('admin-stat-activity-30');
  activity7El = document.getElementById('admin-stat-activity-7');
  attentionCopyEl = document.getElementById('admin-stat-attention-copy');

  document.getElementById('admin-overview-open-users')?.addEventListener('click', () => {
    if (!isAdmin()) return;
    openAdminUsers();
    setView('admin-users');
  });
  document.getElementById('admin-overview-open-expiring')?.addEventListener('click', () => {
    if (!isAdmin()) return;
    openAdminUsers({ expiringSoon: true });
    setView('admin-users');
  });

  syncAdminOverviewLabels();
}

export function syncAdminOverviewLabels() {
  document.querySelectorAll('#admin-overview-view [data-ui]').forEach((el) => {
    el.textContent = ui(el.dataset.ui);
  });
  if (lastStats) paintStats(lastStats);
}

export async function refreshAdminOverview() {
  if (!isAdmin()) {
    setLoading(false);
    setBodyVisible(false);
    setStatus('');
    lastStats = null;
    return;
  }

  const seq = ++loadSeq;
  setLoading(true);
  setBodyVisible(false);
  setStatus('');

  try {
    const data = await getAdminStats();
    if (seq !== loadSeq) return;
    lastStats = data;
    paintStats(data);
    setBodyVisible(true);
  } catch (err) {
    console.error(err);
    if (seq !== loadSeq) return;
    lastStats = null;
    setBodyVisible(false);
    setStatus(ui('adminOverviewLoadFail'), 'error');
  } finally {
    if (seq === loadSeq) setLoading(false);
  }
}

function paintStats(data) {
  const byRole = data?.users?.byRole || {};
  const byPlan = data?.subscriptions?.byPlan || {};
  const signups = data?.signups || {};
  const last7 = Number(signups.last7Days) || 0;
  const last30 = Number(signups.last30Days) || 0;
  const expiring = Number(data?.subscriptions?.paidExpiringSoon) || 0;

  setText(totalEl, data?.users?.total);
  setText(athletesEl, byRole.athlete);
  setText(coachesEl, byRole.coach);
  setText(adminsEl, byRole.admin);
  setText(freeEl, byPlan.free);
  setText(premiumEl, byPlan.premium);
  setText(growthEl, byPlan.growth);
  setText(proEl, byPlan.pro);

  if (usersDelta30El) {
    usersDelta30El.textContent = ui('adminUsersDelta30').replace('{n}', String(last30));
  }
  if (activity30El) {
    activity30El.textContent = ui('adminActivity30').replace('{n}', String(last30));
  }
  if (activity7El) {
    activity7El.textContent = ui('adminActivity7').replace('{n}', String(last7));
  }

  if (attentionEl) {
    const show = expiring > 0;
    attentionEl.hidden = !show;
    if (show && attentionCopyEl) {
      const key = expiring === 1
        ? 'adminAttentionExpiringOne'
        : 'adminAttentionExpiringMany';
      attentionCopyEl.textContent = ui(key).replace('{n}', String(expiring));
    }
  }
}

function setText(el, value) {
  if (!el) return;
  el.textContent = value == null ? '—' : String(value);
}

function setLoading(on) {
  if (loadingEl) loadingEl.hidden = !on;
}

function setBodyVisible(on) {
  if (bodyEl) bodyEl.hidden = !on;
}

function setStatus(message, kind = '') {
  setInlineStatus(statusEl, message, kind);
}
