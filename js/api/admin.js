import { deleteRequest, get, post } from './request.js';

const ADMIN = '/admin';

/** GET /admin/stats — requires admin JWT */
export function getAdminStats() {
  return get(`${ADMIN}/stats`, {}, { auth: true });
}

/**
 * GET /admin/users — paginated list (active users only).
 * @param {{ page?: number, limit?: number, search?: string, role?: string, plan?: string, expiringSoon?: boolean, sortBy?: string, sortDir?: string }} [params]
 */
export function getAdminUsers(params = {}) {
  return get(`${ADMIN}/users`, normalizeAdminUsersQuery(params), { auth: true });
}

/**
 * POST /admin/subscriptions/grant
 * @param {{ email: string, plan: string, durationDays?: number, expiresAt?: string }} body
 */
export function grantAdminSubscription(body) {
  return post(`${ADMIN}/subscriptions/grant`, body, { auth: true });
}

/**
 * POST /admin/subscriptions/revoke
 * @param {{ email: string }} body
 */
export function revokeAdminSubscription(body) {
  return post(`${ADMIN}/subscriptions/revoke`, body, { auth: true });
}

/**
 * DELETE /admin/users/:userId — soft-delete (sets deletedAt).
 * @param {string} userId
 */
export function softDeleteAdminUser(userId) {
  return deleteRequest(`${ADMIN}/users/${userId}`, undefined, {
    auth: true,
  });
}

// ── Internals ─────────────────────────────────────────────────────────

function normalizeAdminUsersQuery(params = {}) {
  const query = { ...params };
  if (query.expiringSoon === true) query.expiringSoon = 'true';
  else if (query.expiringSoon === false) delete query.expiringSoon;
  return query;
}
