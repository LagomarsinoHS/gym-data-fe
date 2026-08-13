/**
 * Profile view: split identity card, then available actions, then coming-soon.
 * Active: profile photo (avatar menu) + dejar coach + darse de baja.
 * Markup: #profile-view, #leave-coach-overlay, #deactivate-account-overlay
 */
import {
  deleteAccount,
  leaveCoach,
  uploadProfilePhoto,
  updateProfile,
} from '../api/users.js';
import { ageFromBirthDate, formatDate } from '../utils/dates.js';
import { ApiErrorCode, mapApiError } from '../utils/api-errors.js';
import { userProfile } from '../utils/helpers.js';
import { getLang, ui } from '../utils/labels.js';
import { openProgressPhotoLightbox } from './progress-photo-lightbox.js';
import {
  canInviteAthlete,
  getUser,
  hasCoach,
  isAthlete,
  isCoach,
  logout,
  setUser,
} from './session-ui.js';

const ALLOWED_PROFILE_PHOTO_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

const BIRTH_MIN_YEAR = 1920;
/** @type {'year' | 'month' | 'day'} */
let birthPickerStep = 'year';
let birthPickerViewYear = null;
let birthPickerViewMonth = null;
let birthPanelOpen = false;
/** Live draft YYYY-MM-DD (or '') for the birth picker — source of truth for save. */
let birthDraftYmd = '';

const PROFILE_ACTIONS = [
  {
    id: 'edit',
    titleKey: 'profileActionEdit',
    hintKey: 'profileActionEditHint',
    icon: 'edit',
    enabled: true,
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
let leaveOverlay;
let leaveStatusEl;
let leaveConfirmBtn;
let busy = false;
let leaveBusy = false;
let avatarUploading = false;
let editBusy = false;
/** @type {HTMLElement | null} */
let openAvatarMenu = null;

let editPanel;
/** @type {HTMLElement | null} */
let editPark;
let editForm;
let editFirstName;
let editLastName;
let editHeight;
let editHeightInput;
let editHeightDecBtn;
let editHeightIncBtn;
let editHeightClearBtn;
let editBirthDate;
let editBirthPicker;
let editBirthTrigger;
let editBirthTriggerLabel;
let editBirthPanel;
let editBirthNavLabel;
let editBirthPrevBtn;
let editBirthNextBtn;
let editBirthGrid;
let editSex;
let editGoal;
let editCurrentPassword;
let editCurrentPasswordField;
let editNewPassword;
let editConfirmPassword;
let editStatusEl;
let editSaveBtn;
let currentPasswordDefaultPlaceholder = '';
let editOpen = false;

const HEIGHT_STEPPER_MIN = 120;
const HEIGHT_STEPPER_MAX = 230;
const HEIGHT_STEPPER_DEFAULT = 170;

export function initProfileUi() {
  overlay = document.getElementById('deactivate-account-overlay');
  form = document.getElementById('deactivate-account-form');
  emailInput = document.getElementById('deactivate-account-email');
  statusEl = document.getElementById('deactivate-account-status');
  confirmBtn = document.getElementById('deactivate-account-confirm');
  leaveOverlay = document.getElementById('leave-coach-overlay');
  leaveStatusEl = document.getElementById('leave-coach-status');
  leaveConfirmBtn = document.getElementById('leave-coach-confirm');

  editPanel = document.getElementById('profile-edit-panel');
  editPark = document.getElementById('profile-edit-park');
  editForm = document.getElementById('profile-edit-form');
  editFirstName = document.getElementById('profile-edit-first-name');
  editLastName = document.getElementById('profile-edit-last-name');
  editHeight = document.getElementById('profile-edit-height');
  editHeightInput = document.getElementById('profile-edit-height-input');
  editHeightDecBtn = document.getElementById('profile-edit-height-dec');
  editHeightIncBtn = document.getElementById('profile-edit-height-inc');
  editHeightClearBtn = document.getElementById('profile-edit-height-clear');
  editBirthDate = document.getElementById('profile-edit-birth-date');
  editBirthPicker = document.getElementById('profile-edit-birth-picker');
  editBirthTrigger = document.getElementById('profile-edit-birth-trigger');
  editBirthTriggerLabel = document.getElementById('profile-edit-birth-trigger-label');
  editBirthPanel = document.getElementById('profile-edit-birth-panel');
  editBirthNavLabel = document.getElementById('profile-edit-birth-nav-label');
  editBirthPrevBtn = document.getElementById('profile-edit-birth-prev');
  editBirthNextBtn = document.getElementById('profile-edit-birth-next');
  editBirthGrid = document.getElementById('profile-edit-birth-grid');
  editSex = document.getElementById('profile-edit-sex');
  editGoal = document.getElementById('profile-edit-goal');
  editCurrentPassword = document.getElementById('profile-edit-current-password');
  editCurrentPasswordField = document.getElementById(
    'profile-edit-current-password-field',
  );
  editNewPassword = document.getElementById('profile-edit-new-password');
  editConfirmPassword = document.getElementById('profile-edit-confirm-password');
  editStatusEl = document.getElementById('profile-edit-status');
  editSaveBtn = document.getElementById('profile-edit-save');
  currentPasswordDefaultPlaceholder =
    editCurrentPassword?.getAttribute('placeholder') || '';

  editHeightDecBtn?.addEventListener('click', () => stepHeight(-1));
  editHeightIncBtn?.addEventListener('click', () => stepHeight(1));
  editHeightClearBtn?.addEventListener('click', () => setHeightStepperValue(null));
  editHeightInput?.addEventListener('input', onHeightInputTyping);
  editHeightInput?.addEventListener('change', onHeightInputCommit);
  editHeightInput?.addEventListener('blur', onHeightInputCommit);
  editHeightInput?.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    onHeightInputCommit();
    editHeightInput.blur();
  });

  editBirthTrigger?.addEventListener('click', () => {
    if (birthPanelOpen) closeBirthPanel();
    else openBirthPanel();
  });
  editBirthPrevBtn?.addEventListener('click', onBirthNavPrev);
  editBirthNextBtn?.addEventListener('click', onBirthNavNext);
  editBirthNavLabel?.addEventListener('click', onBirthNavLabelClick);
  editBirthGrid?.addEventListener('click', onBirthGridClick);

  document.addEventListener('click', (event) => {
    if (!birthPanelOpen) return;
    if (editBirthPicker?.contains(/** @type {Node} */ (event.target))) return;
    closeBirthPanel();
  });

  document
    .getElementById('deactivate-account-close')
    ?.addEventListener('click', closeDeactivateModal);
  document
    .getElementById('deactivate-account-cancel')
    ?.addEventListener('click', closeDeactivateModal);
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) closeDeactivateModal();
  });
  document
    .getElementById('leave-coach-close')
    ?.addEventListener('click', closeLeaveCoachModal);
  document
    .getElementById('leave-coach-cancel')
    ?.addEventListener('click', closeLeaveCoachModal);
  leaveConfirmBtn?.addEventListener('click', () => {
    void onLeaveCoachConfirm();
  });
  leaveOverlay?.addEventListener('click', (e) => {
    if (e.target === leaveOverlay) closeLeaveCoachModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (birthPanelOpen) {
      e.stopPropagation();
      closeBirthPanel();
      return;
    }
    if (openAvatarMenu) {
      closeAvatarMenu();
      return;
    }
    if (editOpen) {
      closeEditPanel();
      return;
    }
    if (leaveOverlay?.classList.contains('open')) {
      closeLeaveCoachModal();
      return;
    }
    if (!overlay?.classList.contains('open')) return;
    closeDeactivateModal();
  });
  document.addEventListener('click', (e) => {
    if (!openAvatarMenu) return;
    if (openAvatarMenu.contains(/** @type {Node} */ (e.target))) return;
    closeAvatarMenu();
  });
  emailInput?.addEventListener('input', syncConfirmEnabled);
  form?.addEventListener('submit', onDeactivateSubmit);

  document
    .getElementById('profile-edit-cancel')
    ?.addEventListener('click', closeEditPanel);
  editSaveBtn?.addEventListener('click', () => {
    void saveProfileEdits();
  });
  editForm?.addEventListener('input', () => {
    if (
      editCurrentPassword &&
      document.activeElement === editCurrentPassword
    ) {
      clearCurrentPasswordError();
    }
    syncEditSaveEnabled();
  });
  editForm?.addEventListener('change', () => syncEditSaveEnabled());
  editForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    void saveProfileEdits();
  });
}

