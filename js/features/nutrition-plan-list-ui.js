/**
 * Shared nutrition plan list (active + archived) for athlete and coach views.
 */
import { ui } from '../utils/labels.js';
import {
  createMacrosRow,
  createPlanBody,
  el,
  formatMonthYear,
  formatShortDate,
} from './nutrition-plan-render.js';

/**
 * @param {HTMLElement} root
 * @param {{
 *   plans: object[],
 *   openCurrentId: string | null,
 *   openArchivedId: string | null,
 *   activeTitle: string,
 *   archivedTitle: string,
 *   currentSubtitle: (plan: object) => string,
 *   archivedMeta: (plan: object) => string,
 *   onToggleCurrent: (planId: string) => void,
 *   onToggleArchived: (planId: string) => void,
 *   appendCurrentActions?: (plan: object, actionsEl: HTMLElement) => void,
 *   appendArchivedActions?: (plan: object, itemEl: HTMLElement) => void,
 *   onCreatePlan?: () => void,
 *   createPlanLabel?: string,
 * }} opts
 */
export function renderNutritionPlansList(root, {
  plans,
  openCurrentId,
  openArchivedId,
  activeTitle,
  archivedTitle,
  currentSubtitle,
  archivedMeta,
  onToggleCurrent,
  onToggleArchived,
  appendCurrentActions,
  appendArchivedActions,
  onCreatePlan,
  createPlanLabel,
}) {
  root.replaceChildren();

  const active = plans.filter((plan) => plan.status !== 'archived');
  const archived = plans.filter((plan) => plan.status === 'archived');
  const coachLayout = typeof appendCurrentActions === 'function';
  const createBtn = typeof onCreatePlan === 'function'
    ? createNewPlanButton(createPlanLabel, onCreatePlan)
    : null;

  if (active.length) {
    const section = el('section', 'athlete-nutrition-section');
    if (createBtn) {
      const header = el('div', 'athlete-nutrition-group-header is-actions-only');
      header.append(createBtn);
      section.append(header);
    } else if (activeTitle) {
      section.append(el('h3', 'athlete-nutrition-group-title', activeTitle));
    }
    const list = el('div', 'athlete-nutrition-current-list');
    for (const plan of active) {
      list.append(createCurrentCard(plan, {
        open: Boolean(plan?.id) && String(plan.id) === openCurrentId,
        currentSubtitle,
        onToggleCurrent,
        appendCurrentActions,
        coachLayout,
      }));
    }
    section.append(list);
    root.append(section);
  }

  if (archived.length) {
    const section = el('section', 'athlete-nutrition-section');
    const archivedCreate = !active.length ? createBtn : null;
    section.append(createGroupHeader(archivedTitle, archivedCreate));
    const list = el('div', 'athlete-nutrition-archive-list');
    for (const plan of archived) {
      list.append(createArchivedItem(plan, {
        open: Boolean(plan?.id) && String(plan.id) === openArchivedId,
        archivedMeta,
        onToggleArchived,
        appendArchivedActions,
        coachLayout,
      }));
    }
    section.append(list);
    root.append(section);
  }
}

function createGroupHeader(title, actionEl) {
  if (!actionEl) return el('h3', 'athlete-nutrition-group-title', title);
  const header = el('div', 'athlete-nutrition-group-header');
  header.append(el('h3', 'athlete-nutrition-group-title', title), actionEl);
  return header;
}

function createNewPlanButton(label, onCreatePlan) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'athlete-nutrition-new-btn';
  btn.textContent = label || '+';
  btn.addEventListener('click', (event) => {
    event.preventDefault();
    onCreatePlan();
  });
  return btn;
}

function createCurrentCard(plan, {
  open,
  currentSubtitle,
  onToggleCurrent,
  appendCurrentActions,
  coachLayout,
}) {
  const id = String(plan?.id || '');
  const card = el('article', `athlete-nutrition-current-card${open ? ' is-open' : ''}`);
  if (id) card.dataset.planId = id;

  const summary = el('div', 'athlete-nutrition-current-summary');
  const top = el('div', 'athlete-nutrition-current-top');
  top.append(
    el('span', 'athlete-nutrition-month', formatMonthYear(plan?.validFrom)),
    el('span', 'athlete-nutrition-status', ui('athleteNutritionStatusActive')),
  );
  summary.append(top);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'athlete-nutrition-view-btn';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.append(
    el('span', 'athlete-nutrition-view-label', ui(open ? 'athleteNutritionHidePlan' : 'athleteNutritionViewPlan')),
    el('span', 'athlete-nutrition-view-arrow', open ? '↑' : '→'),
  );
  toggle.addEventListener('click', () => {
    if (!id) return;
    onToggleCurrent(id);
  });

  const footer = el('div', 'athlete-nutrition-current-footer');
  const validText = coachLayout
    ? ui('athleteNutritionValidFrom', formatShortDate(plan?.validFrom))
    : plan?.validFrom
      ? ui('athleteNutritionValidFrom', formatShortDate(plan.validFrom))
      : '';

  footer.append(el('p', 'athlete-nutrition-valid', validText));

  if (coachLayout) {
    const footerActions = el('div', 'athlete-nutrition-current-footer-actions');
    appendCurrentActions?.(plan, footerActions);
    footerActions.append(toggle);
    footer.append(footerActions);
  } else {
    footer.append(toggle);
  }

  summary.append(
    el('p', 'athlete-nutrition-subtitle-line', currentSubtitle(plan)),
    createMacrosRow(plan?.targets),
    footer,
  );

  const body = el('div', 'athlete-nutrition-detail');
  if (open) body.append(createPlanBody(plan, { includeTargets: false, includeTitle: false }));

  card.append(summary, body);
  return card;
}

function createArchivedItem(plan, {
  open,
  archivedMeta,
  onToggleArchived,
  appendArchivedActions,
  coachLayout,
}) {
  const id = String(plan?.id || '');
  const item = el('section', `athlete-nutrition-archive-item${open ? ' is-open' : ''}`);
  if (id) item.dataset.planId = id;

  appendArchivedActions?.(plan, item);

  const header = document.createElement('button');
  header.type = 'button';
  header.className = `athlete-nutrition-archive-header${coachLayout ? ' is-coach' : ''}`;
  header.setAttribute('aria-expanded', String(open));

  const heading = el('span', 'athlete-nutrition-archive-heading');
  const planTitle = String(plan?.title || '').trim() || formatMonthYear(plan?.validFrom);
  heading.append(
    el('span', 'athlete-nutrition-month', planTitle),
    el('span', 'athlete-nutrition-archive-meta', archivedMeta(plan)),
  );
  const chevron = el('span', 'athlete-nutrition-chevron');
  chevron.setAttribute('aria-hidden', 'true');
  header.append(heading, chevron);
  header.addEventListener('click', () => {
    if (!id) return;
    onToggleArchived(id);
  });

  const body = el('div', 'athlete-nutrition-detail');
  if (open) body.append(createPlanBody(plan, { includeTargets: true, includeTitle: true }));

  item.append(header, body);
  return item;
}
