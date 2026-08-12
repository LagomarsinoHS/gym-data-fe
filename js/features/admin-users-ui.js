/**
 * Admin — Users: list, search, filters, accordion, grant/revoke.
 * Markup: #admin-users-view
 * Data: GET /admin/users · POST /admin/subscriptions/grant|revoke
 */
import {
  getAdminUsers,
  grantAdminSubscription,
  revokeAdminSubscription,
  softDeleteAdminUser,
} from '../api/admin.js';
import { formatDate } from '../utils/dates.js';
import { userProfile } from '../utils/helpers.js';
import { ui } from '../utils/labels.js';
import { getUser, isAdmin } from './session-ui.js';

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 280;

let searchInput;
let searchClearBtn;
let roleFilter;
let planFilter;
let sortFilter;
let expiringFilter;
let loadingEl;
let emptyEl;
let statusEl;
let listEl;
let loadMoreBtn;
let metaEl;

let searchTimer = 0;
let loadSeq = 0;
let openUserId = null;

/** @type {null | {
 *   kind: 'grant' | 'revoke' | 'delete',
 *   user: object,
 *   plan?: string,
 *   durationDays?: number,
 *   els: object,
 * }} */
let pendingSubAction = null;

let confirmOverlay;
let confirmTitleEl;
let confirmUserEl;
let confirmLeadEl;
let confirmBtn;

const state = {
  users: [],
  page: 1,
  total: 0,
  hasMore: false,
  loading: false,
  searchQuery: '',
  role: '',
  plan: '',
  sortBy: 'lastLoginAt',
  sortDir: 'desc',
  expiringSoon: false,
};

/** Optional seed filters when navigating from Overview shortcuts. */
let pendingFilters = null;

export function initAdminUsersUi() {
  searchInput = document.getElementById('admin-users-search');
  searchClearBtn = document.getElementById('admin-users-search-clear');
  roleFilter = document.getElementById('admin-users-filter-role');
  planFilter = document.getElementById('admin-users-filter-plan');
  sortFilter = document.getElementById('admin-users-filter-sort');
  expiringFilter = document.getElementById('admin-users-filter-expiring');
  loadingEl = document.getElementById('admin-users-loading');
  emptyEl = document.getElementById('admin-users-empty');
  statusEl = document.getElementById('admin-users-status');
  listEl = document.getElementById('admin-users-list');
  loadMoreBtn = document.getElementById('admin-users-load-more');
  metaEl = document.getElementById('admin-users-meta');

  confirmOverlay = document.getElementById('admin-sub-confirm-overlay');
  confirmTitleEl = document.getElementById('admin-sub-confirm-title');
  confirmUserEl = document.getElementById('admin-sub-confirm-user');
  confirmLeadEl = document.getElementById('admin-sub-confirm-lead');
  confirmBtn = document.getElementById('admin-sub-confirm-btn');

  searchInput?.addEventListener('input', onSearchInput);
  searchClearBtn?.addEventListener('click', clearSearch);
  roleFilter?.addEventListener('change', onFiltersChanged);
  planFilter?.addEventListener('change', onFiltersChanged);
  sortFilter?.addEventListener('change', onFiltersChanged);
  expiringFilter?.addEventListener('change', onFiltersChanged);
  loadMoreBtn?.addEventListener('click', () => void loadUsers({ append: true }));

  document.getElementById('admin-sub-confirm-close')?.addEventListener('click', closeSubConfirmModal);
  document.getElementById('admin-sub-confirm-cancel')?.addEventListener('click', closeSubConfirmModal);
  confirmBtn?.addEventListener('click', () => void confirmSubAction());
  confirmOverlay?.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) closeSubConfirmModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!confirmOverlay?.classList.contains('open')) return;
    e.stopImmediatePropagation();
    closeSubConfirmModal();
  });

  syncAdminUsersLabels();
}

export function syncAdminUsersLabels() {
  document.querySelectorAll(
    '#admin-users-view [data-ui], #admin-sub-confirm-overlay [data-ui]',
  ).forEach((el) => {
    el.textContent = ui(el.dataset.ui);
  });
  if (searchInput) searchInput.placeholder = ui('adminUsersSearch');
  if (pendingSubAction) syncSubConfirmCopy(pendingSubAction);
  syncMeta();
  syncEmptyCopy();
  // Rows / badges / actions are built in JS — rebuild so lang switch sticks.
  renderList();
}

/**
 * Jump into Usuarios with optional filters (e.g. from Overview).
 * @param {{ role?: string, plan?: string, expiringSoon?: boolean, search?: string }} [filters]
 */
