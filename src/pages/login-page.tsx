import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "@/context/auth-context";
import { useI18n } from "@/context/i18n-context";
import { authErrorMessage } from "@/lib/auth-errors";
import { homePathFor } from "@/lib/capabilities";

type Mode = "login" | "register";

export function LoginPage() {
  const { t } = useI18n();
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

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
      const user =
        mode === "login"
          ? await login(email, password)
          : await register({
              firstName: String(data.get("firstName") ?? "").trim(),
              lastName: String(data.get("lastName") ?? "").trim(),
              email,
              password,
              role: data.get("role") === "coach" ? "coach" : "athlete",
            });
      navigate(homePathFor(user), { replace: true });
    } catch (err) {
      setError(authErrorMessage(err, mode, t));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mx-auto mt-6 w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-sm">
      <h1 className="text-2xl font-extrabold tracking-tight">
        {t(mode === "login" ? "loginTitle" : "registerTitle")}
      </h1>

      <form className="mt-5 flex flex-col gap-3" onSubmit={onSubmit}>
        {mode === "register" ? (
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              {t("firstName")}
              <input
                name="firstName"
                required
                autoComplete="given-name"
                className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
              {t("lastName")}
              <input
                name="lastName"
                required
                autoComplete="family-name"
                className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              />
            </label>
          </div>
        ) : null}

        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          {t("email")}
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>

        <label className="flex flex-col gap-1 text-xs font-semibold text-muted-foreground">
          {t("password")}
          <input
            name="password"
            type="password"
            required
            minLength={4}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            className="rounded-md border border-border bg-input px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
          />
        </label>

        {mode === "register" ? (
          <fieldset className="flex gap-2" aria-label={t("authRole")}>
            <legend className="mb-1 text-xs font-semibold text-muted-foreground">
              {t("authRole")}
            </legend>
            <label className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-input px-3 py-2 text-sm font-semibold">
              <input type="radio" name="role" value="athlete" defaultChecked />
              {t("roleAthlete")}
            </label>
            <label className="flex flex-1 items-center justify-center gap-2 rounded-md border border-border bg-input px-3 py-2 text-sm font-semibold">
              <input type="radio" name="role" value="coach" />
              {t("roleCoach")}
            </label>
          </fieldset>
        ) : null}

        {error ? (
          <p
            className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive"
            role="alert"
          >
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-primary px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {t(mode === "login" ? "loginSubmit" : "registerSubmit")}
        </button>
      </form>

      <button
        type="button"
        className="mt-4 text-sm font-semibold text-primary"
        onClick={() => {
          setError("");
          setMode(mode === "login" ? "register" : "login");
        }}
      >
        {t(mode === "login" ? "createAccount" : "haveAccount")}
      </button>
    </section>
  );
}
