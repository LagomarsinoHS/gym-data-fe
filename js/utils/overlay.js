/**
 * Bind common modal/overlay chrome: close buttons, backdrop click, Escape.
 *
 * @param {{
 *   overlay: HTMLElement | null | undefined,
 *   closeSelectors?: string[],
 *   onClose: () => void,
 *   stopEscapePropagation?: boolean,
 * }} opts
 * @returns {() => void} unbind
 */
export function bindOverlay({
  overlay,
  closeSelectors = [],
  onClose,
  stopEscapePropagation = false,
}) {
  if (!overlay || typeof onClose !== 'function') return () => {};

  const onBackdrop = (event) => {
    if (event.target === overlay) onClose();
  };
  overlay.addEventListener('click', onBackdrop);

  /** @type {Array<() => void>} */
  const cleanups = [() => overlay.removeEventListener('click', onBackdrop)];

  for (const selector of closeSelectors) {
    const nodes = selector.startsWith('#')
      ? [document.getElementById(selector.slice(1))].filter(Boolean)
      : [...document.querySelectorAll(selector)];
    for (const node of nodes) {
      const handler = () => onClose();
      node.addEventListener('click', handler);
      cleanups.push(() => node.removeEventListener('click', handler));
    }
  }

  const onKeydown = (event) => {
    if (event.key !== 'Escape') return;
    if (!overlay.classList.contains('open')) return;
    if (stopEscapePropagation) event.stopImmediatePropagation();
    onClose();
  };
  document.addEventListener('keydown', onKeydown);
  cleanups.push(() => document.removeEventListener('keydown', onKeydown));

  return () => {
    for (const cleanup of cleanups) cleanup();
  };
}

export function openOverlay(overlay) {
  overlay?.classList.add('open');
}

export function closeOverlay(overlay) {
  overlay?.classList.remove('open');
}
