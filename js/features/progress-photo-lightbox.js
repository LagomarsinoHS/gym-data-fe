/**
 * Shared progress-photo lightbox (coach + athlete Avances).
 * Markup: #progress-photo-lightbox
 * Optional gallery: pass `items` + `index` to enable prev/next (wraps around).
 */
import { ui } from '../utils/labels.js';

let lightboxEl;
let lightboxImgEl;
let lightboxTitleEl;
let lightboxCloseBtn;
let lightboxDownloadBtn;
let lightboxBackdrop;
let lightboxPrevBtn;
let lightboxNextBtn;
let wired = false;

/** @type {{ url: string, filename: string } | null} */
let current = null;

/** @type {Array<{ url: string, title?: string, side: 'front' | 'back', yearMonth?: string }>} */
let galleryItems = [];
let galleryIndex = 0;
/** @type {{ firstName?: string, lastName?: string } | null} */
let athleteName = null;

export function initProgressPhotoLightbox() {
  lightboxEl = document.getElementById('progress-photo-lightbox');
  lightboxImgEl = document.getElementById('progress-photo-lightbox-img');
  lightboxTitleEl = document.getElementById('progress-photo-lightbox-title');
  lightboxCloseBtn = document.getElementById('progress-photo-lightbox-close');
  lightboxDownloadBtn = document.getElementById('progress-photo-lightbox-download');
  lightboxBackdrop = document.getElementById('progress-photo-lightbox-backdrop');
  lightboxPrevBtn = document.getElementById('progress-photo-lightbox-prev');
  lightboxNextBtn = document.getElementById('progress-photo-lightbox-next');

  if (wired) return;
  wired = true;

  lightboxCloseBtn?.addEventListener('click', closeProgressPhotoLightbox);
  lightboxBackdrop?.addEventListener('click', closeProgressPhotoLightbox);
  lightboxDownloadBtn?.addEventListener('click', () => {
    void downloadCurrentPhoto();
  });
  lightboxPrevBtn?.addEventListener('click', () => stepGallery(-1));
  lightboxNextBtn?.addEventListener('click', () => stepGallery(1));
  document.addEventListener('keydown', event => {
    if (!lightboxEl || lightboxEl.hidden) return;
    if (event.key === 'Escape') {
      closeProgressPhotoLightbox();
      return;
    }
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      stepGallery(-1);
      return;
    }
    if (event.key === 'ArrowRight') {
      event.preventDefault();
      stepGallery(1);
    }
  });
}

/**
 * @param {{
 *   url?: string,
 *   title?: string,
 *   side?: 'front' | 'back',
 *   yearMonth?: string,
 *   firstName?: string,
 *   lastName?: string,
 *   items?: Array<{ url: string, title?: string, side: 'front' | 'back', yearMonth?: string }>,
 *   index?: number,
 * }} opts
 */
export function openProgressPhotoLightbox(opts) {
  initProgressPhotoLightbox();
  if (!lightboxEl || !lightboxImgEl || !lightboxTitleEl) return;

  const items =
    Array.isArray(opts?.items) && opts.items.length > 0
      ? opts.items.filter(item => item?.url)
      : opts?.url
        ? [
            {
              url: String(opts.url).trim(),
              title: opts.title || '',
              side: opts.side === 'back' ? 'back' : 'front',
              yearMonth: opts.yearMonth,
            },
          ]
        : [];

  if (items.length === 0) return;

  let index = Number.isInteger(opts?.index) ? opts.index : 0;
  if (index < 0 || index >= items.length) {
    const byUrl = opts?.url
      ? items.findIndex(item => item.url === opts.url)
      : -1;
    index = byUrl >= 0 ? byUrl : 0;
  }

  galleryItems = items;
  galleryIndex = index;
  athleteName = {
    firstName: opts?.firstName,
    lastName: opts?.lastName,
  };

  showGalleryItem();
  lightboxEl.hidden = false;
  updateNavVisibility();
  (lightboxDownloadBtn || lightboxCloseBtn)?.focus();
}

export function closeProgressPhotoLightbox() {
  if (!lightboxEl || lightboxEl.hidden) return;
  lightboxEl.hidden = true;
  current = null;
  galleryItems = [];
  galleryIndex = 0;
  athleteName = null;
  if (lightboxImgEl) {
    lightboxImgEl.removeAttribute('src');
    lightboxImgEl.alt = '';
  }
  if (lightboxTitleEl) lightboxTitleEl.textContent = '';
  updateNavVisibility();
}

function stepGallery(delta) {
  if (galleryItems.length <= 1) return;
  galleryIndex =
    (galleryIndex + delta + galleryItems.length) % galleryItems.length;
  showGalleryItem();
}

function showGalleryItem() {
  const item = galleryItems[galleryIndex];
  if (!item || !lightboxImgEl || !lightboxTitleEl) return;

  const title = item.title || '';
  const filename = buildDownloadFilename({
    firstName: athleteName?.firstName,
    lastName: athleteName?.lastName,
    side: item.side,
    yearMonth: item.yearMonth,
    url: item.url,
  });

  current = { url: item.url, filename };
  lightboxTitleEl.textContent = title;
  lightboxImgEl.src = item.url;
  lightboxImgEl.alt = title;

  if (lightboxDownloadBtn) {
    lightboxDownloadBtn.hidden = false;
    lightboxDownloadBtn.disabled = false;
    const label = lightboxDownloadBtn.querySelector('[data-ui]');
    if (label) label.textContent = ui('progressPhotosDownload');
    else lightboxDownloadBtn.setAttribute('aria-label', ui('progressPhotosDownload'));
  }
}

function updateNavVisibility() {
  const show = galleryItems.length > 1;
  if (lightboxPrevBtn) {
    lightboxPrevBtn.hidden = !show;
    lightboxPrevBtn.setAttribute(
      'aria-label',
      ui('progressPhotosComparePrev') || 'Previous',
    );
  }
  if (lightboxNextBtn) {
    lightboxNextBtn.hidden = !show;
    lightboxNextBtn.setAttribute(
      'aria-label',
      ui('progressPhotosCompareNext') || 'Next',
    );
  }
}

function buildDownloadFilename({ firstName, lastName, side, yearMonth, url }) {
  const sideLabel = side === 'back' ? 'Back' : 'Front';
  const parts = [firstName, lastName, sideLabel, yearMonth]
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
