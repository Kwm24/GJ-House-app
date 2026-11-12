import { useState, useEffect } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { signInWithEmail, getProfile, signOut } from "../lib/auth.js";
import { getRouteForRole, getLoginRouteForRole, ROLE_LABELS } from "../lib/routes.js";
import { useAuth } from "../components/AuthProvider.jsx";
import { LoadingScreen } from "../components/LoadingScreen.jsx";
import { GoogleSignIn, OrDivider } from "../components/GoogleSignIn.jsx";
import { completeGoogleSignIn } from "../lib/googleOneTap.js";

export function Login() {
  const navigate = useNavigate();
  const { user, profile, loading, setProfile } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [staffRole, setStaffRole] = useState(null);   // set when a staff account tries to sign in here

  // Only customers are forwarded from here; a staff account is turned away
  // (and signed out) in handleSubmit / completeGoogleSignIn instead.
  const isCustomer = profile?.role === "customer";

  useEffect(() => {
    if (!loading && user && isCustomer) {
      navigate(getRouteForRole("customer"), { replace: true });
    }
  }, [loading, user, isCustomer, navigate]);

  if (loading) {
    return <LoadingScreen message="Loading…" />;
  }

  if (user && isCustomer) {
    return <Navigate to={getRouteForRole("customer")} replace />;
  }

  // Google is customers-only; staff are turned away inside completeGoogleSignIn
  async function handleGoogle(signedInUser, session) {
    setError("");
    try {
      const userProfile = await completeGoogleSignIn(signedInUser, session);
      setProfile(userProfile);
      navigate(getRouteForRole(userProfile.role), { replace: true });
    } catch (err) {
      setError(err.message ?? "Could not sign in with Google.");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setStaffRole(null);
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

      // This page is for customers; staff are sent to their own lobby login
      if (userProfile.role !== "customer") {
        await signOut();
        setStaffRole(userProfile.role);
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
          Customer portal: track your orders and quotes
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-white/85 backdrop-blur-md backdrop-saturate-150 border border-white/50 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5"
      >
        {error && (
          <div
            role="alert"
            className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3"
          >
            {error}
          </div>
        )}

        {staffRole && (
          <div role="alert" className="rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-sm px-4 py-3">
            This sign-in is for customers. {ROLE_LABELS[staffRole] ?? "Staff"} accounts sign in at{" "}
            <Link to={getLoginRouteForRole(staffRole)} className="font-semibold underline">
              {getLoginRouteForRole(staffRole)}
            </Link>.
          </div>
        )}

        <GoogleSignIn mode="signin" onSignedIn={handleGoogle} onError={setError} />
        <OrDivider />

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

      <p className="mt-5 text-center text-sm text-brand-cream/70">
        New customer?{" "}
        <Link to="/signup" className="font-semibold text-brand-red hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-3 text-center text-xs text-brand-cream/40">
        Staff? Sign in from your lobby's own login page.
      </p>
    </div>
  );
}
