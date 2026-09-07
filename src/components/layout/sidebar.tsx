import { Link } from "react-router-dom";

import { CatalogFilters } from "@/components/catalog/catalog-filters";
import { SidebarNav } from "@/components/layout/sidebar-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { useAuth } from "@/context/auth-context";
import { useAuthModal } from "@/context/auth-modal-context";
import { useI18n } from "@/context/i18n-context";

type SidebarProps = {
  open: boolean;
  onClose: () => void;
};

export function Sidebar({ open, onClose }: SidebarProps) {
  const { user } = useAuth();
  const { openAuth } = useAuthModal();
  const { t } = useI18n();

  return (
    <aside className="sidebar" id="app-sidebar" data-open={open ? "true" : "false"}>
      <div className="sidebar-header">
        <div className="sidebar-header-row">
          <Link to="/" className="sidebar-logo" onClick={onClose}>
            Exercise<span>DB</span>
          </Link>
          <div className="sidebar-header-actions">
            {!user ? (
              <button
                type="button"
                className="my-plan-btn"
                title={t("myPlan")}
                onClick={() => {
                  onClose();
                  openAuth();
                }}
              >
                <svg
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="1.5" width="10" height="13" rx="1.5" />
                  <path d="M5.5 5h5M5.5 8h5M5.5 11h3" />
                </svg>
                <span>{t("myPlan")}</span>
              </button>
            ) : null}
            <button
              type="button"
              className="nav-drawer-close"
              aria-label={t("closeMenu")}
              onClick={onClose}
            >
              ✕
            </button>
          </div>
        </div>
        {user ? (
          <div className="sidebar-auth">
            <UserMenu />
            <SidebarNav onNavigate={onClose} />
          </div>
        ) : null}
      </div>
      <div className="sidebar-body">
        <CatalogFilters />
      </div>
    </aside>
  );
}
