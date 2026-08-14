import { ui } from './labels.js';

export function formatWeight(weight) {
  if (weight == null || weight === '') return '—';
  if (typeof weight === 'number' && Number.isFinite(weight)) {
    return `${weight} kg`;
  }
  const text = String(weight).trim();
  return text || '—';
}

/** @returns {string | null} */
export function formatHeightCm(heightCm) {
  if (heightCm == null || heightCm === '') return null;
  const n = Number(heightCm);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n)} cm`;
}

export function formatSex(sex) {
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

export function formatGoal(goal) {
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
