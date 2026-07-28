const PUBLIC_BASE = 'public';

/** Resolve API-relative media paths (images/…, videos/…) against /public. */
export function assetUrl(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const clean = String(path).replace(/^\//, '');
  if (clean.startsWith(`${PUBLIC_BASE}/`)) return clean;
  return `${PUBLIC_BASE}/${clean}`;
}
