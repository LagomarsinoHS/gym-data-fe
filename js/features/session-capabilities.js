/**
 * Pure role / subscription capability checks.
 * Bind the session user getter via `bindSessionUser` from session-ui (avoids cycles).
 */

/** @type {() => object | null} */
let getUserRef = () => null;

/** Wire the live session user getter (called once from session-ui). */
export function bindSessionUser(getter) {
  if (typeof getter === 'function') getUserRef = getter;
}

export function isCoach(u = getUserRef()) {
  if (!u) return false;
  return u.role === 'coach';
}

export function isAdmin(u = getUserRef()) {
  if (!u) return false;
  return u.role === 'admin';
}

export function isAthlete(u = getUserRef()) {
  if (!u) return false;
  return u.role === 'athlete';
}

export function hasCoach(u = getUserRef()) {
  return Boolean(u?.coachId);
}

/** True when GET /users/me has subscription.plan === 'premium'. */
export function isPremium(u = getUserRef()) {
  return u?.subscription?.plan === 'premium';
}

/** True when subscription.plan is a paid tier (not free). */
export function isPaidPlan(u = getUserRef()) {
  const plan = String(u?.subscription?.plan || 'free');
  return plan === 'premium' || plan === 'growth' || plan === 'pro';
}

/**
 * Acceso a “Recomendar Entrenamiento”.
 * Gate: athlete + subscription.plan === 'premium' (GET /users/me).
 */
export function canAccessRecommendPlan(u = getUserRef()) {
  if (!u || !isAthlete(u)) return false;
  return isPremium(u);
}

/**
 * Coach access to “Analizar con IA” on athlete progress photos.
 * Gate: coach + subscription.plan !== 'free'.
 */
export function canAccessProgressAiAnalysis(u = getUserRef()) {
  if (!u || !isCoach(u)) return false;
  return isPaidPlan(u);
}

/** Coach can open/send athlete invites (coachQuota.canInvite from GET /users/me). */
export function canInviteAthlete(u = getUserRef()) {
  if (!u || !isCoach(u)) return false;
  return Boolean(u.coachQuota?.canInvite);
}
