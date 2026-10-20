/**
 * LobbyLogin.jsx
 * Shared login form — CS, Designer and Production lobby login pages.
 * Uses genesis design aesthetic: General Sans headings, DM Sans body,
 * indigo primary button, clean surface card.
 */
import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signInWithEmail, getProfile, signOut } from "../lib/auth.js";
import { useAuth } from "./AuthProvider.jsx";
import { LoadingScreen } from "./LoadingScreen.jsx";

export function LobbyLogin({ icon, title, subtitle, requiredRole, lobbyPath, signupPath }) {
  const navigate  = useNavigate();
  const { user, profile, loading, setProfile } = useAuth();

  const [email,      setEmail]      = useState("");
  const [password,   setPassword]   = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");

  useEffect(() => {
    if (loading || !user || !profile) return;
    if (profile.role === requiredRole || profile.role === "admin") {
      navigate(lobbyPath, { replace: true });
    }
  }, [loading, user, profile, requiredRole, lobbyPath, navigate]);

  if (loading) return <LoadingScreen message="Checking session…" />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const { user: signedInUser } = await signInWithEmail(email, password);
      const userProfile = await getProfile(signedInUser.id);

      if (!userProfile?.role) {
        await signOut();
        setError("Your account has no role assigned. Contact your system administrator.");
        return;
      }
      if (userProfile.is_active === false) {
        await signOut();
        setError("Your account has been deactivated. Contact your administrator.");
        return;
      }
      if (userProfile.role !== requiredRole && userProfile.role !== "admin") {
        await signOut();
        setError(
          `This login is for ${title} staff only. ` +
          `Your account role (${userProfile.role}) doesn't have access here.`
        );
        return;
      }
      setProfile(userProfile);
      navigate(lobbyPath, { replace: true });
    } catch (err) {
      setError(err.message ?? "Could not sign in. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12" style={{ background: "linear-gradient(135deg, #1C1C1E 0%, #111113 60%, #1a1020 100%)" }}>

      {/* Subtle dot grid */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden="true"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />

      {/* Brand mark */}
      <div className="relative w-full max-w-md text-center mb-8">
        <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-brand-red/20 border border-brand-red/30 mb-4 mx-auto">
          <span className="text-2xl select-none" aria-hidden="true">{icon}</span>
        </div>
        <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-brand-red mb-2">
          PrintPress GH
        </p>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
          {title}
        </h1>
        <p className="mt-2 text-sm text-white/50">
          {subtitle}
        </p>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 sm:p-8 space-y-5"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}
      >
        <div>
          <h2 className="font-display text-lg font-semibold text-genesis-text1">Sign in to your lobby</h2>
          <p className="text-sm text-genesis-text2 mt-0.5">Use your staff account credentials</p>
        </div>

        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 leading-snug"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="login-email" className="block text-xs font-medium text-genesis-text2 mb-1.5">
            Email address
          </label>
          <input
            id="login-email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-genesis-border bg-genesis-surface px-3.5 py-2.5 text-sm text-genesis-text1 placeholder:text-genesis-muted focus:outline-none focus:ring-2 focus:ring-genesis-primary/20 focus:border-genesis-primary transition-colors"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label htmlFor="login-password" className="block text-xs font-medium text-genesis-text2 mb-1.5">
            Password
          </label>
          <input
            id="login-password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-genesis-border bg-genesis-surface px-3.5 py-2.5 text-sm text-genesis-text1 placeholder:text-genesis-muted focus:outline-none focus:ring-2 focus:ring-genesis-primary/20 focus:border-genesis-primary transition-colors"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-genesis-primary text-white text-sm font-semibold py-2.5 px-4 hover:bg-genesis-primary-h active:translate-y-px focus:outline-none focus:ring-2 focus:ring-genesis-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          style={{ boxShadow: submitting ? "none" : "0 4px 12px rgba(99,102,241,0.35)" }}
        >
          {submitting ? "Signing in…" : `Enter ${title}`}
        </button>

        {signupPath && (
          <p className="text-center text-sm text-genesis-text2">
            New to {title}?{" "}
            <Link to={signupPath} className="font-medium text-genesis-primary hover:text-genesis-primary-h hover:underline">
              Create an account
            </Link>
          </p>
        )}
      </form>

      {/* Footer links */}
      <div className="relative w-full max-w-md mt-5 flex flex-col items-center gap-2 text-center">
        <p className="text-xs text-white/30">
          Wrong lobby?{" "}
          <Link to="/login" className="text-white/50 hover:text-white underline transition-colors">
            Go to main login
          </Link>
        </p>
        <p className="text-xs text-white/20">
          Staff accounts are managed by your system administrator.
        </p>
      </div>
    </div>
  );
}
