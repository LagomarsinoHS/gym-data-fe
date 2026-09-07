const UPLOAD_MARKER = "/upload/";

export function cloudinaryDeliveryUrl(url: string, transformation: string) {
  const raw = String(url || "").trim();
  const transform = String(transformation || "").trim();
  if (!raw || !transform) return raw;
  const idx = raw.indexOf(UPLOAD_MARKER);
  if (idx < 0) return raw;
  const head = raw.slice(0, idx + UPLOAD_MARKER.length);
  const tail = raw.slice(idx + UPLOAD_MARKER.length);
  if (tail.startsWith(`${transform}/`)) return raw;
  return `${head}${transform}/${tail}`;
}

export function progressPhotoThumbUrl(url: string) {
  return cloudinaryDeliveryUrl(url, "c_fit,w_480,h_640,q_auto,f_auto");
}
