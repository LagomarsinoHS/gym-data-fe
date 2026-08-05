/**
 * Profile view: identity + facts, then available actions, then coming-soon.
 * Active: darse de baja via email confirmation modal.
 * Markup: #profile-view, #deactivate-account-overlay
 */
import { deleteAccount } from '../api/users.js';
import { formatDate } from '../utils/dates.js';
import { ui } from '../utils/labels.js';
import {
  canInviteAthlete,
  getUser,
  hasCoach,
  isAthlete,
  isCoach,
  logout,
} from './session-ui.js';

const PROFILE_ACTIONS = [
  {
    id: 'edit',
    titleKey: 'profileActionEdit',
    hintKey: 'profileActionEditHint',
    icon: 'edit',
  },
  {
    id: 'avatar',
    titleKey: 'profileActionAvatar',
    hintKey: 'profileActionAvatarHint',
    icon: 'avatar',
  },
  {
    id: 'password',
    titleKey: 'profileActionPassword',
    hintKey: 'profileActionPasswordHint',
    icon: 'lock',
  },
  {
    id: 'email',
    titleKey: 'profileActionEmail',
    hintKey: 'profileActionEmailHint',
    icon: 'mail',
  },
  {
    id: 'settings',
    titleKey: 'profileActionSettings',
    hintKey: 'profileActionSettingsHint',
    icon: 'settings',
  },
  {
    id: 'notifications',
    titleKey: 'profileActionNotifications',
    hintKey: 'profileActionNotificationsHint',
    icon: 'bell',
  },
  {
    id: 'privacy',
    titleKey: 'profileActionPrivacy',
    hintKey: 'profileActionPrivacyHint',
    icon: 'privacy',
  },
  {
    id: 'units',
    titleKey: 'profileActionUnits',
    hintKey: 'profileActionUnitsHint',
    icon: 'units',
  },
  {
    id: 'sessions',
    titleKey: 'profileActionSessions',
    hintKey: 'profileActionSessionsHint',
    icon: 'devices',
  },
  {
    id: 'coach-link',
    titleKey: 'profileActionCoachLink',
    hintKey: 'profileActionCoachLinkHint',
    icon: 'link',
    athleteOnly: true,
  },
  {
    id: 'billing',
    titleKey: 'profileActionBilling',
    hintKey: 'profileActionBillingHint',
    icon: 'card',
  },
  {
    id: 'export',
    titleKey: 'profileActionExport',
    hintKey: 'profileActionExportHint',
    icon: 'download',
  },
  {
    id: 'deactivate',
    titleKey: 'profileActionDeactivate',
    hintKey: 'profileActionDeactivateHint',
    icon: 'warn',
    danger: true,
    enabled: true,
  },
];

let overlay;
let form;
let emailInput;
let statusEl;
let confirmBtn;
let busy = false;

export function initProfileUi() {
  overlay = document.getElementById('deactivate-account-overlay');
  form = document.getElementById('deactivate-account-form');
  emailInput = document.getElementById('deactivate-account-email');
  statusEl = document.getElementById('deactivate-account-status');
  confirmBtn = document.getElementById('deactivate-account-confirm');

  document
    .getElementById('deactivate-account-close')
    ?.addEventListener('click', closeDeactivateModal);
  document
    .getElementById('deactivate-account-cancel')
    ?.addEventListener('click', closeDeactivateModal);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeDeactivateModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!overlay?.classList.contains('open')) return;
    closeDeactivateModal();
  });
  emailInput?.addEventListener('input', syncConfirmEnabled);
  form?.addEventListener('submit', onDeactivateSubmit);
}

export function syncProfileLabels() {
  document
    .querySelectorAll('#profile-view [data-ui], #deactivate-account-overlay [data-ui]')
    .forEach((el) => {
      el.textContent = ui(el.dataset.ui);
    });
}

export function syncProfileView() {
  const viewEl = document.getElementById('profile-view');
  if (!viewEl || viewEl.hidden) return;

  syncProfileLabels();
  renderProfileBody();
}

