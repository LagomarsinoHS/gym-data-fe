/** Resolve API-relative media (images/…, videos/…) for Vite's public/ folder. */
export function assetUrl(path?: string): string {
  if (!path) return "";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const clean = String(path)
    .replace(/^\//, "")
    .replace(/^public\//, "");
  return `/${clean}`;
}