export function syncProfileLabels() {
  document
    .querySelectorAll(
      '#profile-view [data-ui], #leave-coach-overlay [data-ui], #deactivate-account-overlay [data-ui]',
    )
    .forEach((el) => {
      if (el.id === 'profile-edit-birth-trigger-label') return;
      el.textContent = ui(el.dataset.ui);
    });
  syncHeightStepperUi();
  syncBirthPickerLabels();
}

export function syncProfileView() {
  const viewEl = document.getElementById('profile-view');
  if (!viewEl || viewEl.hidden) return;

  closeAvatarMenu();
  syncProfileLabels();
  // While a save is in-flight, don't remount/reset the edit form.
  if (editBusy) return;
  renderProfileBody();
  if (editOpen) {
    fillEditFormFromUser();
    syncEditSaveEnabled();
  }
}

function renderProfileBody() {
  const heroEl = document.getElementById('profile-hero');
  const availableEl = document.getElementById('profile-available-list');
  const soonEl = document.getElementById('profile-soon-list');
  if (!heroEl || !availableEl || !soonEl) return;

  parkEditPanel();

  const user = getUser();
  heroEl.replaceChildren();
  availableEl.replaceChildren();
  soonEl.replaceChildren();

  if (!user) {
    editOpen = false;
    const empty = document.createElement('p');
    empty.className = 'profile-empty';
    empty.textContent = ui('profileNoUser');
    heroEl.append(empty);
    return;
  }

  heroEl.append(createSplitProfileCard(user, { editing: editOpen }));
  if (editOpen) mountEditPanelInSplit();

  for (const action of PROFILE_ACTIONS) {
    if (action.athleteOnly && !isAthlete(user)) continue;
    const target = action.enabled ? availableEl : soonEl;
    const btn = createActionButton(action);
    if (action.id === 'edit' && editOpen) btn.classList.add('is-active');
    target.append(btn);
  }
}

function createSplitProfileCard(user, { editing = false } = {}) {
  const card = document.createElement('article');
  card.className = 'profile-split';
  if (editing) card.classList.add('is-editing');

  const side = document.createElement('div');
  side.className = 'profile-split-side';

  const identity = document.createElement('div');
  identity.className = 'profile-split-identity';
  identity.append(createAvatarControl(user));

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

  identity.append(name, email, badges);
  side.append(identity);

  if (isAthlete(user)) {
    side.append(createCoachBlock(user));
  }

  const main = document.createElement('div');
  main.className = 'profile-split-main';
  if (editing) main.classList.add('is-editing');

  const view = document.createElement('div');
  view.className = 'profile-split-view';
  if (editing) view.hidden = true;

  const head = document.createElement('div');
  head.className = 'profile-split-head';

  const title = document.createElement('h3');
  title.className = 'profile-split-title';
  title.textContent = ui('profilePersonalInfo');

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'profile-split-edit-btn';
  editBtn.textContent = ui('profileEditShort');
  editBtn.addEventListener('click', openEditPanel);

  head.append(title, editBtn);

  const factsGrid = document.createElement('div');
  factsGrid.className = 'profile-split-facts';
  for (const fact of buildDetailFacts(user)) {
    factsGrid.append(createDetailFact(fact));
  }

  view.append(head, factsGrid);

  const metrics = buildMetricFacts(user);
  if (metrics.length > 0) {
    const metricsRow = document.createElement('div');
    metricsRow.className = 'profile-split-metrics';
    for (const metric of metrics) {
      metricsRow.append(createMetricCard(metric));
    }
    view.append(metricsRow);
  }

  main.append(view);
  card.append(side, main);
  return card;
}