function renderProfileBody() {
  const heroEl = document.getElementById('profile-hero');
  const factsEl = document.getElementById('profile-facts');
  const availableEl = document.getElementById('profile-available-list');
  const soonEl = document.getElementById('profile-soon-list');
  if (!heroEl || !factsEl || !availableEl || !soonEl) return;

  const user = getUser();
  heroEl.replaceChildren();
  factsEl.replaceChildren();
  availableEl.replaceChildren();
  soonEl.replaceChildren();

  if (!user) {
    const empty = document.createElement('p');
    empty.className = 'profile-empty';
    empty.textContent = ui('profileNoUser');
    heroEl.append(empty);
    return;
  }

  const athleteCard = document.createElement('article');
  athleteCard.className = 'profile-hero';
  athleteCard.append(createHero(user));
  heroEl.append(athleteCard);

  if (isAthlete(user)) {
    heroEl.append(createCoachSideCard(user));
  }

  for (const fact of buildFacts(user)) {
    factsEl.append(createFactCard(fact));
  }

  for (const action of PROFILE_ACTIONS) {
    if (action.athleteOnly && !isAthlete(user)) continue;
    const target = action.enabled ? availableEl : soonEl;
    target.append(createActionButton(action));
  }
}

function createHero(user) {
  const wrap = document.createElement('div');
  wrap.className = 'profile-hero-inner';

  const avatar = document.createElement('div');
  avatar.className = 'profile-avatar';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = initialsFor(user);

  const text = document.createElement('div');
  text.className = 'profile-hero-text';

  const name = document.createElement('h2');
  name.className = 'profile-name';
  name.textContent = fullName(user);

  const email = document.createElement('p');
  email.className = 'profile-email';
  email.textContent = String(user.email || '').trim() || '—';

  const badges = document.createElement('div');
  badges.className = 'profile-badges';
  badges.append(createBadge(roleLabel(user), `role-${user.role || 'athlete'}`));
  badges.append(
    createBadge(
      planLabel(user.subscription?.plan),
      isPaidPlan(user.subscription?.plan) ? 'plan-paid' : 'plan-free',
    ),
  );

  text.append(name, email, badges);
  wrap.append(avatar, text);
  return wrap;
}

function createCoachSideCard(user) {
  const card = document.createElement('article');
  card.className = 'profile-coach-card';
  const linked = hasCoach(user);
  if (!linked) card.classList.add('is-empty');

  const kicker = document.createElement('p');
  kicker.className = 'profile-coach-kicker';
  kicker.textContent = ui('profileCoachStatus');

  const body = document.createElement('div');
  body.className = 'profile-coach-body';

  const avatar = document.createElement('div');
  avatar.className = 'profile-avatar profile-avatar--coach';
  avatar.setAttribute('aria-hidden', 'true');
  avatar.textContent = linked ? initialsForCoach(user.coach) : '—';

  const text = document.createElement('div');
  text.className = 'profile-coach-text';

  const name = document.createElement('p');
  name.className = 'profile-coach-name';
  name.textContent = coachDisplayName(user);

  text.append(name);
  body.append(avatar, text);
  card.append(kicker, body);
  return card;
}

function buildFacts(user) {
  /** @type {Array<{ label: string, value: string, tone?: string }>} */
  const facts = [
    { label: ui('profileRole'), value: roleLabel(user) },
    {
      label: ui('profilePlan'),
      value: planLabel(user.subscription?.plan),
      tone: isPaidPlan(user.subscription?.plan) ? 'paid' : undefined,
    },
    { label: ui('profileMemberSince'), value: formatDate(user.createdAt) },
  ];

  if (user.subscription?.startedAt) {
    facts.push({
      label: ui('profilePlanSince'),
      value: formatDate(user.subscription.startedAt),
    });
  }
  if (user.subscription?.expiresAt) {
    facts.push({
      label: ui('profilePlanExpires'),
      value: formatDate(user.subscription.expiresAt),
    });
  }

  if (isAthlete(user)) {
    facts.push({
      label: ui('profileWeight'),
      value: formatWeight(user.currentWeightKg),
      tone: 'weight',
    });
  }

  if (isCoach(user) && user.coachQuota) {
    const { athleteCount, athleteLimit, canInvite } = user.coachQuota;
    const limitText = athleteLimit == null ? '∞' : String(athleteLimit);
    facts.push({
      label: ui('profileAthletesQuota'),
      value: `${athleteCount ?? 0} / ${limitText}`,
    });
    facts.push({
      label: ui('profileCanInvite'),
      value: canInviteAthlete(user)
        ? ui('profileInviteOpen')
        : ui('profileInviteFull'),
      tone: canInvite ? 'ok' : 'warn',
    });
  }

  return facts;
}

