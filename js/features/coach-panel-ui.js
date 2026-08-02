/**
 * Coach — Panel: overview metrics + invite history.
 * Markup: #coach-panel-view
 * Data: GET /users/coach/athletes (stats)
 *       GET /users/coach/invites?status=&page=&limit= (historial filtrable)
 *
 * While loading stats: spinner, keep stats hidden (no "—" placeholders).
 */
import { getCoachAthletes, getCoachInvites } from '../api/users.js';
import { formatDate } from '../utils/dates.js';
import { ui } from '../utils/labels.js';
import { isCoach } from './session-ui.js';

const PAGE_LIMIT = 50;
const INVITES_PAGE_LIMIT = 10;

let totalEl;
let withoutPlanEl;
let statsEl;
let statusEl;
let loadingEl;

let invitesListEl;
let invitesEmptyEl;
let invitesLoadingEl;
let invitesStatusEl;
let invitesMoreBtn;
let invitesFiltersEl;

let loadSeq = 0;
let invitesSeq = 0;
/** @type {'' | 'pending' | 'accepted' | 'rejected' | 'cancelled'} */
let invitesStatusFilter = '';
let invitesPage = 0;
let invitesPages = 0;
let invitesLoading = false;
/** @type {object[]} */
let invitesCache = [];

export function initCoachPanelUi() {
  totalEl = document.getElementById('coach-panel-total');
  withoutPlanEl = document.getElementById('coach-panel-without-plan');
  statsEl = document.getElementById('coach-panel-stats');
  statusEl = document.getElementById('coach-panel-status');
  loadingEl = document.getElementById('coach-panel-loading');

  invitesListEl = document.getElementById('coach-panel-invites-list');
  invitesEmptyEl = document.getElementById('coach-panel-invites-empty');
  invitesLoadingEl = document.getElementById('coach-panel-invites-loading');
  invitesStatusEl = document.getElementById('coach-panel-invites-status');
  invitesMoreBtn = document.getElementById('coach-panel-invites-more');
  invitesFiltersEl = document.getElementById('coach-panel-invites-filters');

  invitesFiltersEl?.addEventListener('click', onInvitesFilterClick);
  invitesMoreBtn?.addEventListener('click', () => void loadCoachInvites({ append: true }));

  syncCoachPanelLabels();
}

export function syncCoachPanelLabels() {
  document.querySelectorAll('#coach-panel-view [data-ui]').forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });
  if (invitesCache.length) renderInvitesList();
}

export async function refreshCoachPanel() {
  if (!isCoach()) {
    setLoading(false);
    setStatsVisible(false);
    setStatus('');
    resetInvitesUi();
    return;
  }

  const seq = ++loadSeq;
  setLoading(true);
  setStatsVisible(false);
  setStatus('');

  const statsPromise = fetchAthleteStats();
  const invitesPromise = loadCoachInvites({ replace: true });

  try {
    const { total, withoutPlan } = await statsPromise;
    if (seq !== loadSeq) return;
    setStats(String(total), String(withoutPlan));
    setStatsVisible(true);
  } catch (err) {
    console.error(err);
    if (seq !== loadSeq) return;
    setStatsVisible(false);
    setStatus(ui('coachPanelLoadFail'), 'error');
  } finally {
    if (seq === loadSeq) setLoading(false);
  }

  await invitesPromise;
}

async function fetchAthleteStats() {
  let page = 1;
  let pages = 1;
  let total = 0;
  let withoutPlan = 0;

  do {
    const payload = await getCoachAthletes({ page, limit: PAGE_LIMIT });
    const items = Array.isArray(payload?.data) ? payload.data : [];
    total = Number(payload?.total) || total;
    pages = Number(payload?.pages) || 1;
    withoutPlan += items.filter(athlete => !athleteHasPlan(athlete)).length;
    page += 1;
  } while (page <= pages);

  return { total, withoutPlan };
}

function athleteHasPlan(athlete) {
  const prog = athlete?.coachTrainingProgram;
  if (!Array.isArray(prog) || prog.length === 0) return false;
  return prog.some(session => Array.isArray(session?.items) && session.items.length > 0);
}

function setStats(total, withoutPlan) {
  if (totalEl) totalEl.textContent = total;
  if (withoutPlanEl) withoutPlanEl.textContent = withoutPlan;
}

function setStatsVisible(show) {
  if (statsEl) statsEl.hidden = !show;
}

