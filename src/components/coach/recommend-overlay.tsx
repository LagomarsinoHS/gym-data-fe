import type { ReactNode } from "react";

export function RecommendOverlay({
  open,
  titleId,
  title,
  confirm = false,
  onClose,
  children,
}: {
  open: boolean;
  titleId: string;
  title: string;
  confirm?: boolean;
  onClose: () => void;
  children: ReactNode;
}) {
  if (!open) return null;
  return (
    <div
      className="recommend-overlay open"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={`recommend-modal${confirm ? " confirm-modal" : ""}`}>
        <div className="recommend-modal-header">
          <h2 className="recommend-modal-title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function SearchIcon() {
  return (
    <svg
      className="search-icon"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden="true"
    >
      <circle cx="6.5" cy="6.5" r="4.5" />
      <path d="M10.5 10.5L14 14" strokeLinecap="round" />
    </svg>
  );
}