function createFactCard({ label, value, tone }) {
  const card = document.createElement('article');
  card.className = 'profile-fact';
  if (tone) card.classList.add(`is-${tone}`);

  const lab = document.createElement('span');
  lab.className = 'profile-fact-label';
  lab.textContent = label;

  const val = document.createElement('span');
  val.className = 'profile-fact-value';
  val.textContent = value;

  card.append(lab, val);
  return card;
}

function createActionButton(action) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'profile-action';
  if (action.danger) btn.classList.add('is-danger');
  btn.dataset.action = action.id;

  const ico = document.createElement('span');
  ico.className = 'profile-action-ico';
  ico.setAttribute('aria-hidden', 'true');
  ico.innerHTML = actionIconSvg(action.icon);

  const body = document.createElement('span');
  body.className = 'profile-action-body';

  const title = document.createElement('span');
  title.className = 'profile-action-title';
  title.textContent = ui(action.titleKey);

  const hint = document.createElement('span');
  hint.className = 'profile-action-hint';
  hint.textContent = ui(action.hintKey);

  body.append(title, hint);
  btn.append(ico, body);

  if (action.enabled) {
    btn.classList.add('is-enabled');
    if (action.id === 'deactivate') {
      btn.addEventListener('click', openDeactivateModal);
    }
    return btn;
  }

  btn.disabled = true;
  btn.setAttribute('aria-disabled', 'true');
  btn.title = ui('profileSoon');

  const soon = document.createElement('span');
  soon.className = 'profile-action-soon';
  soon.textContent = ui('profileSoon');
  btn.append(soon);
  return btn;
}

function openDeactivateModal() {
  if (!overlay || busy) return;
  const user = getUser();
  if (!user?.email) return;

  setStatus('');
  form?.reset();
  syncConfirmEnabled();
  syncProfileLabels();
  overlay.classList.add('open');
  emailInput?.focus();
}

function closeDeactivateModal() {
  if (busy) return;
  overlay?.classList.remove('open');
  setStatus('');
  form?.reset();
  syncConfirmEnabled();
}

function expectedEmail() {
  return String(getUser()?.email || '')
    .trim()
    .toLowerCase();
}

function typedEmail() {
  return String(emailInput?.value || '')
    .trim()
    .toLowerCase();
}

function emailsMatch() {
  const expected = expectedEmail();
  const typed = typedEmail();
  return Boolean(expected && typed && typed === expected);
}

