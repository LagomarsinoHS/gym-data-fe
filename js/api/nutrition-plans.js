/**
 * Nutrition plans API.
 * Note: create / update / getNutritionPlan are wired for the coach editor (next);
 * list / archive / delete are used by athlete + coach plan UIs today.
 */
import { get, post, put, patch, deleteRequest } from './request.js';

const PLANS = '/nutrition-plans';

/**
 * POST /nutrition-plans
 * Coach creates a plan for an assigned athlete.
 * Body: { athleteId, title, goal?, validFrom, validUntil?, targets, meals?, generalNotes? }
 */
export function createNutritionPlan(body) {
  return post(PLANS, body, { auth: true });
}

/**
 * GET /nutrition-plans
 * Athlete: own plans. Coach: pass athleteId (plans they created for that athlete).
 * Optional status: 'active' | 'archived'.
 * Returns { data: NutritionPlan[] }
 */
export function listNutritionPlans({ athleteId, status } = {}) {
  return get(PLANS, { athleteId, status }, { auth: true });
}

/**
 * GET /nutrition-plans/:planId
 */
export function getNutritionPlan(planId) {
  return get(`${PLANS}/${planId}`, {}, { auth: true });
}

/**
 * PUT /nutrition-plans/:planId
 * Coach updates an active plan they created (still assigned).
 */
export function updateNutritionPlan(planId, body) {
  return put(`${PLANS}/${planId}`, body, { auth: true });
}

/**
 * PATCH /nutrition-plans/:planId/archive
 * Coach archives a plan they created (still assigned). Idempotent.
 */
export function archiveNutritionPlan(planId) {
  return patch(`${PLANS}/${planId}/archive`, {}, { auth: true });
}

/**
 * DELETE /nutrition-plans/:planId
 * Athlete soft-deletes an archived plan of their own (`deletedAt`).
 */
export function deleteNutritionPlan(planId) {
  return deleteRequest(`${PLANS}/${planId}`, undefined, { auth: true });
}
