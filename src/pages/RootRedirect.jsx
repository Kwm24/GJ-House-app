import { Navigate } from "react-router-dom";
import { useAuth } from "../components/AuthProvider.jsx";
import { LoadingScreen } from "../components/LoadingScreen.jsx";
import { getRouteForRole } from "../lib/routes.js";

export function RootRedirect() {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (!profile) {
    return <LoadingScreen message="Loading your profile…" />;
  }

  return <Navigate to={getRouteForRole(profile.role)} replace />;
}