function parkEditPanel() {
  if (!editPanel || !editPark) return;
  if (editPanel.parentElement !== editPark) editPark.append(editPanel);
}

function mountEditPanelInSplit() {
  const main = document.querySelector('#profile-hero .profile-split-main');
  if (!editPanel || !main) return;
  main.classList.add('is-editing');
  main.append(editPanel);
  editPanel.hidden = false;
}

function createAvatarControl(user) {
  const wrap = document.createElement('div');
  wrap.className = 'profile-avatar-wrap';
  wrap.dataset.profileAvatar = '1';

  const photoUrl = profilePhotoUrl(user);

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/jpeg,image/png,image/webp';
  fileInput.hidden = true;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'profile-avatar is-interactive';
  if (photoUrl) btn.classList.add('has-photo');
  btn.setAttribute('aria-haspopup', 'menu');
  btn.setAttribute('aria-expanded', 'false');
  btn.setAttribute('aria-label', ui('profileAvatarMenu'));
  fillAvatarButton(btn, user, photoUrl);

  const menu = document.createElement('div');
  menu.className = 'profile-avatar-menu';
  menu.hidden = true;
  menu.setAttribute('role', 'menu');

  if (photoUrl) {
    menu.append(
      createAvatarMenuItem('view', ui('profileAvatarView'), () => {
        closeAvatarMenu();
        openProgressPhotoLightbox({
          url: photoUrl,
          title: ui('profileAvatarViewTitle'),
          firstName: userProfile(user).firstName,
          lastName: userProfile(user).lastName,
          side: 'front',
        });
      }),
    );
  }

  menu.append(
    createAvatarMenuItem('upload', ui('profileAvatarUpload'), () => {
      closeAvatarMenu();
      fileInput.click();
    }),
  );

  fileInput.addEventListener('change', () => {
    const file = fileInput.files?.[0] || null;
    fileInput.value = '';
    if (file) void handleProfilePhotoUpload(file, btn);
  });

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleAvatarMenu(wrap, btn, menu);
  });

  wrap.append(btn, menu, fileInput);
  return wrap;
}

function createAvatarMenuItem(action, label, onClick) {
  const item = document.createElement('button');
  item.type = 'button';
  item.className = 'profile-avatar-menu-item';
  item.setAttribute('role', 'menuitem');
  item.dataset.action = action;
  item.textContent = label;
  item.addEventListener('click', (e) => {
    e.stopPropagation();
    onClick();
  });
  return item;
}

function fillAvatarButton(btn, user, photoUrl) {
  btn.replaceChildren();
  if (photoUrl) {
    const img = document.createElement('img');
    img.className = 'profile-avatar-img';
    img.src = photoUrl;
    img.alt = '';
    btn.append(img);
    return;
  }
  btn.textContent = initialsFor(user);
}

function profilePhotoUrl(user) {
  return String(user?.profilePhoto?.url || '').trim();
}

function toggleAvatarMenu(wrap, btn, menu) {
  if (openAvatarMenu === wrap) {
    closeAvatarMenu();
    return;
  }
  closeAvatarMenu();
  openAvatarMenu = wrap;
  wrap.classList.add('is-menu-open');
  menu.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
}

function closeAvatarMenu() {
  if (!openAvatarMenu) return;
  const wrap = openAvatarMenu;
  const btn = wrap.querySelector('.profile-avatar');
  const menu = wrap.querySelector('.profile-avatar-menu');
  wrap.classList.remove('is-menu-open');
  if (menu) menu.hidden = true;
  btn?.setAttribute('aria-expanded', 'false');
  openAvatarMenu = null;
}

async function handleProfilePhotoUpload(file, avatarBtn) {
  if (avatarUploading) return;
  if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
    window.alert(ui('profileAvatarUploadError'));
    return;
  }

  avatarUploading = true;
  avatarBtn?.classList.add('is-busy');
  avatarBtn?.setAttribute('aria-busy', 'true');

  try {
    const updated = await uploadProfilePhoto(file);
    setUser(updated);
    syncProfileView();
  } catch (err) {
    console.error(err);
    window.alert(ui('profileAvatarUploadError'));
  } finally {
    avatarUploading = false;
    avatarBtn?.classList.remove('is-busy');
    avatarBtn?.removeAttribute('aria-busy');
  }
}

function createCoachBlock(user) {
  const block = document.createElement('div');
  block.className = 'profile-split-coach';
  const linked = hasCoach(user);
  if (!linked) block.classList.add('is-empty');

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
  block.append(kicker, body);

  if (linked) {
    const leaveBtn = document.createElement('button');
    leaveBtn.type = 'button';
    leaveBtn.className = 'profile-coach-leave';
    leaveBtn.textContent = ui('profileLeaveCoach');
    leaveBtn.addEventListener('click', openLeaveCoachModal);
    block.append(leaveBtn);
  }

  return block;
}

