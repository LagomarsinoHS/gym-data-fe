import { get, post, put } from './request.js';

/**
 * GET /coach/templates
 * Reusable session templates for the authenticated coach (enriched).
 * Returns { coachTemplates }
 */
export function getCoachTemplates() {
  return get('/coach/templates', undefined, { auth: true });
}

/**
 * POST /coach/templates
 * Creates a template; server assigns id. Body: { name, order?, items? }
 * Returns { template } enriched.
 */
export function postCoachTemplate({ name, order, items } = {}) {
  const body = { name };
  if (order != null) body.order = order;
  if (items != null) body.items = items;
  return post('/coach/templates', body, { auth: true });
}

/**
 * PUT /coach/templates
 * Replaces coachTemplates (full array). Items with exerciseId only.
 * Returns { coachTemplates } enriched.
 */
export function putCoachTemplates(coachTemplates) {
  return put(
    '/coach/templates',
    { coachTemplates },
    { auth: true },
  );
}

/**
 * POST /coach/templates/apply
 * Copies templates onto athlete plans (cartesian).
 * Body: { templateIds: string[], athleteIds: string[] }
 * Returns { applied, skipped, failedAthletes, failedTemplates, sessions }.
 */
export function applyCoachTemplates({ templateIds, athleteIds } = {}) {
  return post(
    '/coach/templates/apply',
    { templateIds, athleteIds },
    { auth: true },
  );
}
