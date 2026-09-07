import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { createUser, loginUser } from "@/api/auth";
import { clearToken, getToken, setToken } from "@/api/token";
import { getMe, getPendingCoachInvite } from "@/api/users";
import { clearStudentsRoster } from "@/lib/students-cache";
import type { MeUser, PendingCoachInvite } from "@/types/user";

type RegisterInput = {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  role: "athlete" | "coach";
};

type AuthContextValue = {
  user: MeUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<MeUser>;
  register: (input: RegisterInput) => Promise<MeUser>;
  logout: () => void;
  applyUser: (next: MeUser) => void;
  refreshUser: () => Promise<MeUser | null>;
  pendingInvite: PendingCoachInvite | null;
  refreshInvite: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingInvite, setPendingInvite] = useState<PendingCoachInvite | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      if (!getToken()) {
        if (!cancelled) setLoading(false);
        return;
      }

      try {
        const me = await getMe();
        if (!cancelled) {
          setUser(me);
          await loadInvite(me);
        }
      } catch {
        clearToken();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!user || user.role !== "athlete") return;

    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      void loadInvite(user);
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [user]);

  async function loadInvite(next: MeUser | null) {
    if (!next || next.role !== "athlete") {
      setPendingInvite(null);
      return;
    }
    try {
      const data = await getPendingCoachInvite();
      setPendingInvite(data.invite ?? null);
    } catch {
      setPendingInvite(null);
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      pendingInvite,
      login: async (email, password) => {
        clearStudentsRoster();
        const { accessToken } = await loginUser({ email, password });
        setToken(accessToken);
        const me = await getMe();
        setUser(me);
        await loadInvite(me);
        return me;
      },
      register: async (input) => {
        clearStudentsRoster();
        const { accessToken } = await createUser(input);
        setToken(accessToken);
        const me = await getMe();
        setUser(me);
        await loadInvite(me);
        return me;
      },
      logout: () => {
        clearToken();
        clearStudentsRoster();
        setUser(null);
        setPendingInvite(null);
      },
      applyUser: (next) => {
        setUser(next);
      },
      refreshUser: async () => {
        if (!getToken()) {
          setUser(null);
          setPendingInvite(null);
          return null;
        }
        const me = await getMe();
        setUser(me);
        await loadInvite(me);
        return me;
      },
      refreshInvite: async () => {
        await loadInvite(user);
      },
    }),
    [user, loading, pendingInvite],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
