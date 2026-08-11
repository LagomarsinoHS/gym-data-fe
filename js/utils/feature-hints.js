/**
 * One-shot contextual feature hints (localStorage).
 * Easy to later map the same ids onto BE user flags.
 */

const HINTS_KEY = 'steelPulse.featureHints';

/** @typedef {'reorder-sessions' | 'reorder-exercises'} FeatureHintId */

/**
 * @returns {Record<string, true>}
 */
function readSeen() {
  try {
    const raw = localStorage.getItem(HINTS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}

/**
 * @param {Record<string, true>} seen
 */
function writeSeen(seen) {
  try {
    localStorage.setItem(HINTS_KEY, JSON.stringify(seen));
  } catch {
    /* private mode / quota */
  }
}

/** @param {FeatureHintId | string} id */
export function hasSeenFeatureHint(id) {
  const key = String(id || '');
  if (!key) return true;
  return Boolean(readSeen()[key]);
}

/** @param {FeatureHintId | string} id */
export function markFeatureHintSeen(id) {
  const key = String(id || '');
  if (!key) return;
  const seen = readSeen();
  if (seen[key]) return;
  seen[key] = true;
  writeSeen(seen);
}

/**
 * Compact dismissible tip. Returns null if already seen.
 * @param {{ id: FeatureHintId | string, text: string, dismissLabel: string, className?: string }} opts
 * @returns {HTMLElement | null}
 */
export function createFeatureHint({ id, text, dismissLabel, className = '' }) {
  if (hasSeenFeatureHint(id)) return null;

  const tip = document.createElement('div');
  tip.className = ['feature-hint', className].filter(Boolean).join(' ');
  tip.dataset.hintId = String(id);
  tip.setAttribute('role', 'status');

  const bubble = document.createElement('div');
  bubble.className = 'feature-hint-bubble';

  const msg = document.createElement('p');
  msg.className = 'feature-hint-text';
  msg.textContent = text;

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'feature-hint-dismiss';
  dismiss.textContent = dismissLabel;
  dismiss.addEventListener('click', e => {
    e.stopPropagation();
    dismissFeatureHint(tip, id);
  });

  const tail = document.createElement('span');
  tail.className = 'feature-hint-tail';
  tail.setAttribute('aria-hidden', 'true');

  bubble.append(msg, dismiss);
  tip.append(bubble, tail);
  return tip;
}

/**
 * @param {HTMLElement | null | undefined} tip
 * @param {FeatureHintId | string} [id]
 */
export function dismissFeatureHint(tip, id) {
  const hintId = id || tip?.dataset?.hintId;
  if (hintId) markFeatureHintSeen(hintId);
  tip?.remove();
}

/**
 * Remove any tip still mounted for this id and mark seen.
 * @param {FeatureHintId | string} id
 * @param {ParentNode | Document} [root]
 */
export function dismissFeatureHintById(id, root = document) {
  markFeatureHintSeen(id);
  const key = String(id || '');
  root.querySelectorAll('.feature-hint').forEach(el => {
    if (el instanceof HTMLElement && el.dataset.hintId === key) el.remove();
  });
}
