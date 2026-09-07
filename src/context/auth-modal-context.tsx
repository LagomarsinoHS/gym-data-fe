import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { MeUser } from "@/types/user";

export type AuthMode = "login" | "register";

type AuthSuccessHandler = (user: MeUser) => void;

type AuthModalContextValue = {
  open: boolean;
  mode: AuthMode;
  openAuth: (options?: { mode?: AuthMode; onSuccess?: AuthSuccessHandler }) => void;
  closeAuth: () => void;
  consumeSuccess: () => AuthSuccessHandler | null;
};

const AuthModalContext = createContext<AuthModalContextValue | null>(null);

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<AuthMode>("login");
  const [onSuccess, setOnSuccess] = useState<AuthSuccessHandler | null>(null);

  const openAuth = useCallback((options?: { mode?: AuthMode; onSuccess?: AuthSuccessHandler }) => {
    setMode(options?.mode ?? "login");
    setOnSuccess(() => options?.onSuccess ?? null);
    setOpen(true);
  }, []);

  const closeAuth = useCallback(() => {
    setOpen(false);
    setMode("login");
    setOnSuccess(null);
  }, []);

  const consumeSuccess = useCallback(() => {
    const handler = onSuccess;
    setOnSuccess(null);
    return handler;
  }, [onSuccess]);

  const value = useMemo<AuthModalContextValue>(
    () => ({
      open,
      mode,
      openAuth,
      closeAuth,
      consumeSuccess,
    }),
    [open, mode, openAuth, closeAuth, consumeSuccess],
  );

  return <AuthModalContext.Provider value={value}>{children}</AuthModalContext.Provider>;
}

export function useAuthModal() {
  const ctx = useContext(AuthModalContext);
  if (!ctx) throw new Error("useAuthModal must be used within AuthModalProvider");
  return ctx;
}
