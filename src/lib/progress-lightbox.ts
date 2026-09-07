export type ProgressLightboxItem = {
  url: string;
  title?: string;
  side: "front" | "back";
  yearMonth?: string;
};

export function buildProgressDownloadFilename({
  firstName,
  lastName,
  side,
  yearMonth,
  url,
}: {
  firstName?: string;
  lastName?: string;
  side?: "front" | "back";
  yearMonth?: string;
  url: string;
}) {
  const sideLabel = side === "back" ? "Back" : "Front";
  const parts = [firstName, lastName, sideLabel, yearMonth]
    .map((part) => sanitizeFilenamePart(part))
    .filter(Boolean);
  const base = parts.join("_") || "photo";
  return `${base}${extensionFromUrl(url)}`;
}

export async function downloadProgressPhoto(url: string, filename: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename;
    a.rel = "noopener";
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
  }
}

function sanitizeFilenamePart(value?: string) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[\\/:*?"<>|]+/g, "")
    .replace(/_+/g, "_");
}

function extensionFromUrl(url: string) {
  try {
    const path = new URL(url, window.location.href).pathname;
    const match = path.match(/\.(jpe?g|png|webp|gif)$/i);
    if (match) return `.${match[1].toLowerCase().replace("jpeg", "jpg")}`;
  } catch {
    /* ignore */
  }
  return ".jpg";
}
