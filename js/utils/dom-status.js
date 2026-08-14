/**
 * Inline status message helper (`.is-error` / `.is-ok`).
 * @param {HTMLElement | null | undefined} el
 * @param {string} [message]
 * @param {'' | 'error' | 'ok'} [kind]
 */
export function setInlineStatus(el, message = '', kind = '') {
  if (!el) return;
  if (!message) {
    el.hidden = true;
    el.textContent = '';
    el.classList.remove('is-error', 'is-ok');
    return;
  }
  el.hidden = false;
  el.textContent = message;
  el.classList.toggle('is-error', kind === 'error');
  el.classList.toggle('is-ok', kind === 'ok');
}