export function openAdminUsers(filters = {}) {
  pendingFilters = { ...filters };
}

export async function refreshAdminUsers() {
  if (!isAdmin()) {
    resetState();
    renderList();
    return;
  }

  applyPendingFilters();
  syncFilterControls();
  await loadUsers({ reset: true });
}

function applyPendingFilters() {
  if (!pendingFilters) return;
  const next = pendingFilters;
  pendingFilters = null;

  if (typeof next.search === 'string') {
    state.searchQuery = next.search.trim();
    if (searchInput) searchInput.value = state.searchQuery;
  }
  if (typeof next.role === 'string') state.role = next.role;
  if (typeof next.plan === 'string') state.plan = next.plan;
  if (typeof next.expiringSoon === 'boolean') {
    state.expiringSoon = next.expiringSoon;
  }
}

function syncFilterControls() {
  if (roleFilter) roleFilter.value = state.role || '';
  if (planFilter) planFilter.value = state.plan || '';
  if (sortFilter) {
    sortFilter.value = `${state.sortBy || 'lastLoginAt'}:${state.sortDir || 'desc'}`;
  }
  if (expiringFilter) expiringFilter.checked = state.expiringSoon;
  searchClearBtn?.classList.toggle('visible', Boolean(searchInput?.value));
}

function resetState() {
  state.users = [];
  state.page = 1;
  state.total = 0;
  state.hasMore = false;
  state.loading = false;
  state.searchQuery = '';
  state.role = '';
  state.plan = '';
  state.sortBy = 'lastLoginAt';
  state.sortDir = 'desc';
  state.expiringSoon = false;
  openUserId = null;
}

async function loadUsers({ reset = false, append = false } = {}) {
  if (!isAdmin()) return;
  if (state.loading) return;

  const seq = ++loadSeq;
  const page = append ? state.page + 1 : 1;

  if (reset || !append) {
    state.page = 1;
    openUserId = null;
  }

  state.loading = true;
  setLoading(!append && state.users.length === 0);
  if (!append) setStatus('');
  syncLoadMore();

  try {
    const params = {
      page,
      limit: PAGE_SIZE,
      search: state.searchQuery || undefined,
      role: state.role || undefined,
      plan: state.plan || undefined,
      expiringSoon: state.expiringSoon || undefined,
      sortBy: state.sortBy || 'lastLoginAt',
      sortDir: state.sortDir || 'desc',
    };
    const payload = await getAdminUsers(params);
    if (seq !== loadSeq) return;

    const rows = Array.isArray(payload?.data) ? payload.data : [];
    const total = Number(payload?.total) || 0;
    const currentPage = Number(payload?.page) || page;
    const pages = Number(payload?.pages) || 0;

    state.users = append ? [...state.users, ...rows] : rows;
    state.page = currentPage;
    state.total = total;
    state.hasMore = pages > 0 ? currentPage < pages : state.users.length < total;
  } catch (err) {
    console.error(err);
    if (seq !== loadSeq) return;
    if (!append) {
      state.users = [];
      state.total = 0;
      state.hasMore = false;
    }
    setStatus(ui('adminUsersLoadFail'), 'error');
  } finally {
    if (seq === loadSeq) {
      state.loading = false;
      setLoading(false);
      renderList();
    }
  }
}

function onSearchInput() {
  searchClearBtn?.classList.toggle('visible', Boolean(searchInput?.value));
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    const next = searchInput?.value.trim() ?? '';
    if (next === state.searchQuery) return;
    state.searchQuery = next;
    void loadUsers({ reset: true });
  }, SEARCH_DEBOUNCE_MS);
}

function clearSearch() {
  if (!searchInput) return;
  searchInput.value = '';
  searchClearBtn?.classList.remove('visible');
  if (!state.searchQuery) return;
  state.searchQuery = '';
  void loadUsers({ reset: true });
}

function onFiltersChanged() {
  state.role = roleFilter?.value || '';
  state.plan = planFilter?.value || '';
  state.expiringSoon = Boolean(expiringFilter?.checked);
  const sort = parseSortValue(sortFilter?.value);
  state.sortBy = sort.sortBy;
  state.sortDir = sort.sortDir;
  void loadUsers({ reset: true });
}

function parseSortValue(raw) {
  const value = String(raw || 'lastLoginAt:desc');
  const [sortBy, sortDir] = value.split(':');
  return {
    sortBy: sortBy === 'createdAt' ? 'createdAt' : 'lastLoginAt',
    sortDir: sortDir === 'asc' ? 'asc' : 'desc',
  };
}

