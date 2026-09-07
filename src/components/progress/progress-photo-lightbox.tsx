import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useI18n } from "@/context/i18n-context";
import {
  buildProgressDownloadFilename,
  downloadProgressPhoto,
  type ProgressLightboxItem,
} from "@/lib/progress-lightbox";

export function ProgressPhotoLightbox({
  open,
  items,
  index,
  firstName,
  lastName,
  onClose,
}: {
  open: boolean;
  items: ProgressLightboxItem[];
  index: number;
  firstName?: string;
  lastName?: string;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [current, setCurrent] = useState(index);
  const [busy, setBusy] = useState(false);
  const downloadRef = useRef<HTMLButtonElement>(null);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  useEffect(() => {
    setCurrent(index);
  }, [index, items]);

  useEffect(() => {
    if (!open) return;
    downloadRef.current?.focus();
  }, [open, current]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      const total = itemsRef.current.length;
      if (total <= 1) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        setCurrent((prev) => (prev - 1 + total) % total);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        setCurrent((prev) => (prev + 1) % total);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const item = items[current];
  const showNav = items.length > 1;

  function step(delta: number) {
    if (items.length <= 1) return;
    setCurrent((prev) => (prev + delta + items.length) % items.length);
  }

  async function onDownload() {
    if (!item?.url || busy) return;
    setBusy(true);
    try {
      await downloadProgressPhoto(
        item.url,
        buildProgressDownloadFilename({
          firstName,
          lastName,
          side: item.side,
          yearMonth: item.yearMonth,
          url: item.url,
        }),
      );
    } finally {
      setBusy(false);
    }
  }

  if (!open || !item) return null;

  return createPortal(
    <div
      className="progress-photo-lightbox"
      id="progress-photo-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby="progress-photo-lightbox-title"
    >
      <button
        type="button"
        className="progress-photo-lightbox-backdrop"
        id="progress-photo-lightbox-backdrop"
        aria-label="Close"
        onClick={onClose}
      />
      <button
        type="button"
        className="progress-photo-lightbox-nav is-prev"
        id="progress-photo-lightbox-prev"
        hidden={!showNav}
        aria-label={t("progressPhotosComparePrev")}
        onClick={() => step(-1)}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10 3L5 8l5 5" />
        </svg>
      </button>
      <button
        type="button"
        className="progress-photo-lightbox-nav is-next"
        id="progress-photo-lightbox-next"
        hidden={!showNav}
        aria-label={t("progressPhotosCompareNext")}
        onClick={() => step(1)}
      >
        <svg
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M6 3l5 5-5 5" />
        </svg>
      </button>
      <div className="progress-photo-lightbox-panel">
        <div className="progress-photo-lightbox-bar">
          <h2 className="progress-photo-lightbox-title" id="progress-photo-lightbox-title">
            {item.title || ""}
          </h2>
          <div className="progress-photo-lightbox-actions">
            <button
              type="button"
              className="progress-photo-lightbox-download"
              id="progress-photo-lightbox-download"
              ref={downloadRef}
              disabled={busy}
              onClick={() => void onDownload()}
            >
              <span>{t("progressPhotosDownload")}</span>
            </button>
            <button
              type="button"
              className="modal-close"
              id="progress-photo-lightbox-close"
              aria-label="Close"
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>
        <img
          className="progress-photo-lightbox-img"
          id="progress-photo-lightbox-img"
          src={item.url}
          alt={item.title || ""}
        />
      </div>
    </div>,
    document.body,
  );
}
