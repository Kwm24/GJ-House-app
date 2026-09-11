import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { signUpCustomer } from "../lib/auth.js";

export function CustomerSignup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    fullName: "", phone: "", email: "", password: "", confirm: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState("");
  const [success, setSuccess] = useState(false);

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
      await signUpCustomer({
        fullName: form.fullName,
        phone:    form.phone,
        email:    form.email,
        password: form.password,
      });
      setSuccess(true);
    } catch (err) {
      setError(err.message ?? "Could not create account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const inp =
    "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 " +
    "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red";

  if (success) {
    return (
      <div className="w-full">
        <div className="rounded-xl bg-brand-cream p-6 sm:p-8 shadow-lg text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-lg font-bold text-brand-dark">Account created!</h2>
          <p className="mt-2 text-sm text-gray-600">
            Welcome to GJ House. You can now sign in to track your print orders.
          </p>
          {/* Some Supabase projects require email confirmation — note this */}
          <p className="mt-2 text-xs text-gray-500">
            If email confirmation is enabled, please check your inbox first.
          </p>
          <button
            type="button"
            onClick={() => navigate("/login")}
            className="mt-5 w-full rounded-lg bg-brand-red text-white text-sm font-semibold py-3 px-4 hover:bg-brand-red/90 transition-colors"
          >
            Go to Sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="text-center mb-8">
        <p className="text-xs font-semibold tracking-[0.2em] uppercase text-brand-red mb-2">
          PrintPress GH
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-brand-cream">
          Create an account
        </h1>
        <p className="mt-2 text-sm text-brand-cream/60">
          Track your print orders and job status
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-brand-cream rounded-xl p-6 sm:p-8 shadow-lg space-y-4"
      >
        {error && (
          <div role="alert" className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Full name <span className="text-brand-red">*</span>
          </label>
          <input
            type="text"
            required
            autoComplete="name"
            value={form.fullName}
            onChange={set("fullName")}
            className={inp}
            placeholder="Kofi Mensah"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Phone number
          </label>
          <input
            type="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={set("phone")}
            className={inp}
            placeholder="+233 24 000 0000"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Email address <span className="text-brand-red">*</span>
          </label>
          <input
            type="email"
            required
            autoComplete="email"
            value={form.email}
            onChange={set("email")}
            className={inp}
            placeholder="kofi@example.com"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Password <span className="text-brand-red">*</span>
          </label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={form.password}
            onChange={set("password")}
            className={inp}
            placeholder="At least 8 characters"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">
            Confirm password <span className="text-brand-red">*</span>
          </label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={form.confirm}
            onChange={set("confirm")}
            className={inp}
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-brand-red text-white text-sm font-semibold py-3 px-4 hover:bg-brand-red/90 focus:outline-none focus:ring-2 focus:ring-brand-red focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {submitting ? "Creating account…" : "Create account"}
        </button>

        <p className="text-center text-sm text-gray-600">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-brand-red hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
