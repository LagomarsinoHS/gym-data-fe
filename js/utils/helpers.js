export function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/** Lowercase + strip accents/diacritics for accent-insensitive search. */
export function normalizeSearch(text) {
  return String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** First occurrence wins; identity via `exercise.id`. */
export function dedupeById(list) {
  const seen = new Set();
  return list.filter(exercise => {
    const id = String(exercise.id);
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}
