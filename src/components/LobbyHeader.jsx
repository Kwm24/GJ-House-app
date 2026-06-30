import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";
import { NotificationBell } from "./NotificationBell.jsx";

export function LobbyHeader({ title, subtitle }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const showAdminBackLink = profile?.role === "admin" && !location.pathname.startsWith("/admin");

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-10 border-b border-white/10 bg-brand-dark/95 backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs font-semibold tracking-[0.15em] uppercase text-brand-red">
              PrintPress GH
            </p>
            <h1 className="text-lg sm:text-xl font-bold text-brand-cream truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs sm:text-sm text-brand-cream/60 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>

          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            {showAdminBackLink && (
              <Link
                to="/admin"
                className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs sm:text-sm font-medium text-brand-cream hover:bg-white/10 transition-colors"
              >
                ← Admin Home
              </Link>
            )}
            <NotificationBell />
            {profile && (
              <div className="text-right min-w-0">
                <p className="text-sm font-medium text-brand-cream truncate">
                  {profile.full_name ?? "User"}
                </p>
                <p className="text-xs text-brand-cream/50 capitalize">
                  {profile.role}
                </p>
              </div>
            )}
            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-xs sm:text-sm font-medium text-brand-cream hover:bg-white/10 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
