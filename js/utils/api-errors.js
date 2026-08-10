import { ui } from './labels.js';

/** Stable codes mirrored from gym-data-be `ApiErrorCode`. */
export const ApiErrorCode = {
  CoachAthleteQuotaFull: 'COACH_ATHLETE_QUOTA_FULL',
  EmailNotAnAthlete: 'EMAIL_NOT_AN_ATHLETE',
  AthleteHasPendingInvite: 'ATHLETE_HAS_PENDING_INVITE',
  NoPendingCoachInvite: 'NO_PENDING_COACH_INVITE',
  CurrentPasswordIncorrect: 'CURRENT_PASSWORD_INCORRECT',
};

/**
 * Map API errors to UI copy.
 * Prefer `err.code` (stable). Fallback UI key when unknown.
 *
 * @param {Error & { code?: string|null, status?: number }} err
 * @param {{ byCode?: Record<string, string>, fallback: string }} opts
 *   byCode values are `ui()` keys
 */
export function mapApiError(err, { byCode = {}, fallback } = {}) {
  const key = err?.code && byCode[err.code] ? byCode[err.code] : fallback;
  return ui(key);
}
