import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/context/auth-context";
import { useI18n } from "@/context/i18n-context";
import { fullName, initials, roleLabel, shortName } from "@/lib/user-display";

export function UserMenu() {
  const { user, logout } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  return (
    <div className="sidebar-user" ref={rootRef} id="sidebar-user">
      <button
        type="button"
        className="sidebar-user-trigger"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t("accountMenu")}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={`sidebar-user-avatar${user.profilePhoto?.url ? " has-photo" : ""}`}>
          {user.profilePhoto?.url ? (
            <img className="sidebar-user-avatar-img" src={user.profilePhoto.url} alt="" />
          ) : (
            initials(user)
          )}
        </span>
        <div className="sidebar-user-meta">
          <span className="sidebar-user-name" title={fullName(user)}>
            {shortName(user)}
          </span>
          <span className="sidebar-user-role" data-role={user.role}>
            {roleLabel(user.role, t)}
          </span>
        </div>
        <span className="sidebar-user-chevron" aria-hidden="true">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
            <path d="M4 6.5 8 10.5 12 6.5" />
          </svg>
        </span>
      </button>
      <div className="sidebar-user-menu" role="menu" hidden={!open}>
        <button
          type="button"
          className="sidebar-user-menu-item"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            navigate("/perfil");
          }}
        >
          {t("myProfile")}
        </button>
        <button
          type="button"
          className="sidebar-user-menu-item"
          role="menuitem"
          disabled
          title={t("comingSoon")}
        >
          {t("settings")}
        </button>
        <button
          type="button"
          className="sidebar-user-menu-item is-danger"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            logout();
            navigate("/");
          }}
        >
          {t("logout")}
        </button>
      </div>
    </div>
  );
}
