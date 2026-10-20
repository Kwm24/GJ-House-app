import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "./AuthProvider.jsx";
import { NotificationBell } from "./NotificationBell.jsx";
import { ThemeToggle } from "./ThemeToggle.jsx";
import { getSettings, applyFavicon } from "../lib/settings.js";

export function LobbyHeader({ title, subtitle, onNavigateToJob }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const [logoUrl, setLogoUrl] = useState("");
  const [appName, setAppName] = useState("Jage Press");

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s?.company_logo_url) setLogoUrl(s.company_logo_url);
        if (s?.company_name) setAppName(s.company_name);
        if (s?.favicon_url) applyFavicon(s.favicon_url);
      })
      .catch(() => {});
  }, []);

  const showAdminBackLink = profile?.role === "admin" && !location.pathname.startsWith("/admin");

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  return (
    <header className="sticky top-0 z-10 border-b border-[var(--t-border)] bg-[var(--t-header-bg)] backdrop-blur-sm">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between gap-3">

          {/* Left: brand + title */}
          <div className="min-w-0 flex items-center gap-3">
            <div className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 dark:bg-brand-red/20 overflow-hidden">
              {logoUrl
                ? <img src={logoUrl} alt={appName} className="h-full w-full object-contain p-0.5" />
                : <span className="text-sm font-bold text-brand-red font-display">JP</span>
              }
            </div>
            <div className="min-w-0">
              <div className="flex items-baseline gap-2 min-w-0">
                <span className="hidden sm:inline text-[10px] font-semibold tracking-[0.2em] uppercase text-[var(--t-muted)]">
                  {appName}
                </span>
                <span className="hidden sm:inline text-[var(--t-border)]">/</span>
                <h1 className="text-sm sm:text-base font-semibold text-[var(--t-text1)] font-display truncate">
                  {title}
                </h1>
              </div>
              {subtitle && (
                <p className="hidden sm:block text-xs text-[var(--t-muted)] mt-0.5 truncate">
                  {subtitle}
                </p>
              )}
            </div>
          </div>

          {/* Right: controls */}
          <div className="flex items-center gap-2 shrink-0">
            {showAdminBackLink && (
              <Link
                to="/admin"
                className="hidden sm:inline-flex items-center gap-1 rounded-lg border border-[var(--t-border)] bg-transparent px-3 py-1.5 text-xs font-medium text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
              >
                ← Admin
              </Link>
            )}

            <ThemeToggle />
            <NotificationBell onJobClick={onNavigateToJob} />

            {profile && (
              <div className="hidden sm:block text-right min-w-0 max-w-[140px] pl-1 border-l border-[var(--t-border)]">
                <p className="text-xs font-semibold text-[var(--t-text1)] truncate leading-tight">
                  {profile.full_name ?? "User"}
                </p>
                <p className="text-[10px] text-[var(--t-muted)] capitalize leading-tight">
                  {profile.role}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="rounded-lg border border-[var(--t-border)] px-3 py-1.5 text-xs font-medium text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/5 transition-colors"
            >
              Sign out
            </button>
          </div>

        </div>
      </div>
    </header>
  );
}
