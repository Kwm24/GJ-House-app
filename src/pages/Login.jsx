import { useState, useEffect } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { signInWithEmail, getProfile, signOut } from "../lib/auth.js";
import { getRouteForRole } from "../lib/routes.js";
import { useAuth } from "../components/AuthProvider.jsx";
import { LoadingScreen } from "../components/LoadingScreen.jsx";

export function Login() {
  const navigate = useNavigate();
  const { user, profile, loading, setProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!loading && user && profile) {
      navigate(getRouteForRole(profile.role), { replace: true });
    }
  }, [loading, user, profile, navigate]);

  if (loading) {
    return <LoadingScreen message="Loading…" />;
  }

  if (user && profile) {
    return <Navigate to={getRouteForRole(profile.role)} replace />;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const { user: signedInUser } = await signInWithEmail(email, password);
      const userProfile = await getProfile(signedInUser.id);

      if (!userProfile?.role) {
        setError("Your account has no role assigned. Contact your administrator.");
        return;
      }

      if (userProfile.is_active === false) {
        await signOut();
        setError("Your account has been deactivated. Contact your administrator.");
        return;
      }

      setProfile(userProfile);
      navigate(getRouteForRole(userProfile.role), { replace: true });
    } catch (err) {
      setError(err.message ?? "Could not sign in. Check your email and password.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-red mb-2">
          PrintPress GH
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-brand-cream">
          Sign in
        </h1>
        <p className="mt-2 text-sm text-brand-cream/60">
          Ghana print press — staff &amp; customer portal
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-brand-cream rounded-xl p-6 sm:p-8 shadow-lg space-y-5"
      >
        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3"
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="email"
            className="block text-xs font-medium text-gray-600 mb-1.5"
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red"
            placeholder="you@company.com"
          />
        </div>

        <div>
          <label
            htmlFor="password"
            className="block text-xs font-medium text-gray-600 mb-1.5"
          >
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-red text-white text-sm font-semibold py-3 px-4 hover:bg-brand-red/90 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-brand-cream/50">
        Need help? Contact your system administrator.
      </p>
    </div>
  );
}
