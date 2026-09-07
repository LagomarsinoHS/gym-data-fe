import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "@/context/auth-context";
import { useAuthModal, type AuthMode } from "@/context/auth-modal-context";
import { useCatalog } from "@/context/catalog-context";
import { useI18n } from "@/context/i18n-context";
import { authErrorMessage } from "@/lib/auth-errors";
import { postLoginPath } from "@/lib/capabilities";

type AuthLocationState = {
  auth?: boolean;
  next?: string;
};

export function AuthModal() {
  const { t } = useI18n();
  const { user, login, register } = useAuth();
  const { open, mode, openAuth, closeAuth, consumeSuccess } = useAuthModal();
  const { setSearch } = useCatalog();
  const [localMode, setLocalMode] = useState<AuthMode>(mode);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const emailRef = useRef<HTMLInputElement | null>(null);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const state = (location.state ?? null) as AuthLocationState | null;
    if (!state?.auth || user) return;
    openAuth();
    navigate(location.pathname, {
      replace: true,
      state: state.next ? { next: state.next } : null,
    });
  }, [location.pathname, location.state, navigate, openAuth, user]);

  useEffect(() => {
    if (open) {
      setLocalMode(mode);
      setError("");
      setBusy(false);
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mode, open]);

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => emailRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      closeAuth();
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [closeAuth, open]);

  if (!open) return null;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;

    const form = event.currentTarget;
    const data = new FormData(form);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");

    setError("");
    setBusy(true);

    try {
      const nextUser =
        localMode === "login"
          ? await login(email, password)
          : await register({
              firstName: String(data.get("firstName") ?? "").trim(),
              lastName: String(data.get("lastName") ?? "").trim(),
              email,
              password,
              role: data.get("role") === "coach" ? "coach" : "athlete",
            });
      consumeSuccess();
      closeAuth();
      setSearch("");
      const next = (location.state as AuthLocationState | null)?.next;
      navigate(postLoginPath(nextUser, next), { replace: true });
    } catch (err) {
      setError(authErrorMessage(err, localMode, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="auth-overlay open"
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) closeAuth();
      }}
    >
      <div className="auth-panel">
        <div className="auth-header">
          <h2 className="auth-title" id="auth-title">
            {t(localMode === "login" ? "loginTitle" : "registerTitle")}
          </h2>
          <button type="button" className="modal-close" aria-label="Close" onClick={closeAuth}>
            ✕
          </button>
        </div>
        <form className="auth-form" onSubmit={(event) => void onSubmit(event)} autoComplete="on">
          {localMode === "register" ? (
            <>
              <label className="auth-field">
                <span className="auth-label">{t("firstName")}</span>
                <input type="text" name="firstName" required autoComplete="given-name" />
              </label>
              <label className="auth-field">
                <span className="auth-label">{t("lastName")}</span>
                <input type="text" name="lastName" required autoComplete="family-name" />
              </label>
            </>
          ) : null}
          <label className="auth-field">
            <span className="auth-label">{t("email")}</span>
            <input ref={emailRef} type="email" name="email" required autoComplete="email" />
          </label>
          <label className="auth-field">
            <span className="auth-label">{t("password")}</span>
            <input
              type="password"
              name="password"
              required
              minLength={4}
              autoComplete={localMode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {localMode === "register" ? (
            <fieldset className="auth-field auth-role-field">
              <legend className="auth-label">{t("authRole")}</legend>
              <div className="auth-role-toggle" role="radiogroup" aria-label={t("authRole")}>
                <label className="auth-role-option">
                  <input type="radio" name="role" value="athlete" defaultChecked />
                  <span>{t("roleAthlete")}</span>
                </label>
                <label className="auth-role-option">
                  <input type="radio" name="role" value="coach" />
                  <span>{t("roleCoach")}</span>
                </label>
              </div>
            </fieldset>
          ) : null}
          <button type="submit" className="auth-submit" disabled={busy}>
            {t(localMode === "login" ? "loginSubmit" : "registerSubmit")}
          </button>
          {error ? (
            <p className="auth-status is-error" role="alert">
              {error}
            </p>
          ) : null}
          <p className="auth-switch-wrap">
            <button
              type="button"
              className="auth-switch"
              onClick={() => {
                setError("");
                setLocalMode(localMode === "login" ? "register" : "login");
              }}
            >
              {t(localMode === "login" ? "createAccount" : "haveAccount")}
            </button>
          </p>
        </form>
      </div>
    </div>
  );
}
