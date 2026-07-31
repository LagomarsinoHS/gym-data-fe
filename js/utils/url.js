export function exerciseShareUrl(id) {
  const url = new URL(window.location.href);
  url.searchParams.set('exercise', id);
  url.hash = '';
  return url.toString();
}

export function readExerciseFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get('exercise');
  if (fromQuery) return fromQuery.trim();

  const hash = window.location.hash.replace(/^#/, '').trim();
  if (/^\d+$/.test(hash)) return hash;
  return null;
}

export function syncExerciseInUrl(id) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set('exercise', id);
  else url.searchParams.delete('exercise');
  if (/^\d+$/.test(url.hash.replace(/^#/, ''))) url.hash = '';
  history.replaceState(null, '', url);
}
