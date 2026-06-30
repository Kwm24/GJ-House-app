import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../AuthProvider.jsx";
import { listProfiles, setProfileActive, inviteUser } from "../../lib/adminUsers.js";
import { ROLE_ROUTES } from "../../lib/routes.js";

const ROLE_OPTIONS = Object.keys(ROLE_ROUTES);

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red";

export function UsersTab() {
  const { user } = useAuth();
  const [mode, setMode] = useState("list");

  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState(ROLE_OPTIONS[0]);
  const [inviting, setInviting] = useState(false);
  const [inviteMsg, setInviteMsg] = useState("");

  const loadProfiles = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProfiles(await listProfiles());
    } catch (err) {
      setError(err.message ?? "Could not load users.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfiles();
  }, [loadProfiles]);

  function resetForm() {
    setEmail("");
    setFullName("");
    setRole(ROLE_OPTIONS[0]);
    setInviteMsg("");
  }

  async function handleInvite() {
    setInviting(true);
    setInviteMsg("");
    try {
      await inviteUser({ email: email.trim(), role, fullName: fullName.trim() || null });
      resetForm();
      setInviteMsg(`Invitation sent to ${email.trim()}.`);
      loadProfiles();
      setMode("list");
    } catch (err) {
      setInviteMsg(err.message ?? "Could not create user.");
    } finally {
      setInviting(false);
    }
  }

  async function handleToggleActive(p) {
    const action = p.is_active ? "Deactivate" : "Reactivate";
    if (!window.confirm(`${action} ${p.email || p.full_name || "this account"}?`)) return;
    try {
      const updated = await setProfileActive(p.id, !p.is_active);
      setProfiles((prev) => prev.map((row) => (row.id === p.id ? updated : row)));
    } catch (err) {
      setError(err.message ?? "Could not update account status.");
    }
  }

  if (mode === "create") {
    return (
      <div className="mx-auto max-w-xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setMode("list");
            }}
            className="text-sm font-medium text-gray-500 hover:text-brand-red transition-colors"
          >
            ← Back to users
          </button>

          <h2 className="mt-4 text-lg sm:text-xl font-semibold text-brand-dark">Create user</h2>
          <p className="mt-1 text-sm text-gray-600">
            Sends an email invite so the user can set their own password.
          </p>

          {inviteMsg && (
            <div
              role="status"
              className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
                inviteMsg.startsWith("Invitation sent")
                  ? "border-green-200 bg-green-50 text-green-800"
                  : "border-red-200 bg-red-50 text-red-800"
              }`}
            >
              {inviteMsg}
            </div>
          )}

          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              handleInvite();
            }}
          >
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputClass}
                placeholder="name@printpress.gh"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Full name (optional)
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Role</label>
              <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
                {ROLE_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={inviting}
              className="w-full rounded-lg bg-brand-red text-white text-sm font-semibold py-2.5 px-4 hover:bg-brand-red/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {inviting ? "Sending invite…" : "Send invite"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {inviteMsg && mode === "list" && (
        <div
          role="status"
          className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {inviteMsg}
        </div>
      )}

      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Users</h2>
            <p className="mt-1 text-sm text-gray-600">Every account in PrintPress GH.</p>
          </div>
          <button
            type="button"
            onClick={() => setMode("create")}
            className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2 hover:bg-brand-red/90 transition-colors"
          >
            + Create User
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin"
              aria-label="Loading"
            />
          </div>
        ) : !error && profiles.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500 py-8">No users yet.</p>
        ) : profiles.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="py-2.5 pr-4 text-brand-dark">{p.full_name || "—"}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{p.email || "—"}</td>
                    <td className="py-2.5 pr-4 capitalize text-gray-600">{p.role}</td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          p.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-200 text-gray-600",
                        ].join(" ")}
                      >
                        {p.is_active ? "Active" : "Deactivated"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      {p.user_id === user?.id ? (
                        <span className="text-xs text-gray-400" title="You can't deactivate your own account">
                          (you)
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleToggleActive(p)}
                          className={[
                            "text-xs font-medium hover:underline",
                            p.is_active ? "text-red-600" : "text-green-700",
                          ].join(" ")}
                        >
                          {p.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
