/**
 * Shared progress-photo lightbox (coach + athlete Avances).
 * Markup: #progress-photo-lightbox
 */
import { ui } from '../utils/labels.js';

let lightboxEl;
let lightboxImgEl;
let lightboxTitleEl;
let lightboxCloseBtn;
let lightboxDownloadBtn;
let lightboxBackdrop;
let wired = false;

/** @type {{ url: string, filename: string } | null} */
let current = null;

export function initProgressPhotoLightbox() {
  lightboxEl = document.getElementById('progress-photo-lightbox');
  lightboxImgEl = document.getElementById('progress-photo-lightbox-img');
  lightboxTitleEl = document.getElementById('progress-photo-lightbox-title');
  lightboxCloseBtn = document.getElementById('progress-photo-lightbox-close');
  lightboxDownloadBtn = document.getElementById('progress-photo-lightbox-download');
  lightboxBackdrop = document.getElementById('progress-photo-lightbox-backdrop');

  if (wired) return;
  wired = true;

  lightboxCloseBtn?.addEventListener('click', closeProgressPhotoLightbox);
  lightboxBackdrop?.addEventListener('click', closeProgressPhotoLightbox);
  lightboxDownloadBtn?.addEventListener('click', () => {
    void downloadCurrentPhoto();
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (!lightboxEl || lightboxEl.hidden) return;
    closeProgressPhotoLightbox();
  });
}

/**
 * @param {{ url: string, title?: string, firstName?: string, lastName?: string, side: 'front' | 'back' }} opts
 */
export function openProgressPhotoLightbox(opts) {
  initProgressPhotoLightbox();
  const url = String(opts?.url || '').trim();
  if (!lightboxEl || !lightboxImgEl || !lightboxTitleEl || !url) return;

  const title = opts.title || '';
  const filename = buildDownloadFilename({
    firstName: opts.firstName,
    lastName: opts.lastName,
    side: opts.side,
    url,
  });

  current = { url, filename };
  lightboxTitleEl.textContent = title;
  lightboxImgEl.src = url;
  lightboxImgEl.alt = title;
  if (lightboxDownloadBtn) {
    lightboxDownloadBtn.hidden = false;
    lightboxDownloadBtn.disabled = false;
    const label = lightboxDownloadBtn.querySelector('[data-ui]');
    if (label) label.textContent = ui('progressPhotosDownload');
    else lightboxDownloadBtn.setAttribute('aria-label', ui('progressPhotosDownload'));
  }
  lightboxEl.hidden = false;
  (lightboxDownloadBtn || lightboxCloseBtn)?.focus();
}

export function closeProgressPhotoLightbox() {
  if (!lightboxEl || lightboxEl.hidden) return;
  lightboxEl.hidden = true;
  current = null;
  if (lightboxImgEl) {
    lightboxImgEl.removeAttribute('src');
    lightboxImgEl.alt = '';
  }
  if (lightboxTitleEl) lightboxTitleEl.textContent = '';
}

function buildDownloadFilename({ firstName, lastName, side, url }) {
  const sideLabel = side === 'back' ? 'Back' : 'Front';
  const parts = [firstName, lastName, sideLabel]
    .map(part => sanitizeFilenamePart(part))
    .filter(Boolean);
  const base = parts.join('_') || 'photo';
  return `${base}${extensionFromUrl(url)}`;
}

function sanitizeFilenamePart(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, '')
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/_+/g, '_');
}

function extensionFromUrl(url) {
  try {
    const path = new URL(url, window.location.href).pathname;
    const match = path.match(/\.(jpe?g|png|webp|gif)$/i);
    if (match) return `.${match[1].toLowerCase().replace('jpeg', 'jpg')}`;
  } catch {
    /* ignore */
  }
  return '.jpg';
}

async function downloadCurrentPhoto() {
  if (!current?.url || !lightboxDownloadBtn) return;
  lightboxDownloadBtn.disabled = true;
  try {
    const res = await fetch(current.url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = current.filename;
    a.rel = 'noopener';
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  } catch {
    // Fallback: open in new tab if CORS/fetch blocks download.
    window.open(current.url, '_blank', 'noopener,noreferrer');
  } finally {
    lightboxDownloadBtn.disabled = false;
  }
}
