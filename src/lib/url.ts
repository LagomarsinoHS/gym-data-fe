export function exerciseShareUrl(id: string): string {
  const url = new URL(window.location.href);
  url.searchParams.set("exercise", id);
  url.hash = "";
  return url.toString();
}

export function readExerciseFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  const fromQuery = params.get("exercise");
  if (fromQuery) return fromQuery.trim();

  const hash = window.location.hash.replace(/^#/, "").trim();
  if (/^\d+$/.test(hash)) return hash;
  return null;
}