function renderList() {
  if (!listEl || !emptyEl) return;

  const has = state.users.length > 0;
  emptyEl.hidden = has;
  listEl.hidden = !has;
  listEl.replaceChildren();
  syncEmptyCopy();
  syncMeta();
  syncLoadMore();

  if (!has) return;

  const frag = document.createDocumentFragment();
  for (const user of state.users) {
    frag.appendChild(createUserRow(user));
  }
  listEl.appendChild(frag);
}

function syncEmptyCopy() {
  if (!emptyEl) return;
  const title = emptyEl.querySelector('.admin-users-empty-title');
  const lead = emptyEl.querySelector('.admin-users-empty-lead');
  const searching = Boolean(state.searchQuery || state.role || state.plan || state.expiringSoon);
  if (title) {
    title.dataset.ui = searching ? 'adminUsersSearchEmptyTitle' : 'adminUsersEmptyTitle';
    title.textContent = ui(title.dataset.ui);
  }
  if (lead) {
    lead.dataset.ui = searching ? 'adminUsersSearchEmptyLead' : 'adminUsersEmptyLead';
    lead.textContent = ui(lead.dataset.ui);
  }
}

function syncMeta() {
  if (!metaEl) return;
  if (!state.users.length && !state.total) {
    metaEl.hidden = true;
    metaEl.textContent = '';
    return;
  }
  metaEl.hidden = false;
  metaEl.textContent = ui('adminUsersMeta')
    .replace('{shown}', String(state.users.length))
    .replace('{total}', String(state.total));
}

function syncLoadMore() {
  if (!loadMoreBtn) return;
  const show = state.users.length > 0 && state.hasMore;
  loadMoreBtn.hidden = !show;
  loadMoreBtn.disabled = state.loading;
}