function setLoading(show) {
  if (loadingEl) loadingEl.hidden = !show;
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

// ── Invites history ───────────────────────────────────────────────────

function onInvitesFilterClick(e) {
  const btn = e.target.closest('[data-status]');
  if (!btn || !invitesFiltersEl?.contains(btn)) return;
  const next = btn.dataset.status || '';
  if (next === invitesStatusFilter) return;
  invitesStatusFilter = next;
  syncInvitesFilterUi();
  void loadCoachInvites({ replace: true });
}

function syncInvitesFilterUi() {
  invitesFiltersEl?.querySelectorAll('[data-status]').forEach(btn => {
    const active = (btn.dataset.status || '') === invitesStatusFilter;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
}

function resetInvitesUi() {
  invitesCache = [];
  invitesPage = 0;
  invitesPages = 0;
  invitesStatusFilter = '';
  syncInvitesFilterUi();
  if (invitesListEl) {
    invitesListEl.replaceChildren();
    invitesListEl.hidden = true;
  }
  if (invitesEmptyEl) invitesEmptyEl.hidden = true;
  if (invitesMoreBtn) invitesMoreBtn.hidden = true;
  setInvitesLoading(false);
  setInvitesStatus('');
}

async function loadCoachInvites({ replace = false, append = false } = {}) {
  if (!isCoach()) {
    resetInvitesUi();
    return;
  }
  if (invitesLoading) return;
  if (append && (invitesPage >= invitesPages || invitesPages === 0)) return;

  const seq = ++invitesSeq;
  const page = append ? invitesPage + 1 : 1;
  invitesLoading = true;
  setInvitesStatus('');
  setInvitesLoading(true);
  if (replace && invitesMoreBtn) invitesMoreBtn.hidden = true;

  try {
    const payload = await getCoachInvites({
      page,
      limit: INVITES_PAGE_LIMIT,
      status: invitesStatusFilter || undefined,
    });
    if (seq !== invitesSeq) return;

    const items = Array.isArray(payload?.data) ? payload.data : [];
    invitesPage = Number(payload?.page) || page;
    invitesPages = Number(payload?.pages) || 0;
    invitesCache = append ? invitesCache.concat(items) : items;
    renderInvitesList();
  } catch (err) {
    console.error(err);
    if (seq !== invitesSeq) return;
    if (!append) {
      invitesCache = [];
      renderInvitesList();
    }
    setInvitesStatus(ui('coachPanelInvitesLoadFail'), 'error');
  } finally {
    if (seq === invitesSeq) {
      invitesLoading = false;
      setInvitesLoading(false);
      syncInvitesMoreBtn();
    }
  }
}

function renderInvitesList() {
  if (!invitesListEl || !invitesEmptyEl) return;

  const has = invitesCache.length > 0;
  invitesEmptyEl.hidden = has;
  invitesListEl.hidden = !has;
  invitesListEl.replaceChildren();

  if (!has) {
    invitesEmptyEl.textContent = ui(
      invitesStatusFilter ? 'coachPanelInvitesEmptyFilter' : 'coachPanelInvitesEmpty',
    );
    syncInvitesMoreBtn();
    return;
  }

  const frag = document.createDocumentFragment();
  for (const invite of invitesCache) {
    frag.appendChild(createInviteRow(invite));
  }
  invitesListEl.appendChild(frag);
  syncInvitesMoreBtn();
}

function createInviteRow(invite) {
  const li = document.createElement('li');
  li.className = 'coach-panel-invite';
  li.dataset.status = invite.status || '';

  const athlete = invite.athlete || {};
  const name = [athlete.firstName, athlete.lastName].filter(Boolean).join(' ').trim();
  const title = name || invite.email || '—';

  const top = document.createElement('div');
  top.className = 'coach-panel-invite-top';

  const main = document.createElement('div');
  main.className = 'coach-panel-invite-main';

  const titleEl = document.createElement('p');
  titleEl.className = 'coach-panel-invite-title';
  titleEl.textContent = title;

  const emailEl = document.createElement('p');
  emailEl.className = 'coach-panel-invite-email';
  emailEl.textContent = invite.email || '';

  main.append(titleEl);
  if (name && invite.email) main.append(emailEl);

  const statusEl = document.createElement('span');
  statusEl.className = `coach-panel-invite-status-pill is-${invite.status || 'pending'}`;
  statusEl.textContent = inviteStatusLabel(invite.status);

  top.append(main, statusEl);

  const dates = document.createElement('div');
  dates.className = 'coach-panel-invite-dates';
  dates.append(createInviteDate(ui('coachPanelInvitesInvitedAt'), invite.invitedAt));
  if (invite.respondedAt) {
    dates.append(createInviteDate(ui('coachPanelInvitesRespondedAt'), invite.respondedAt));
  }

  li.append(top, dates);
  return li;
}

function createInviteDate(label, value) {
  const wrap = document.createElement('div');
  wrap.className = 'coach-panel-invite-date';

  const labelEl = document.createElement('span');
  labelEl.className = 'coach-panel-invite-date-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'coach-panel-invite-date-value';
  valueEl.textContent = formatDate(value);

  wrap.append(labelEl, valueEl);
  return wrap;
}

function inviteStatusLabel(status) {
  switch (status) {
    case 'accepted':
      return ui('coachPanelInvitesStatusAccepted');
    case 'rejected':
      return ui('coachPanelInvitesStatusRejected');
    case 'cancelled':
      return ui('coachPanelInvitesStatusCancelled');
    case 'pending':
    default:
      return ui('coachPanelInvitesStatusPending');
  }
}

function syncInvitesMoreBtn() {
  if (!invitesMoreBtn) return;
  const show = invitesCache.length > 0 && invitesPage < invitesPages;
  invitesMoreBtn.hidden = !show;
  invitesMoreBtn.disabled = invitesLoading;
}

function setInvitesLoading(show) {
  if (invitesLoadingEl) invitesLoadingEl.hidden = !show;
}

function setInvitesStatus(message, kind = '') {
  if (!invitesStatusEl) return;
  if (!message) {
    invitesStatusEl.hidden = true;
    invitesStatusEl.textContent = '';
    invitesStatusEl.classList.remove('is-error');
    return;
  }
  invitesStatusEl.hidden = false;
  invitesStatusEl.textContent = message;
  invitesStatusEl.classList.toggle('is-error', kind === 'error');
}