function syncConfirmEnabled() {
  if (!confirmBtn) return;
  confirmBtn.disabled = busy || !emailsMatch();
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

async function onDeactivateSubmit(e) {
  e.preventDefault();
  if (busy) return;

  const email = typedEmail();
  if (!emailsMatch()) {
    setStatus(ui('profileDeactivateMismatch'), 'error');
    syncConfirmEnabled();
    return;
  }

  busy = true;
  syncConfirmEnabled();
  setStatus('');

  try {
    await deleteAccount(email);
    closeDeactivateModalAfterSuccess();
    logout();
  } catch (err) {
    console.error(err);
    setStatus(ui('profileDeactivateError'), 'error');
    busy = false;
    syncConfirmEnabled();
  }
}

function closeDeactivateModalAfterSuccess() {
  busy = false;
  overlay?.classList.remove('open');
  setStatus('');
  form?.reset();
  syncConfirmEnabled();
}

function createBadge(text, kind) {
  const badge = document.createElement('span');
  badge.className = `profile-badge is-${kind}`;
  badge.textContent = text;
  return badge;
}

function fullName(user) {
  const first = String(user.firstName || '').trim();
  const last = String(user.lastName || '').trim();
  return [first, last].filter(Boolean).join(' ') || user.email || '—';
}

function coachDisplayName(user) {
  if (!hasCoach(user)) return ui('profileCoachNone');
  const coach = user.coach;
  const name = [coach?.firstName, coach?.lastName]
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(' ');
  return name || ui('profileCoachLinked');
}

function initialsForCoach(coach) {
  if (!coach) return '?';
  const first = String(coach.firstName || '').trim();
  const last = String(coach.lastName || '').trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  return initials.trim() || '?';
}

function initialsFor(user) {
  const first = String(user.firstName || '').trim();
  const last = String(user.lastName || '').trim();
  const initials = `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
  if (initials.trim()) return initials;
  return String(user.email || '?').charAt(0).toUpperCase();
}

function roleLabel(user) {
  if (user.role === 'admin') return ui('roleAdmin');
  if (user.role === 'coach') return ui('roleCoach');
  return ui('roleAthlete');
}

function planLabel(plan) {
  switch (String(plan || 'free')) {
    case 'premium':
      return ui('profilePlanPremium');
    case 'growth':
      return ui('profilePlanGrowth');
    case 'pro':
      return ui('profilePlanPro');
    default:
      return ui('profilePlanFree');
  }
}

function isPaidPlan(plan) {
  const value = String(plan || 'free');
  return value === 'premium' || value === 'growth' || value === 'pro';
}

function formatWeight(weight) {
  if (weight == null || weight === '') return '—';
  if (typeof weight === 'number' && Number.isFinite(weight)) return `${weight} kg`;
  const text = String(weight).trim();
  return text || '—';
}

function actionIconSvg(kind) {
  const common =
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  switch (kind) {
    case 'avatar':
      return `<svg ${common}><circle cx="12" cy="8" r="3.5"/><path d="M5 20c1.2-3.2 3.8-5 7-5s5.8 1.8 7 5"/><circle cx="12" cy="12" r="9"/></svg>`;
    case 'lock':
      return `<svg ${common}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>`;
    case 'mail':
      return `<svg ${common}><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 7 9-7"/></svg>`;
    case 'settings':
      return `<svg ${common}><circle cx="12" cy="12" r="3"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/></svg>`;
    case 'bell':
      return `<svg ${common}><path d="M6 9a6 6 0 0 1 12 0c0 7 3 7 3 7H3s3 0 3-7"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>`;
    case 'privacy':
      return `<svg ${common}><path d="M12 3 4 7v5c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V7l-8-4z"/></svg>`;
    case 'units':
      return `<svg ${common}><path d="M4 7h16"/><path d="M4 12h10"/><path d="M4 17h7"/><circle cx="18" cy="17" r="3"/></svg>`;
    case 'devices':
      return `<svg ${common}><rect x="3" y="5" width="14" height="11" rx="1.5"/><path d="M7 20h6"/><path d="M20 9v7a1.5 1.5 0 0 1-1.5 1.5H16"/></svg>`;
    case 'link':
      return `<svg ${common}><path d="M9 8H7a4 4 0 0 0 0 8h2"/><path d="M15 8h2a4 4 0 0 1 0 8h-2"/><path d="M9 12h6"/></svg>`;
    case 'card':
      return `<svg ${common}><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M3 10h18"/><path d="M7 15h4"/></svg>`;
    case 'download':
      return `<svg ${common}><path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/></svg>`;
    case 'warn':
      return `<svg ${common}><path d="M12 3 2 20h20L12 3z"/><path d="M12 9v5"/><path d="M12 17h.01"/></svg>`;
    default:
      return `<svg ${common}><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>`;
  }
}