function buildDetailFacts(user) {
  /** @type {Array<{ label: string, value: string, tone?: string }>} */
  const facts = [
    { label: ui('profileRole'), value: roleLabel(user) || '—' },
    {
      label: ui('profilePlan'),
      value: planLabel(user.subscription?.plan) || '—',
      tone: isPaidPlan(user.subscription?.plan) ? 'paid' : undefined,
    },
    {
      label: ui('profileMemberSince'),
      value: formatDate(user.createdAt) || '—',
    },
    {
      label: ui('profilePlanSince'),
      value: user.subscription?.startedAt
        ? formatDate(user.subscription.startedAt) || '—'
        : '—',
    },
    {
      label: ui('profilePlanExpires'),
      value: user.subscription?.expiresAt
        ? formatDate(user.subscription.expiresAt) || '—'
        : '—',
    },
  ];

  const profile = userProfile(user);

  facts.push({
    label: ui('profileSex'),
    value: formatSex(profile.sex) || '—',
  });
  facts.push({
    label: ui('profileBirthDate'),
    value: profile.birthDate ? formatDate(profile.birthDate) || '—' : '—',
  });
  const age = ageFromBirthDate(profile.birthDate);
  facts.push({
    label: ui('profileAge'),
    value: age != null ? String(age) : '—',
  });
  facts.push({
    label: ui('profileGoal'),
    value: formatGoal(user.goal) || '—',
  });

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

function buildMetricFacts(user) {
  /** @type {Array<{ label: string, value: string, icon: string, tone: string }>} */
  const metrics = [];
  const profile = userProfile(user);

  if (isAthlete(user)) {
    metrics.push({
      label: ui('profileWeight'),
      value: formatWeight(user.currentWeightKg),
      icon: 'weight',
      tone: 'weight',
    });
  }

  const height =
    profile.heightCm != null && Number.isFinite(Number(profile.heightCm))
      ? `${Number(profile.heightCm)} cm`
      : '—';
  metrics.push({
    label: ui('profileHeight'),
    value: height,
    icon: 'height',
    tone: 'height',
  });

  return metrics;
}

function createDetailFact({ label, value, tone }) {
  const row = document.createElement('div');
  row.className = 'profile-detail';
  if (tone) row.classList.add(`is-${tone}`);

  const lab = document.createElement('span');
  lab.className = 'profile-detail-label';
  lab.textContent = label;

  const val = document.createElement('span');
  val.className = 'profile-detail-value';
  val.textContent = value;

  row.append(lab, val);
  return row;
}

function createMetricCard({ label, value, icon, tone }) {
  const card = document.createElement('article');
  card.className = 'profile-metric';
  if (tone) card.classList.add(`is-${tone}`);

  const ico = document.createElement('span');
  ico.className = 'profile-metric-ico';
  ico.setAttribute('aria-hidden', 'true');
  ico.innerHTML = metricIconSvg(icon);

  const body = document.createElement('div');
  body.className = 'profile-metric-body';

  const lab = document.createElement('span');
  lab.className = 'profile-metric-label';
  lab.textContent = label;

  const val = document.createElement('span');
  val.className = 'profile-metric-value';
  val.textContent = value;

  body.append(lab, val);
  card.append(ico, body);
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
    } else if (action.id === 'edit') {
      btn.addEventListener('click', toggleEditPanel);
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

function openLeaveCoachModal() {
  if (!leaveOverlay || leaveBusy) return;
  const user = getUser();
  if (!hasCoach(user)) return;

  setLeaveCoachStatus('');
  syncProfileLabels();
  leaveOverlay.classList.add('open');
  leaveConfirmBtn?.focus();
}

function closeLeaveCoachModal() {
  if (leaveBusy) return;
  leaveOverlay?.classList.remove('open');
  setLeaveCoachStatus('');
}

function setLeaveCoachStatus(message, kind = '') {
  if (!leaveStatusEl) return;
  if (!message) {
    leaveStatusEl.hidden = true;
    leaveStatusEl.textContent = '';
    leaveStatusEl.classList.remove('is-error', 'is-ok');
    return;
  }
  leaveStatusEl.hidden = false;
  leaveStatusEl.textContent = message;
  leaveStatusEl.classList.toggle('is-error', kind === 'error');
  leaveStatusEl.classList.toggle('is-ok', kind === 'ok');
}

function syncLeaveCoachBusy() {
  if (!leaveConfirmBtn) return;
  leaveConfirmBtn.disabled = leaveBusy;
  leaveConfirmBtn.textContent = ui('profileLeaveCoachConfirm');
}

async function onLeaveCoachConfirm() {
  if (leaveBusy) return;

  leaveBusy = true;
  syncLeaveCoachBusy();
  setLeaveCoachStatus('');

  try {
    const me = await leaveCoach();
    leaveBusy = false;
    closeLeaveCoachModal();
    setUser(me);
    syncProfileView();
  } catch (err) {
    console.error(err);
    setLeaveCoachStatus(
      mapApiError(err, {
        byCode: {
          [ApiErrorCode.NoCoachAssigned]: 'profileLeaveCoachNone',
        },
        fallback: 'profileLeaveCoachError',
      }),
      'error',
    );
    leaveBusy = false;
    syncLeaveCoachBusy();
  }
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

function toggleEditPanel() {
  if (!editPanel) return;
  if (editOpen) closeEditPanel();
  else openEditPanel();
}

function openEditPanel() {
  if (!editPanel || editBusy) return;
  const user = getUser();
  if (!user) return;

  const main = document.querySelector('#profile-hero .profile-split-main');
  const view = main?.querySelector('.profile-split-view');
  if (!main || !view) return;

  editOpen = true;
  setEditStatus('');
  fillEditFormFromUser();
  syncEditSaveEnabled();
  syncProfileLabels();

  view.hidden = true;
  main.classList.add('is-editing');
  main.closest('.profile-split')?.classList.add('is-editing');
  main.append(editPanel);
  editPanel.hidden = false;

  document
    .querySelector('#profile-available-list [data-action="edit"]')
    ?.classList.add('is-active');

  editFirstName?.focus();
  main.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function closeEditPanel() {
  if (editBusy) return;
  closeBirthPanel();
  editOpen = false;
  if (editPanel) editPanel.hidden = true;
  parkEditPanel();

  const main = document.querySelector('#profile-hero .profile-split-main');
  const view = main?.querySelector('.profile-split-view');
  if (view) view.hidden = false;
  main?.classList.remove('is-editing');
  main?.closest('.profile-split')?.classList.remove('is-editing');
  document
    .querySelector('#profile-available-list [data-action="edit"]')
    ?.classList.remove('is-active');

  setEditStatus('');
  clearCurrentPasswordError();
  clearPasswordFields();
  syncEditSaveEnabled();
}

function fillEditFormFromUser() {
  const user = getUser();
  if (!user) return;
  const profile = userProfile(user);
  if (editFirstName) editFirstName.value = String(profile.firstName || '').trim();
  if (editLastName) editLastName.value = String(profile.lastName || '').trim();
  setHeightStepperValue(
    profile.heightCm != null && Number.isFinite(Number(profile.heightCm))
      ? Number(profile.heightCm)
      : null,
  );
  setBirthDateValue(normalizeBirthDate(profile.birthDate), {
    silent: true,
  });
  if (editSex) editSex.value = String(profile.sex || '');
  if (editGoal) editGoal.value = String(user.goal || '');
  clearCurrentPasswordError();
  clearPasswordFields();
}

function clearPasswordFields() {
  if (editCurrentPassword) editCurrentPassword.value = '';
  if (editNewPassword) editNewPassword.value = '';
  if (editConfirmPassword) editConfirmPassword.value = '';
}

function stepHeight(delta) {
  const raw = String(editHeight?.value || '').trim();
  const current = raw === '' ? HEIGHT_STEPPER_DEFAULT : Number(raw);
  const next = Math.min(
    HEIGHT_STEPPER_MAX,
    Math.max(HEIGHT_STEPPER_MIN, Math.round(current) + delta),
  );
  setHeightStepperValue(next);
}

function onHeightInputTyping() {
  const raw = String(editHeightInput?.value || '').trim();
  if (editHeight) editHeight.value = raw;
  if (editHeightClearBtn) editHeightClearBtn.hidden = raw === '';
  syncEditSaveEnabled();
}

function onHeightInputCommit() {
  const raw = String(editHeightInput?.value || '').trim();
  if (raw === '') {
    setHeightStepperValue(null);
    return;
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    setHeightStepperValue(null);
    return;
  }
  setHeightStepperValue(Math.round(n));
}

/**
 * @param {number | null} cm
 */
function setHeightStepperValue(cm) {
  let value = '';
  if (cm != null && Number.isFinite(cm)) {
    value = String(
      Math.min(HEIGHT_STEPPER_MAX, Math.max(HEIGHT_STEPPER_MIN, Math.round(cm))),
    );
  }
  if (editHeight) {
    const changed = editHeight.value !== value;
    editHeight.value = value;
    if (changed) {
      editHeight.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  if (editHeightInput && editHeightInput.value !== value) {
    editHeightInput.value = value;
  }
  syncHeightStepperUi();
  syncEditSaveEnabled();
}

function syncHeightStepperUi() {
  const raw = String(editHeight?.value || '').trim();
  if (editHeightInput && document.activeElement !== editHeightInput) {
    editHeightInput.value = raw;
  }
  const cm = raw === '' ? null : Number(raw);
  if (editHeightDecBtn) {
    editHeightDecBtn.disabled = cm != null && cm <= HEIGHT_STEPPER_MIN;
  }
  if (editHeightIncBtn) {
    editHeightIncBtn.disabled = cm != null && cm >= HEIGHT_STEPPER_MAX;
  }
  if (editHeightClearBtn) {
    editHeightClearBtn.hidden = cm == null && String(editHeightInput?.value || '').trim() === '';
  }
}

function todayLocalParts() {
  const now = new Date();
  return {
    y: now.getFullYear(),
    m: now.getMonth() + 1,
    d: now.getDate(),
  };
}

/** Normalize API / form birth values to YYYY-MM-DD or ''. */
function normalizeBirthDate(value) {
  const raw = String(value ?? '').trim();
  if (!raw || raw === 'null' || raw === 'undefined') return '';
  const ymd = raw.match(/^(\d{4}-\d{2}-\d{2})/);
  return ymd ? ymd[1] : '';
}

function parseBirthYmd(value) {
  const match = normalizeBirthDate(value).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

function isFutureBirthParts(y, m, d) {
  const today = todayLocalParts();
  return (
    y > today.y ||
    (y === today.y && m > today.m) ||
    (y === today.y && m === today.m && d > today.d)
  );
}

function monthShortLabels() {
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  return Array.from({ length: 12 }, (_, index) => {
    const raw = new Intl.DateTimeFormat(locale, { month: 'short' }).format(
      new Date(2020, index, 1),
    );
    const cleaned = raw.replace(/\.$/, '');
    return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  });
}

function monthLongLabel(month) {
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  const raw = new Intl.DateTimeFormat(locale, { month: 'long' }).format(
    new Date(2020, month - 1, 1),
  );
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function formatBirthLabel(ymd) {
  const parts = parseBirthYmd(ymd);
  if (!parts) return ui('profileEditBirthChoose');
  const locale = getLang() === 'en' ? 'en-US' : 'es-ES';
  const raw = new Intl.DateTimeFormat(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(new Date(parts.y, parts.m - 1, parts.d));
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

function decadeStart(year) {
  const offset = Math.max(0, year - BIRTH_MIN_YEAR);
  return BIRTH_MIN_YEAR + Math.floor(offset / 12) * 12;
}

function syncBirthPickerLabels() {
  if (editBirthPrevBtn) {
    editBirthPrevBtn.setAttribute('aria-label', ui('profileEditBirthPrev'));
  }
  if (editBirthNextBtn) {
    editBirthNextBtn.setAttribute('aria-label', ui('profileEditBirthNext'));
  }
  if (editBirthNavLabel) {
    editBirthNavLabel.setAttribute('aria-label', ui('profileEditBirthBack'));
  }
  if (editBirthPanel) {
    editBirthPanel.setAttribute('aria-label', ui('profileEditBirthDate'));
  }
  syncBirthTriggerLabel();
  if (birthPanelOpen) renderBirthPanel();
}

function syncBirthTriggerLabel() {
  if (!editBirthTriggerLabel) {
    editBirthTriggerLabel = document.getElementById(
      'profile-edit-birth-trigger-label',
    );
  }
  if (!editBirthTriggerLabel) return;
  editBirthTriggerLabel.textContent = formatBirthLabel(birthDraftYmd);
}

function setBirthDateValue(ymd, { silent = false } = {}) {
  const parts = parseBirthYmd(ymd);
  let value = '';
  if (
    parts &&
    parts.y >= BIRTH_MIN_YEAR &&
    !isFutureBirthParts(parts.y, parts.m, parts.d)
  ) {
    const safeDay = Math.min(parts.d, daysInMonth(parts.y, parts.m));
    value = `${parts.y}-${String(parts.m).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`;
  }
  birthDraftYmd = value;
  if (!editBirthDate) {
    editBirthDate = document.getElementById('profile-edit-birth-date');
  }
  if (editBirthDate) editBirthDate.value = value;
  syncBirthTriggerLabel();
  if (!silent) syncEditSaveEnabled();
}

function openBirthPanel() {
  if (!editBirthPanel || !editBirthTrigger) return;
  const selected = parseBirthYmd(birthDraftYmd || editBirthDate?.value);
  const today = todayLocalParts();
  birthPickerViewYear = selected?.y ?? today.y - 25;
  birthPickerViewMonth = selected?.m ?? 1;
  if (birthPickerViewYear < BIRTH_MIN_YEAR) birthPickerViewYear = BIRTH_MIN_YEAR;
  if (birthPickerViewYear > today.y) birthPickerViewYear = today.y;
  birthPickerStep = 'year';
  birthPanelOpen = true;
  editBirthPanel.hidden = false;
  editBirthTrigger.setAttribute('aria-expanded', 'true');
  renderBirthPanel();
}

function closeBirthPanel() {
  birthPanelOpen = false;
  if (editBirthPanel) editBirthPanel.hidden = true;
  editBirthTrigger?.setAttribute('aria-expanded', 'false');
}

function onBirthNavPrev() {
  if (birthPickerStep === 'year') {
    birthPickerViewYear = Math.max(
      BIRTH_MIN_YEAR,
      decadeStart(birthPickerViewYear) - 12,
    );
  } else if (birthPickerStep === 'month') {
    birthPickerViewYear = Math.max(BIRTH_MIN_YEAR, birthPickerViewYear - 1);
  } else if (birthPickerStep === 'day') {
    if (birthPickerViewMonth <= 1) {
      if (birthPickerViewYear <= BIRTH_MIN_YEAR) return;
      birthPickerViewYear -= 1;
      birthPickerViewMonth = 12;
    } else {
      birthPickerViewMonth -= 1;
    }
  }
  renderBirthPanel();
}

function onBirthNavNext() {
  const today = todayLocalParts();
  if (birthPickerStep === 'year') {
    const next = decadeStart(birthPickerViewYear) + 12;
    if (next > today.y) return;
    birthPickerViewYear = next;
  } else if (birthPickerStep === 'month') {
    if (birthPickerViewYear >= today.y) return;
    birthPickerViewYear += 1;
  } else if (birthPickerStep === 'day') {
    if (birthPickerViewMonth >= 12) {
      if (birthPickerViewYear >= today.y) return;
      birthPickerViewYear += 1;
      birthPickerViewMonth = 1;
    } else {
      const nextMonth = birthPickerViewMonth + 1;
      if (
        birthPickerViewYear === today.y &&
        nextMonth > today.m
      ) {
        return;
      }
      birthPickerViewMonth = nextMonth;
    }
  }
  renderBirthPanel();
}

function onBirthNavLabelClick() {
  if (birthPickerStep === 'day') {
    birthPickerStep = 'month';
    renderBirthPanel();
    return;
  }
  if (birthPickerStep === 'month') {
    birthPickerStep = 'year';
    renderBirthPanel();
  }
}

function onBirthGridClick(event) {
  const btn = /** @type {HTMLButtonElement | null} */ (
    event.target instanceof Element
      ? event.target.closest('button[data-birth-value]')
      : null
  );
  if (!btn || btn.disabled) return;
  event.preventDefault();
  event.stopPropagation();
  const raw = String(btn.dataset.birthValue || '');
  if (birthPickerStep === 'year') {
    birthPickerViewYear = Number(raw);
    birthPickerStep = 'month';
    renderBirthPanel();
    return;
  }
  if (birthPickerStep === 'month') {
    birthPickerViewMonth = Number(raw);
    birthPickerStep = 'day';
    renderBirthPanel();
    return;
  }
  const day = Number(raw);
  const y = birthPickerViewYear;
  const m = birthPickerViewMonth;
  if (!y || !m || !day) return;
  setBirthDateValue(
    `${y}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
  );
  closeBirthPanel();
}

function renderBirthPanel() {
  if (!editBirthGrid || birthPickerViewYear == null) return;
  const today = todayLocalParts();
  const selected = parseBirthYmd(birthDraftYmd);
  editBirthGrid.classList.toggle('is-days', birthPickerStep === 'day');
  editBirthGrid.replaceChildren();

  if (birthPickerStep === 'year') {
    const start = decadeStart(birthPickerViewYear);
    const end = start + 11;
    if (editBirthNavLabel) {
      editBirthNavLabel.textContent = `${start}–${end}`;
      editBirthNavLabel.disabled = true;
    }
    if (editBirthPrevBtn) editBirthPrevBtn.disabled = start <= BIRTH_MIN_YEAR;
    if (editBirthNextBtn) editBirthNextBtn.disabled = start + 12 > today.y;

    for (let year = start; year <= end; year += 1) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'month-picker-month';
      btn.dataset.birthValue = String(year);
      btn.textContent = String(year);
      btn.disabled = year < BIRTH_MIN_YEAR || year > today.y;
      if (selected?.y === year) btn.classList.add('is-selected');
      editBirthGrid.appendChild(btn);
    }
    return;
  }

  if (birthPickerStep === 'month') {
    if (editBirthNavLabel) {
      editBirthNavLabel.textContent = String(birthPickerViewYear);
      editBirthNavLabel.disabled = false;
    }
    if (editBirthPrevBtn) {
      editBirthPrevBtn.disabled = birthPickerViewYear <= BIRTH_MIN_YEAR;
    }
    if (editBirthNextBtn) {
      editBirthNextBtn.disabled = birthPickerViewYear >= today.y;
    }
    monthShortLabels().forEach((label, index) => {
      const month = index + 1;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'month-picker-month';
      btn.dataset.birthValue = String(month);
      btn.textContent = label;
      btn.disabled =
        birthPickerViewYear > today.y ||
        (birthPickerViewYear === today.y && month > today.m);
      if (selected?.y === birthPickerViewYear && selected?.m === month) {
        btn.classList.add('is-selected');
      }
      editBirthGrid.appendChild(btn);
    });
    return;
  }

  if (editBirthNavLabel) {
    editBirthNavLabel.textContent = `${monthLongLabel(birthPickerViewMonth)} ${birthPickerViewYear}`;
    editBirthNavLabel.disabled = false;
  }
  const canPrevMonth =
    birthPickerViewYear > BIRTH_MIN_YEAR || birthPickerViewMonth > 1;
  const canNextMonth =
    birthPickerViewYear < today.y ||
    (birthPickerViewYear === today.y && birthPickerViewMonth < today.m);
  if (editBirthPrevBtn) editBirthPrevBtn.disabled = !canPrevMonth;
  if (editBirthNextBtn) editBirthNextBtn.disabled = !canNextMonth;

  const maxDay = daysInMonth(birthPickerViewYear, birthPickerViewMonth);
  for (let day = 1; day <= maxDay; day += 1) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'month-picker-month';
    btn.dataset.birthValue = String(day);
    btn.textContent = String(day);
    btn.disabled = isFutureBirthParts(
      birthPickerViewYear,
      birthPickerViewMonth,
      day,
    );
    if (
      selected?.y === birthPickerViewYear &&
      selected?.m === birthPickerViewMonth &&
      selected?.d === day
    ) {
      btn.classList.add('is-selected');
    }
    editBirthGrid.appendChild(btn);
  }
}

function buildEditPayload() {
  const user = getUser();
  if (!user) return { error: ui('profileEditError') };

  const profile = userProfile(user);
  /** @type {Record<string, unknown>} */
  const body = {};
  /** @type {Record<string, string | number | null>} */
  const profilePatch = {};

  const firstName = String(editFirstName?.value || '').trim();
  const lastName = String(editLastName?.value || '').trim();
  const currentName = String(profile.firstName || '').trim();
  const currentLast = String(profile.lastName || '').trim();

  if (firstName && firstName !== currentName) profilePatch.firstName = firstName;
  if (lastName && lastName !== currentLast) profilePatch.lastName = lastName;

  const heightRaw = String(editHeight?.value || '').trim();
  const nextHeight = heightRaw === '' ? null : Number(heightRaw);
  if (
    heightRaw !== '' &&
    (!Number.isInteger(nextHeight) ||
      nextHeight < HEIGHT_STEPPER_MIN ||
      nextHeight > HEIGHT_STEPPER_MAX)
  ) {
    return { error: ui('profileEditHeightInvalid') };
  }
  const currentHeight =
    profile.heightCm != null && Number.isFinite(Number(profile.heightCm))
      ? Number(profile.heightCm)
      : null;
  if (nextHeight !== currentHeight) profilePatch.heightCm = nextHeight;

  const nextBirth = normalizeBirthDate(birthDraftYmd) || null;
  const currentBirth = normalizeBirthDate(profile.birthDate) || null;
  if (nextBirth !== currentBirth) profilePatch.birthDate = nextBirth;

  const nextSex = String(editSex?.value || '').trim() || null;
  const currentSex = profile.sex || null;
  if (nextSex !== currentSex) profilePatch.sex = nextSex;

  if (Object.keys(profilePatch).length > 0) {
    body.profile = profilePatch;
  }

  const nextGoal = String(editGoal?.value || '').trim() || null;
  const currentGoal = user.goal || null;
  if (nextGoal !== currentGoal) body.goal = nextGoal;

  const currentPassword = String(editCurrentPassword?.value || '');
  const newPassword = String(editNewPassword?.value || '');
  const confirmNewPassword = String(editConfirmPassword?.value || '');
  // Ignore autofilled currentPassword alone — password change only when
  // new and/or confirm are filled.
  const passwordTouched = Boolean(newPassword) || Boolean(confirmNewPassword);

  if (passwordTouched) {
    if (!currentPassword || !newPassword || !confirmNewPassword) {
      return { error: ui('profileEditPasswordIncomplete') };
    }
    if (newPassword.length < 4) {
      return { error: ui('profileEditPasswordShort') };
    }
    if (newPassword !== confirmNewPassword) {
      return { error: ui('profileEditPasswordMismatch') };
    }
    body.currentPassword = currentPassword;
    body.newPassword = newPassword;
    body.confirmNewPassword = confirmNewPassword;
  }

  if (!body.profile && body.goal === undefined && !body.newPassword) {
    return { error: ui('profileEditNothing') };
  }

  return { body };
}

function syncEditSaveEnabled() {
  if (!editSaveBtn) return;
  if (editBusy) {
    editSaveBtn.disabled = true;
    return;
  }
  const user = getUser();
  const profile = userProfile(user);
  const firstName = String(editFirstName?.value || '').trim();
  const lastName = String(editLastName?.value || '').trim();
  const nameChanged =
    Boolean(user) &&
    ((firstName && firstName !== String(profile.firstName || '').trim()) ||
      (lastName && lastName !== String(profile.lastName || '').trim()));

  const heightRaw = String(editHeight?.value || '').trim();
  const nextHeight = heightRaw === '' ? null : Number(heightRaw);
  const currentHeight =
    profile.heightCm != null && Number.isFinite(Number(profile.heightCm))
      ? Number(profile.heightCm)
      : null;
  const heightChanged = Boolean(user) && nextHeight !== currentHeight;

  const nextBirth = normalizeBirthDate(birthDraftYmd) || null;
  const currentBirth = normalizeBirthDate(profile.birthDate) || null;
  const birthChanged = Boolean(user) && nextBirth !== currentBirth;

  const nextSex = String(editSex?.value || '').trim() || null;
  const sexChanged = Boolean(user) && nextSex !== (profile.sex || null);

  const nextGoal = String(editGoal?.value || '').trim() || null;
  const goalChanged = Boolean(user) && nextGoal !== (user.goal || null);

  const passwordIntent =
    Boolean(editNewPassword?.value) || Boolean(editConfirmPassword?.value);

  editSaveBtn.disabled = !(
    nameChanged ||
    heightChanged ||
    birthChanged ||
    sexChanged ||
    goalChanged ||
    passwordIntent
  );
}

function setEditStatus(message, kind = '') {
  if (!editStatusEl) return;
  if (!message) {
    editStatusEl.hidden = true;
    editStatusEl.textContent = '';
    editStatusEl.classList.remove('is-error', 'is-ok');
    return;
  }
  editStatusEl.hidden = false;
  editStatusEl.textContent = message;
  editStatusEl.classList.toggle('is-error', kind === 'error');
  editStatusEl.classList.toggle('is-ok', kind === 'ok');
}

function setCurrentPasswordError(message) {
  editCurrentPasswordField?.classList.add('is-invalid');
  editCurrentPassword?.setAttribute('aria-invalid', 'true');
  if (editCurrentPassword) {
    editCurrentPassword.value = '';
    editCurrentPassword.placeholder = message;
    editCurrentPassword.classList.remove('is-shake');
    // restart shake animation
    void editCurrentPassword.offsetWidth;
    editCurrentPassword.classList.add('is-shake');
    editCurrentPassword.focus();
  }
}

function clearCurrentPasswordError() {
  editCurrentPasswordField?.classList.remove('is-invalid');
  editCurrentPassword?.removeAttribute('aria-invalid');
  editCurrentPassword?.classList.remove('is-shake');
  if (editCurrentPassword) {
    editCurrentPassword.placeholder = currentPasswordDefaultPlaceholder;
  }
}

async function saveProfileEdits() {
  if (editBusy) return;
  if (editSaveBtn?.disabled) return;

  clearCurrentPasswordError();
  const { body, error } = buildEditPayload();
  if (error || !body) {
    setEditStatus(error || ui('profileEditNothing'), 'error');
    return;
  }

  editBusy = true;
  syncEditSaveEnabled();
  setEditStatus('');
  if (editSaveBtn) editSaveBtn.textContent = ui('profileEditSaving');

  try {
    const updated = await updateProfile(body);
    setUser(updated);
    clearPasswordFields();
    clearCurrentPasswordError();
    setEditStatus('');
    editBusy = false;
    closeEditPanel();
    syncProfileView();
  } catch (err) {
    console.error(err);
    if (err?.code === ApiErrorCode.CurrentPasswordIncorrect) {
      setCurrentPasswordError(ui('profileEditCurrentPasswordWrong'));
      setEditStatus('');
    } else {
      const message = mapApiError(err, { fallback: 'profileEditError' });
      setEditStatus(message, 'error');
    }
  } finally {
    editBusy = false;
    if (editSaveBtn) editSaveBtn.textContent = ui('profileEditSave');
    syncEditSaveEnabled();
  }
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
  const profile = userProfile(user);
  const first = String(profile.firstName || '').trim();
  const last = String(profile.lastName || '').trim();
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
  const profile = userProfile(user);
  const first = String(profile.firstName || '').trim();
  const last = String(profile.lastName || '').trim();
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

function formatSex(sex) {
  switch (String(sex || '')) {
    case 'male':
      return ui('profileSexMale');
    case 'female':
      return ui('profileSexFemale');
    case 'other':
      return ui('profileSexOther');
    case 'prefer_not_to_say':
      return ui('profileSexPreferNot');
    default:
      return '';
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
      return '';
  }
}

function metricIconSvg(kind) {
  const common =
    'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
  if (kind === 'height') {
    return `<svg ${common}><path d="M12 3v18"/><path d="M8 6h8"/><path d="M9 21h6"/><path d="M7 12h4"/><path d="M13 16h4"/></svg>`;
  }
  return `<svg ${common}><rect x="4" y="5" width="16" height="12" rx="2"/><path d="M8 17v2"/><path d="M16 17v2"/><path d="M8 11h8"/><circle cx="12" cy="9" r="1.2"/></svg>`;
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
