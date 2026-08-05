/**
 * Cloudinary delivery helpers (FE-only).
 * Mongo still stores the original secure_url; thumbs are derived at render time.
 */

const UPLOAD_MARKER = '/upload/';

/**
 * Insert a transformation segment after `/upload/` in a Cloudinary URL.
 * Non-Cloudinary URLs are returned unchanged.
 *
 * @param {string} url
 * @param {string} transformation e.g. `c_fill,w_480,h_640,q_auto,f_auto`
 */
export function cloudinaryDeliveryUrl(url, transformation) {
  const raw = String(url || '').trim();
  const transform = String(transformation || '').trim();
  if (!raw || !transform) return raw;

  const idx = raw.indexOf(UPLOAD_MARKER);
  if (idx < 0) return raw;

  const head = raw.slice(0, idx + UPLOAD_MARKER.length);
  const tail = raw.slice(idx + UPLOAD_MARKER.length);
  if (tail.startsWith(`${transform}/`)) return raw;

  return `${head}${transform}/${tail}`;
}

/**
 * Thumbnail for progress-photo cards / timeline / compare grids.
 * Lightbox and downloads should keep using the original URL.
 */
export function progressPhotoThumbUrl(url) {
  return cloudinaryDeliveryUrl(url, 'c_fill,w_480,h_640,q_auto,f_auto');
}
