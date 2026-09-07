import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";

import { AuthModal } from "@/components/auth/auth-modal";
import { ExerciseModal } from "@/components/catalog/exercise-modal";
import { ResultsBar } from "@/components/catalog/results-bar";
import { AssignBanner } from "@/components/layout/assign-banner";
import { CoachInviteBanner } from "@/components/layout/coach-invite-banner";
import { AppFooter } from "@/components/layout/app-footer";
import { Sidebar } from "@/components/layout/sidebar";
import { useI18n } from "@/context/i18n-context";

export function AppShell() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useI18n();

  useEffect(() => {
    document.body.classList.toggle("nav-drawer-open", drawerOpen);
    return () => document.body.classList.remove("nav-drawer-open");
  }, [drawerOpen]);

  return (
    <>
      <div className="app-shell">
        <header className="mobile-topbar" id="mobile-topbar">
          <button
            type="button"
            className="nav-drawer-toggle"
            aria-expanded={drawerOpen}
            aria-controls="app-sidebar"
            aria-label={drawerOpen ? t("closeMenu") : t("openMenu")}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <span className="nav-drawer-toggle-bars" aria-hidden="true" />
          </button>
          <div className="mobile-topbar-logo">
            Exercise<span>DB</span>
          </div>
        </header>

        <div
          className="nav-drawer-backdrop"
          id="nav-drawer-backdrop"
          hidden={!drawerOpen}
          onClick={() => setDrawerOpen(false)}
        />

        <Sidebar open={drawerOpen} onClose={() => setDrawerOpen(false)} />

        <main className="main-content">
          <CoachInviteBanner />
          <ResultsBar />
          <AssignBanner />
          <div className="view-scroll">
            <Outlet />
          </div>
        </main>
      </div>
      <AppFooter />
      <ExerciseModal />
      <AuthModal />
    </>
  );
}
