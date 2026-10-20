/**
 * LobbySignup.jsx
 * Shared staff registration form — CS, Designer and Production signup pages.
 * Uses genesis design aesthetic: General Sans headings, indigo CTA.
 */
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUpStaff } from "../lib/auth.js";

const inputClass =
  "w-full rounded-lg border border-genesis-border bg-genesis-surface px-3.5 py-2.5 text-sm text-genesis-text1 " +
  "placeholder:text-genesis-muted focus:outline-none focus:ring-2 focus:ring-genesis-primary/20 focus:border-genesis-primary transition-colors";

export function LobbySignup({ icon, title, subtitle, role, loginPath }) {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "", phone: "", email: "", password: "", confirm: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error,      setError]      = useState("");
  const [success,    setSuccess]    = useState(false);

  function set(field) {
    return (e) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!form.fullName.trim()) { setError("Please enter your full name."); return; }
    if (form.password.length < 8) { setError("Password must be at least 8 characters."); return; }
    if (form.password !== form.confirm) { setError("Passwords do not match."); return; }

    setSubmitting(true);
    try {
      await signUpStaff({ fullName: form.fullName, phone: form.phone, email: form.email, password: form.password, role });
      setSuccess(true);
    } catch (err) {
      setError(err.message ?? "Could not create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const pageWrap = (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12"
      style={{ background: "linear-gradient(135deg, #1C1C1E 0%, #111113 60%, #1a1020 100%)" }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden="true"
        style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
    </div>
  );

  // ── Success screen ─────────────────────────────────────────────────────────
  if (success) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative"
        style={{ background: "linear-gradient(135deg, #1C1C1E 0%, #111113 60%, #1a1020 100%)" }}>
        <div className="pointer-events-none absolute inset-0 opacity-[0.04]" aria-hidden="true"
          style={{ backgroundImage: "radial-gradient(circle, #fff 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative w-full max-w-md rounded-2xl bg-white p-8 shadow-2xl text-center"
          style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}>
          <div className="text-4xl mb-4">🎉</div>
          <h2 className="font-display text-xl font-bold text-genesis-text1">Account created!</h2>
          <p className="mt-2 text-sm text-genesis-text2">
            Your <strong>{title}</strong> account is ready. Sign in to access your lobby.
          </p>
          <p className="mt-1.5 text-xs text-genesis-muted">
            If email confirmation is enabled, check your inbox first.
          </p>
          <button
            type="button"
            onClick={() => navigate(loginPath)}
            className="mt-6 w-full rounded-lg bg-genesis-primary text-white text-sm font-semibold py-2.5 px-4 hover:bg-genesis-primary-h transition-all"
            style={{ boxShadow: "0 4px 12px rgba(99,102,241,0.35)" }}
          >
            Go to {title} Login
          </button>
        </div>
      </div>
    );
  }

  // ── Signup form ────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-12 relative"
      style={{ background: "linear-gradient(135deg, #1C1C1E 0%, #111113 60%, #1a1020 100%)" }}>

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
        <p className="mt-2 text-sm text-white/50">{subtitle}</p>
      </div>

      {/* Form card */}
      <form
        onSubmit={handleSubmit}
        className="relative w-full max-w-md rounded-2xl bg-white shadow-2xl p-6 sm:p-8 space-y-4"
        style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.4)" }}
      >
        <div>
          <h2 className="font-display text-lg font-semibold text-genesis-text1">Create your staff account</h2>
          <p className="text-sm text-genesis-text2 mt-0.5">Fill in your details to get started</p>
        </div>

        {error && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 leading-snug">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-genesis-text2 mb-1.5">
            Full name <span className="text-brand-red">*</span>
          </label>
          <input type="text" required autoComplete="name" value={form.fullName} onChange={set("fullName")}
            className={inputClass} placeholder="Kwame Asante" />
        </div>

        <div>
          <label className="block text-xs font-medium text-genesis-text2 mb-1.5">Phone number</label>
          <input type="tel" autoComplete="tel" value={form.phone} onChange={set("phone")}
            className={inputClass} placeholder="+233 24 000 0000" />
        </div>

        <div>
          <label className="block text-xs font-medium text-genesis-text2 mb-1.5">
            Email address <span className="text-brand-red">*</span>
          </label>
          <input type="email" required autoComplete="email" value={form.email} onChange={set("email")}
            className={inputClass} placeholder="you@company.com" />
        </div>

        <div>
          <label className="block text-xs font-medium text-genesis-text2 mb-1.5">
            Password <span className="text-brand-red">*</span>
          </label>
          <input type="password" required autoComplete="new-password" value={form.password} onChange={set("password")}
            className={inputClass} placeholder="At least 8 characters" />
        </div>

        <div>
          <label className="block text-xs font-medium text-genesis-text2 mb-1.5">
            Confirm password <span className="text-brand-red">*</span>
          </label>
          <input type="password" required autoComplete="new-password" value={form.confirm} onChange={set("confirm")}
            className={inputClass} placeholder="••••••••" />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-genesis-primary text-white text-sm font-semibold py-2.5 px-4 hover:bg-genesis-primary-h active:translate-y-px focus:outline-none focus:ring-2 focus:ring-genesis-primary focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
          style={{ boxShadow: submitting ? "none" : "0 4px 12px rgba(99,102,241,0.35)" }}
        >
          {submitting ? "Creating account…" : `Create ${title} account`}
        </button>

        <p className="text-center text-sm text-genesis-text2">
          Already have an account?{" "}
          <Link to={loginPath} className="font-medium text-genesis-primary hover:text-genesis-primary-h hover:underline">
            Sign in
          </Link>
        </p>
      </form>

      <div className="relative w-full max-w-md mt-5 text-center">
        <p className="text-xs text-white/20">Staff accounts are managed by your system administrator.</p>
      </div>
    </div>
  );
}
