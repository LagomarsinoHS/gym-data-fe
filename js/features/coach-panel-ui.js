/**
 * Coach — Panel: overview metrics (athlete totals).
 * Markup: #coach-panel-view
 * Data: GET /users/coach/athletes (paginated until complete)
 *
 * While loading: show spinner, keep stats hidden (no "—" placeholders).
 */
import { getCoachAthletes } from '../api/users.js';
import { ui } from '../utils/labels.js';
import { isCoach } from './session-ui.js';

const PAGE_LIMIT = 50;

let totalEl;
let withoutPlanEl;
let statsEl;
let statusEl;
let loadingEl;
let loadSeq = 0;

export function initCoachPanelUi() {
  totalEl = document.getElementById('coach-panel-total');
  withoutPlanEl = document.getElementById('coach-panel-without-plan');
  statsEl = document.getElementById('coach-panel-stats');
  statusEl = document.getElementById('coach-panel-status');
  loadingEl = document.getElementById('coach-panel-loading');
  syncCoachPanelLabels();
}

export function syncCoachPanelLabels() {
  document.querySelectorAll('#coach-panel-view [data-ui]').forEach(el => {
    el.textContent = ui(el.dataset.ui);
  });
}

export async function refreshCoachPanel() {
  if (!isCoach()) {
    setLoading(false);
    setStatsVisible(false);
    setStatus('');
    return;
  }

  const seq = ++loadSeq;
  setLoading(true);
  setStatsVisible(false);
  setStatus('');

  try {
    const { total, withoutPlan } = await fetchAthleteStats();
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
