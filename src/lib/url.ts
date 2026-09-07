export function exerciseShareUrl(id: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("exercise", id);
  url.hash = "";
  return url.toString();
}

export function safeInternalPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  if (!path.startsWith("/")) return null;
  if (path.startsWith("//") || path.includes("://") || path.includes("\\")) return null;
  return path;
}

export function readExerciseFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("exercise");
  if (fromQuery) return fromQuery.trim();

  const hash = window.location.hash.replace(/^#/, "").trim();
  if (/^\d+$/.test(hash)) return hash;
  return null;
}
