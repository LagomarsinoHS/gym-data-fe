import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";

import { useAuth } from "@/context/auth-context";
import { homePathFor } from "@/lib/capabilities";
import type { Role } from "@/types/user";

export function RoleGate({ role, children }: { role: Role; children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;
  if (!user) {
    return (
      <Navigate
        to="/"
        replace
        state={{ auth: true, next: `${location.pathname}${location.search}` }}
      />
    );
  }
  if (user.role !== role) return <Navigate to={homePathFor(user)} replace />;

  return children;
}
