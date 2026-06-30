import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";
import { LoadingScreen } from "./LoadingScreen.jsx";
import { getRouteForRole } from "../lib/routes.js";

export function ProtectedRoute({ allowedRoles, children }) {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen message="Checking your session…" />;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles?.length && profile) {
    const hasAccess =
      allowedRoles.includes(profile.role) || profile.role === "admin";

    if (!hasAccess) {
      return <Navigate to={getRouteForRole(profile.role)} replace />;
    }
  }

  if (allowedRoles?.length && !profile) {
    return <LoadingScreen message="Loading your profile…" />;
  }

  return children ?? <Outlet />;
}
