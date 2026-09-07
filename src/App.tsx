import { Navigate, Route, Routes } from "react-router-dom";

import { AppShell } from "@/components/layout/app-shell";
import { RoleGate } from "@/components/routes/role-gate";
import { useAuth } from "@/context/auth-context";
import { homePathFor, isAdmin } from "@/lib/capabilities";
import { AdminOverviewPage } from "@/pages/admin-overview-page";
import { AdminUsersPage } from "@/pages/admin-users-page";
import { AvancesPage } from "@/pages/avances-page";
import { CatalogPage } from "@/pages/catalog-page";
import { CoachAvancesPage } from "@/pages/coach-avances-page";
import { CoachNutritionPage } from "@/pages/coach-nutrition-page";
import { CoachPanelPage } from "@/pages/coach-panel-page";
import { CoachPlanPage } from "@/pages/coach-plan-page";
import { CoachTemplatesPage } from "@/pages/coach-templates-page";
import { NutritionPage } from "@/pages/nutrition-page";
import { ProfilePage } from "@/pages/profile-page";
import { RecommendPage } from "@/pages/recommend-page";
import { SessionEditorPage } from "@/pages/session-editor-page";
import { StudentsPage } from "@/pages/students-page";
import { TrainingPage } from "@/pages/training-page";

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="grid h-full place-items-center text-sm text-muted-foreground">
        Exercise<span className="text-primary">DB</span>
      </div>
    );
  }

  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route
          path="/"
          element={isAdmin(user) ? <Navigate to="/admin" replace /> : <CatalogPage />}
        />
        <Route
          path="/login"
          element={
            user ? (
              <Navigate to={homePathFor(user)} replace />
            ) : (
              <Navigate to="/" replace state={{ auth: true }} />
            )
          }
        />
        <Route
          path="/entrenamiento"
          element={
            <RoleGate role="athlete">
              <TrainingPage />
            </RoleGate>
          }
        />
        <Route
          path="/plan-coach"
          element={
            <RoleGate role="athlete">
              <CoachPlanPage />
            </RoleGate>
          }
        />
        <Route
          path="/nutricion"
          element={
            <RoleGate role="athlete">
              <NutritionPage />
            </RoleGate>
          }
        />
        <Route
          path="/avances"
          element={
            <RoleGate role="athlete">
              <AvancesPage />
            </RoleGate>
          }
        />
        <Route
          path="/recomendar"
          element={
            <RoleGate role="athlete">
              <RecommendPage />
            </RoleGate>
          }
        />
        <Route
          path="/panel"
          element={
            <RoleGate role="coach">
              <CoachPanelPage />
            </RoleGate>
          }
        />
        <Route
          path="/plantillas/:sessionId"
          element={
            <RoleGate role="coach">
              <SessionEditorPage />
            </RoleGate>
          }
        />
        <Route
          path="/plantillas"
          element={
            <RoleGate role="coach">
              <CoachTemplatesPage />
            </RoleGate>
          }
        />
        <Route
          path="/alumnos/:athleteId/sesion/:sessionId"
          element={
            <RoleGate role="coach">
              <SessionEditorPage />
            </RoleGate>
          }
        />
        <Route
          path="/alumnos"
          element={
            <RoleGate role="coach">
              <StudentsPage />
            </RoleGate>
          }
        />
        <Route
          path="/coach/nutricion"
          element={
            <RoleGate role="coach">
              <CoachNutritionPage />
            </RoleGate>
          }
        />
        <Route
          path="/coach/avances"
          element={
            <RoleGate role="coach">
              <CoachAvancesPage />
            </RoleGate>
          }
        />
        <Route
          path="/admin"
          element={
            <RoleGate role="admin">
              <AdminOverviewPage />
            </RoleGate>
          }
        />
        <Route
          path="/admin/usuarios"
          element={
            <RoleGate role="admin">
              <AdminUsersPage />
            </RoleGate>
          }
        />
        <Route
          path="/perfil"
          element={
            user ? (
              <ProfilePage />
            ) : (
              <Navigate to="/" replace state={{ auth: true, next: "/perfil" }} />
            )
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