function setLoading(on) {
  if (loadingEl) loadingEl.hidden = !on;
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

function createUserRow(user) {
  const id = String(user?.id || '');
  const profile = userProfile(user);
  const first = String(profile.firstName || '').trim();
  const last = String(profile.lastName || '').trim();
  const email = String(user?.email || '').trim();
  const full = [first, last].filter(Boolean).join(' ') || email || '—';
  const plan = String(user?.subscription?.plan || 'free');
  const role = String(user?.role || 'athlete');

  const row = document.createElement('div');
  row.className = 'student-row admin-user-row';
  if (id) row.dataset.id = id;
  row.dataset.email = email;

  const header = document.createElement('div');
  header.className = 'student-row-header admin-user-header';

  const expandBtn = document.createElement('button');
  expandBtn.type = 'button';
  expandBtn.className = 'admin-user-expand';
  expandBtn.setAttribute('aria-expanded', 'false');

  const avatar = document.createElement('span');
  avatar.className = 'student-row-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent =
    `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    || email.charAt(0).toUpperCase()
    || '?';

  const meta = document.createElement('span');
  meta.className = 'student-row-meta';

  const nameRow = document.createElement('span');
  nameRow.className = 'student-row-name-row';

  const nameEl = document.createElement('span');
  nameEl.className = 'student-row-name';
  nameEl.textContent = full;
  nameRow.append(nameEl);

  const badges = document.createElement('span');
  badges.className = 'admin-user-badges';
  badges.append(
    makeBadge(formatRole(role), 'role'),
    makeBadge(formatPlan(plan), plan === 'free' ? 'plan-free' : 'plan-paid'),
  );
  nameRow.append(badges);

  const subline = document.createElement('span');
  subline.className = 'admin-user-subline';
  subline.textContent = email || '—';

  meta.append(nameRow, subline);

  const chevron = document.createElement('span');
  chevron.className = 'student-row-chevron';
  chevron.setAttribute('aria-hidden', 'true');

  expandBtn.append(avatar, meta, chevron);
  expandBtn.addEventListener('click', () => toggleRow(row));
  header.append(expandBtn);

  const isSelf = String(getUser()?.id || '') === id;
  let deleteBtn = null;
  if (!isSelf) {
    deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'admin-user-delete-btn';
    deleteBtn.textContent = ui('adminUsersDelete');
    deleteBtn.setAttribute('aria-label', ui('adminUsersDelete'));
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openSubConfirmModal({
        kind: 'delete',
        user,
        els: { deleteBtn, row },
      });
    });
    header.append(deleteBtn);
  }

  const body = document.createElement('div');
  body.className = 'student-row-body';
  body.append(createUserDetailPanel(user), createSubscriptionActions(user, row));

  row.append(header, body);

  if (openUserId && openUserId === id) openRow(row);

  return row;
}

function createUserDetailPanel(user) {
  const profile = userProfile(user);
  const first = String(profile.firstName || '').trim() || '—';
  const last = String(profile.lastName || '').trim() || '—';
  const plan = String(user?.subscription?.plan || 'free');
  const role = String(user?.role || 'athlete');
  const panel = document.createElement('div');
  panel.className = 'admin-user-panel';

  const summary = document.createElement('div');
  summary.className = 'admin-user-summary-grid';

  summary.append(
    createInfoCard({
      icon: 'calendar',
      title: ui('adminUsersCardAccount'),
      lines: [
        `${ui('adminUsersCreated')}: ${formatDate(user?.createdAt)}`,
        `${ui('adminUsersLastLogin')}: ${formatDate(user?.lastLoginAt)}`,
      ],
    }),
    createInfoCard({
      icon: 'calendar',
      title: ui('adminUsersCardSubscription'),
      lines: [
        `${ui('adminUsersStarted')}: ${formatDate(user?.subscription?.startedAt)}`,
        `${ui('adminUsersExpires')}: ${formatDate(user?.subscription?.expiresAt)}`,
      ],
      footer: createSubscriptionProgress(user?.subscription),
    }),
    createInfoCard({
      icon: 'person',
      title: ui('adminUsersCardRolePlan'),
      lines: [`${formatRole(role)} - ${formatPlan(plan)}`],
    }),
    createInfoCard({
      icon: 'person',
      title: ui('adminUsersCardCoach'),
      lines: [formatCoachDisplay(user)],
    }),
  );

  const profileCard = document.createElement('div');
  profileCard.className = 'admin-user-profile-card';

  const profileTitle = document.createElement('h4');
  profileTitle.className = 'admin-user-profile-title';
  profileTitle.textContent = profileSectionTitle(role);
  profileCard.append(profileTitle);

  const profileGrid = document.createElement('div');
  profileGrid.className = 'admin-user-profile-grid';
  profileGrid.append(
    createProfileFact('person', ui('firstName'), first),
    createProfileFact('ruler', ui('adminUsersHeight'), profile.heightCm != null ? `${profile.heightCm} cm` : '—'),
    createProfileFact('person', ui('lastName'), last),
    createProfileFact('goal', ui('adminUsersGoal'), formatGoal(user?.goal) || '—'),
    createProfileFact('sex', ui('adminUsersSex'), formatSex(profile.sex)),
    createProfileFact('calendar', ui('adminUsersBirth'), formatDate(profile.birthDate)),
  );
  profileCard.append(profileGrid);

  panel.append(summary, profileCard);
  return panel;
}

function profileSectionTitle(role) {
  switch (String(role || '')) {
    case 'coach':
      return ui('adminUsersProfileCoach');
    case 'admin':
      return ui('adminUsersProfileAdmin');
    default:
      return ui('adminUsersProfileAthlete');
  }
}

/** Prefer display name from API when present; otherwise em dash (not raw coachId). */
function formatCoachDisplay(user) {
  const direct = String(user?.coachName || '').trim();
  if (direct) return direct;
  const profile = user?.coach?.profile || user?.coachProfile;
  if (profile) {
    const name = [profile.firstName, profile.lastName].map((p) => String(p || '').trim()).filter(Boolean).join(' ');
    if (name) return name;
  }
  return '—';
}

function createInfoCard({ icon, title, lines, footer = null }) {
  const card = document.createElement('div');
  card.className = 'admin-user-info-card';

  const iconEl = document.createElement('span');
  iconEl.className = 'admin-user-info-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.innerHTML = adminIconSvg(icon);

  const content = document.createElement('div');
  content.className = 'admin-user-info-content';

  const titleEl = document.createElement('p');
  titleEl.className = 'admin-user-info-title';
  titleEl.textContent = title;

  const body = document.createElement('div');
  body.className = 'admin-user-info-lines';
  for (const line of lines) {
    const p = document.createElement('p');
    p.textContent = line;
    body.append(p);
  }

  content.append(titleEl, body);
  if (footer) content.append(footer);
  card.append(iconEl, content);
  return card;
}

/** Remaining start→expires; full+green early, empty+red near end. Empty if no period. */
function createSubscriptionProgress(subscription) {
  const startMs = toTimeMs(subscription?.startedAt);
  const endMs = toTimeMs(subscription?.expiresAt);
  const hasPeriod = startMs != null && endMs != null && endMs > startMs;
  const remaining = hasPeriod ? (subscriptionRemainingProgress(subscription) ?? 0) : 0;
  const pct = Math.round(remaining * 10) / 10;
  const displayPct =
    hasPeriod && remaining > 0 && remaining < 3 ? Math.max(remaining, 3) : pct;

  const wrap = document.createElement('div');
  wrap.className = 'admin-sub-progress';
  wrap.setAttribute('role', 'progressbar');
  wrap.setAttribute('aria-valuemin', '0');
  wrap.setAttribute('aria-valuemax', '100');
  wrap.setAttribute('aria-valuenow', String(Math.round(pct)));
  wrap.setAttribute('aria-label', ui('adminUsersSubProgress'));

  const track = document.createElement('div');
  track.className = 'admin-sub-progress-track';

  const fill = document.createElement('div');
  fill.className = 'admin-sub-progress-fill';
  fill.style.width = hasPeriod ? `${displayPct}%` : '0%';
  if (hasPeriod) {
    const color = remainingFillColor(pct);
    fill.style.background = color;
    fill.style.boxShadow = `0 0 10px color-mix(in srgb, ${color} 40%, transparent)`;
  }

  const meta = document.createElement('p');
  meta.className = 'admin-sub-progress-meta';
  meta.textContent = subscriptionProgressLabel({ hasPeriod, pct, startMs, endMs });

  track.append(fill);
  wrap.append(track, meta);
  return wrap;
}

function subscriptionProgressLabel({ hasPeriod, pct, startMs, endMs }) {
  if (!hasPeriod) return ui('adminUsersSubNoPeriod');

  const now = Date.now();
  if (now >= endMs) return `0% · ${ui('adminUsersSubExpired')}`;

  if (now < startMs) {
    const daysUntilStart = Math.max(1, Math.ceil((startMs - now) / 86_400_000));
    const startsText =
      daysUntilStart === 1
        ? ui('adminUsersSubStartsInOne')
        : ui('adminUsersSubStartsInMany').replace('{n}', String(daysUntilStart));
    return `100% · ${startsText}`;
  }

  const daysLeft = Math.max(0, Math.ceil((endMs - now) / 86_400_000));
  const daysText =
    daysLeft === 1
      ? ui('adminUsersSubDaysLeftOne')
      : ui('adminUsersSubDaysLeftMany').replace('{n}', String(daysLeft));

  return `${Math.round(pct)}% · ${daysText}`;
}

/**
 * @returns {number|null} 0–100 remaining percent from now to expiresAt (within startedAt→expiresAt)
 */
function subscriptionRemainingProgress(subscription) {
  const startMs = toTimeMs(subscription?.startedAt);
  const endMs = toTimeMs(subscription?.expiresAt);
  if (startMs == null || endMs == null || endMs <= startMs) return null;

  const now = Date.now();
  if (now <= startMs) return 100;
  if (now >= endMs) return 0;
  return ((endMs - now) / (endMs - startMs)) * 100;
}

/** Green (100% left) → yellow (50%) → red (0%). */
function remainingFillColor(remainingPct) {
  const t = Math.max(0, Math.min(1, 1 - remainingPct / 100));
  const green = [61, 186, 106];
  const yellow = [230, 200, 74];
  const red = [227, 93, 79];
  const from = t < 0.5 ? green : yellow;
  const to = t < 0.5 ? yellow : red;
  const local = t < 0.5 ? t * 2 : (t - 0.5) * 2;
  const rgb = from.map((c, i) => Math.round(c + (to[i] - c) * local));
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}

function toTimeMs(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  return Number.isNaN(ms) ? null : ms;
}

function createProfileFact(icon, label, value) {
  const row = document.createElement('div');
  row.className = 'admin-user-profile-fact';

  const iconEl = document.createElement('span');
  iconEl.className = 'admin-user-profile-fact-icon';
  iconEl.setAttribute('aria-hidden', 'true');
  iconEl.innerHTML = adminIconSvg(icon);

  const text = document.createElement('div');
  text.className = 'admin-user-profile-fact-text';

  const labelEl = document.createElement('span');
  labelEl.className = 'admin-user-profile-fact-label';
  labelEl.textContent = label;

  const valueEl = document.createElement('span');
  valueEl.className = 'admin-user-profile-fact-value';
  valueEl.textContent = value || '—';

  text.append(labelEl, valueEl);
  row.append(iconEl, text);
  return row;
}

function adminIconSvg(kind) {
  switch (kind) {
    case 'calendar':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M8 3.5v3M16 3.5v3M3.5 10h17"/></svg>`;
    case 'person':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 19.5c1.6-3.2 4-4.8 6.5-4.8s4.9 1.6 6.5 4.8"/></svg>`;
    case 'ruler':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 16.5 16.5 4a2.1 2.1 0 0 1 3 3L7 19.5a2.1 2.1 0 0 1-3-3Z"/><path d="m8.5 9.5 1.5 1.5M11 7l1.5 1.5M13.5 4.5 15 6"/></svg>`;
    case 'goal':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>`;
    case 'sex':
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="4.5"/><path d="M13.5 6.5 19 1.9M16.2 2h2.8v2.8"/></svg>`;
    default:
      return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="8"/></svg>`;
  }
}

function createSubscriptionActions(user, row) {
  const role = String(user?.role || 'athlete');
  const wrap = document.createElement('div');
  wrap.className = 'admin-user-actions';

  if (role === 'admin') {
    const note = document.createElement('p');
    note.className = 'admin-user-actions-note';
    note.textContent = ui('adminUsersSubN_A');
    wrap.append(note);
    return wrap;
  }

  const grantablePlans = grantablePlansForRole(role);
  if (grantablePlans.length === 0) return wrap;

  const title = document.createElement('p');
  title.className = 'admin-user-actions-title';
  title.textContent = ui('adminUsersSubActions');
  wrap.append(title);

  const form = document.createElement('div');
  form.className = 'admin-user-grant';

  const planSelect = document.createElement('select');
  planSelect.className = 'admin-users-select';
  planSelect.setAttribute('aria-label', ui('adminUsersGrantPlan'));
  for (const plan of grantablePlans) {
    const opt = document.createElement('option');
    opt.value = plan;
    opt.textContent = formatPlan(plan);
    planSelect.append(opt);
  }
  const current = String(user?.subscription?.plan || 'free');
  if (grantablePlans.includes(current)) {
    planSelect.value = current;
  }

  const daysInput = document.createElement('input');
  daysInput.type = 'number';
  daysInput.min = '1';
  daysInput.max = '3650';
  daysInput.value = '5';
  daysInput.className = 'admin-users-input';
  daysInput.setAttribute('aria-label', ui('adminUsersDurationDays'));

  const grantBtn = document.createElement('button');
  grantBtn.type = 'button';
  grantBtn.className = 'recommend-again-btn';
  grantBtn.textContent = ui('adminUsersGrant');

  const revokeBtn = document.createElement('button');
  revokeBtn.type = 'button';
  revokeBtn.className = 'admin-user-revoke-btn';
  revokeBtn.textContent = ui('adminUsersRevoke');
  revokeBtn.hidden = current === 'free';

  const actionStatus = document.createElement('p');
  actionStatus.className = 'admin-user-action-status';
  actionStatus.hidden = true;

  const els = { grantBtn, revokeBtn, actionStatus, row };

  grantBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSubConfirmModal({
      kind: 'grant',
      user,
      plan: planSelect.value,
      durationDays: Number(daysInput.value),
      els,
    });
  });

  revokeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    openSubConfirmModal({
      kind: 'revoke',
      user,
      els,
    });
  });

  form.append(planSelect, daysInput, grantBtn, revokeBtn);
  wrap.append(form, actionStatus);
  return wrap;
}

/** Plans an admin may grant, per target role. */
function grantablePlansForRole(role) {
  switch (String(role || '')) {
    case 'athlete':
      return ['premium'];
    case 'coach':
      return ['growth', 'pro'];
    default:
      return [];
  }
}

function openSubConfirmModal(action) {
  if (!confirmOverlay) return;
  pendingSubAction = action;
  syncSubConfirmCopy(action);
  confirmOverlay.classList.add('open');
  confirmBtn?.focus();
}

function closeSubConfirmModal() {
  pendingSubAction = null;
  confirmOverlay?.classList.remove('open');
  if (confirmBtn) confirmBtn.disabled = false;
}

function syncSubConfirmCopy(action) {
  const profile = userProfile(action.user);
  const first = String(profile.firstName || '').trim();
  const last = String(profile.lastName || '').trim();
  const email = String(action.user?.email || '').trim();
  const full = [first, last].filter(Boolean).join(' ') || email || '—';

  if (action.kind === 'delete') {
    if (confirmTitleEl) {
      const nameEl = document.createElement('span');
      nameEl.className = 'confirm-modal-name';
      nameEl.textContent = full;
      const template = ui('adminUsersDeleteTitle');
      const parts = template.split('{name}');
      confirmTitleEl.dataset.ui = 'adminUsersDeleteTitle';
      confirmTitleEl.replaceChildren(
        document.createTextNode(parts[0] ?? ''),
        nameEl,
        document.createTextNode(parts[1] ?? ''),
      );
    }
    if (confirmUserEl) {
      confirmUserEl.hidden = true;
      confirmUserEl.textContent = '';
    }
    if (confirmLeadEl) {
      confirmLeadEl.hidden = true;
      confirmLeadEl.textContent = '';
    }
    if (confirmBtn) {
      confirmBtn.dataset.ui = 'adminUsersDelete';
      confirmBtn.textContent = ui('adminUsersDelete');
      confirmBtn.classList.remove('confirm-modal-primary');
      confirmBtn.classList.add('confirm-modal-danger');
    }
    return;
  }

  if (confirmUserEl) {
    confirmUserEl.hidden = false;
    confirmUserEl.textContent = full;
  }
  if (confirmLeadEl) confirmLeadEl.hidden = false;

  if (action.kind === 'grant') {
    const days = Number.isFinite(action.durationDays) && action.durationDays >= 1
      ? action.durationDays
      : 30;
    const planLabel = formatPlan(action.plan);
    const expiryMs = action.user?.subscription?.expiresAt
      ? new Date(action.user.subscription.expiresAt).getTime()
      : NaN;
    const plan = String(action.user?.subscription?.plan || 'free');
    const isActivePaid =
      (plan === 'premium' || plan === 'growth' || plan === 'pro')
      && Number.isFinite(expiryMs)
      && expiryMs > Date.now();

    if (confirmTitleEl) {
      confirmTitleEl.dataset.ui = 'adminUsersGrantTitle';
      confirmTitleEl.textContent = ui('adminUsersGrantTitle');
    }
    if (confirmLeadEl) {
      let key;
      if (isActivePaid) {
        key = days === 1
          ? 'adminUsersGrantConfirmExtendOne'
          : 'adminUsersGrantConfirmExtendMany';
      } else {
        key = days === 1
          ? 'adminUsersGrantConfirmOne'
          : 'adminUsersGrantConfirmMany';
      }
      confirmLeadEl.textContent = ui(key)
        .replace('{plan}', planLabel)
        .replace('{days}', String(days));
    }
    if (confirmBtn) {
      confirmBtn.dataset.ui = 'adminUsersGrant';
      confirmBtn.textContent = ui('adminUsersGrant');
      confirmBtn.classList.remove('confirm-modal-danger');
      confirmBtn.classList.add('confirm-modal-primary');
    }
    return;
  }

  if (confirmTitleEl) {
    confirmTitleEl.dataset.ui = 'adminUsersRevokeTitle';
    confirmTitleEl.textContent = ui('adminUsersRevokeTitle');
  }
  if (confirmLeadEl) {
    confirmLeadEl.dataset.ui = 'adminUsersRevokeConfirm';
    confirmLeadEl.textContent = ui('adminUsersRevokeConfirm');
  }
  if (confirmBtn) {
    confirmBtn.dataset.ui = 'adminUsersRevoke';
    confirmBtn.textContent = ui('adminUsersRevoke');
    confirmBtn.classList.remove('confirm-modal-primary');
    confirmBtn.classList.add('confirm-modal-danger');
  }
}

async function confirmSubAction() {
  const action = pendingSubAction;
  if (!action) return;

  if (confirmBtn) confirmBtn.disabled = true;

  if (action.kind === 'grant') {
    await runGrant(action.user, action.plan, action.durationDays, action.els);
  } else if (action.kind === 'delete') {
    await runDelete(action.user, action.els);
  } else {
    await runRevoke(action.user, action.els);
  }

  closeSubConfirmModal();
}

async function runGrant(user, plan, durationDays, els) {
  const email = String(user?.email || '').trim();
  if (!email || !plan) return;

  const days = Number.isFinite(durationDays) && durationDays >= 1 ? durationDays : 30;
  setActionBusy(els, true);
  setRowActionStatus(els.actionStatus, '');

  try {
    const updated = await grantAdminSubscription({
      email,
      plan,
      durationDays: days,
    });
    patchUserInState(user.id, updated);
    setRowActionStatus(els.actionStatus, ui('adminUsersGrantOk'), 'ok');
    renderList();
  } catch (err) {
    console.error(err);
    setRowActionStatus(els.actionStatus, ui('adminUsersGrantFail'), 'error');
    setActionBusy(els, false);
  }
}

async function runRevoke(user, els) {
  const email = String(user?.email || '').trim();
  if (!email) return;

  setActionBusy(els, true);
  setRowActionStatus(els.actionStatus, '');

  try {
    const updated = await revokeAdminSubscription({ email });
    patchUserInState(user.id, updated);
    setRowActionStatus(els.actionStatus, ui('adminUsersRevokeOk'), 'ok');
    renderList();
  } catch (err) {
    console.error(err);
    setRowActionStatus(els.actionStatus, ui('adminUsersRevokeFail'), 'error');
    setActionBusy(els, false);
  }
}

async function runDelete(user, els) {
  const id = String(user?.id || '').trim();
  if (!id) return;

  setActionBusy(els, true);
  setRowActionStatus(els.actionStatus, '');

  try {
    await softDeleteAdminUser(id);
    removeUserFromState(id);
    setStatus(ui('adminUsersDeleteOk'), 'ok');
    renderList();
  } catch (err) {
    console.error(err);
    setRowActionStatus(els.actionStatus, ui('adminUsersDeleteFail'), 'error');
    setActionBusy(els, false);
  }
}

function removeUserFromState(userId) {
  const id = String(userId || '');
  const prevLen = state.users.length;
  state.users = state.users.filter((u) => String(u.id) !== id);
  if (state.users.length < prevLen) {
    state.total = Math.max(0, state.total - 1);
  }
  if (openUserId === id) openUserId = null;
}

function patchUserInState(userId, subscriptionPayload) {
  const id = String(userId || '');
  const idx = state.users.findIndex((u) => String(u.id) === id);
  if (idx < 0) return;
  const prev = state.users[idx];
  state.users[idx] = {
    ...prev,
    subscription: subscriptionPayload?.subscription
      ? {
          plan: subscriptionPayload.subscription.plan,
          startedAt: subscriptionPayload.subscription.startedAt ?? null,
          expiresAt: subscriptionPayload.subscription.expiresAt ?? null,
        }
      : prev.subscription,
  };
  openUserId = id;
}

function setActionBusy(els, on) {
  if (els.grantBtn) els.grantBtn.disabled = on;
  if (els.revokeBtn) els.revokeBtn.disabled = on;
  if (els.deleteBtn) els.deleteBtn.disabled = on;
}

function setRowActionStatus(el, message, kind = '') {
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    el.classList.remove('is-error', 'is-ok');
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle('is-error', kind === 'error');
  el.classList.toggle('is-ok', kind === 'ok');
}

function toggleRow(row) {
  const opening = !row.classList.contains('is-open');
  listEl?.querySelectorAll('.admin-user-row.is-open').forEach((other) => {
    if (other !== row) closeRow(other);
  });
  if (opening) openRow(row);
  else closeRow(row);
}

function openRow(row) {
  const expandBtn = row.querySelector('.admin-user-expand');
  row.classList.add('is-open');
  if (expandBtn) expandBtn.setAttribute('aria-expanded', 'true');
  openUserId = row.dataset.id || null;
}

function closeRow(row) {
  const expandBtn = row.querySelector('.admin-user-expand');
  row.classList.remove('is-open');
  if (expandBtn) expandBtn.setAttribute('aria-expanded', 'false');
  if (openUserId && openUserId === row.dataset.id) openUserId = null;
}

function makeBadge(text, kind) {
  const el = document.createElement('span');
  el.className = `admin-user-badge admin-user-badge--${kind}`;
  el.textContent = text;
  return el;
}

function formatRole(role) {
  switch (String(role || '')) {
    case 'admin':
      return ui('roleAdmin');
    case 'coach':
      return ui('roleCoach');
    default:
      return ui('roleAthlete');
  }
}

function formatPlan(plan) {
  switch (String(plan || 'free')) {
    case 'premium':
      return ui('adminPlanPremium');
    case 'growth':
      return ui('adminPlanGrowth');
    case 'pro':
      return ui('adminPlanPro');
    default:
      return ui('adminPlanFree');
  }
}

function formatGoal(goal) {
  switch (String(goal || '')) {
    case 'strength':
      return ui('profileGoalStrength');
    case 'hypertrophy':
      return ui('profileGoalHypertrophy');
    case 'fat_loss':
      return ui('profileGoalFatLoss');
    case 'general':
      return ui('profileGoalGeneral');
    default:
      return goal ? String(goal) : '—';
  }
}

function formatSex(sex) {
  switch (String(sex || '')) {
    case 'male':
      return ui('profileSexMale');
    case 'female':
      return ui('profileSexFemale');
    case 'other':
      return ui('profileSexOther');
    default:
      return '—';
  }
}
