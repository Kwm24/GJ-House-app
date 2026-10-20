import { useState, useEffect } from "react";
import { X, User, Briefcase, FileText, Edit2, Check, XCircle, KeyRound, Mail, ExternalLink } from "lucide-react";
import { updateCustomerProfile, updateCustomerEmail, sendPasswordReset } from "../lib/auth.js";
import { listJobsByCustomer, jobGrandTotal } from "../lib/jobs.js";
import { listInvoicesByCustomer, STATUS_COLORS, TYPE_COLORS } from "../lib/invoices.js";

const GHS = (n) =>
  new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS", maximumFractionDigits: 2 }).format(n ?? 0);

const fmtDate = (s) => {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" });
};

const TABS = [
  { id: "overview",  label: "Overview",   Icon: User       },
  { id: "jobs",      label: "Jobs",       Icon: Briefcase  },
  { id: "documents", label: "Documents",  Icon: FileText   },
];

const JOB_STATUS_LABELS = {
  sent:             "Quote Sent",
  approved:         "Deposit Paid",
  ready_for_design: "Design in Review",
  design_ready:     "Design Approved",
  in_production:    "In Production",
  at_finishing:     "At Finishing",
  ready_for_pickup: "Ready for Pickup",
  delivered:        "Collected",
  completed:        "Completed",
  cancelled:        "Cancelled",
};
const JOB_STATUS_COLORS = {
  sent:             "bg-blue-100 text-blue-800",
  approved:         "bg-green-100 text-green-800",
  ready_for_design: "bg-purple-100 text-purple-800",
  design_ready:     "bg-indigo-100 text-indigo-800",
  in_production:    "bg-amber-100 text-amber-800",
  at_finishing:     "bg-orange-100 text-orange-800",
  ready_for_pickup: "bg-teal-100 text-teal-800",
  delivered:        "bg-gray-100 text-gray-700",
  completed:        "bg-emerald-100 text-emerald-800",
  cancelled:        "bg-red-100 text-red-700",
};

function initials(name) {
  if (!name) return "?";
  return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

// ------------------------------------------------------------------
// CustomerProfilePanel
// Props:
//   profile        — { user_id, full_name, phone, email, is_active, created_at }
//   onClose        — () => void
//   canEdit        — bool (true for cs + admin roles)
//   onJobClick     — (jobId: string) => void   — navigate to job in CS Jobs tab
//   onInvoiceClick — (invoice: object) => void — navigate to invoice in CS Invoices tab
// ------------------------------------------------------------------
export function CustomerProfilePanel({
  profile,
  onClose,
  canEdit = false,
  onJobClick,
  onInvoiceClick,
}) {
  const [tab, setTab]         = useState("overview");
  const [jobs, setJobs]       = useState([]);
  const [docs, setDocs]       = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState("");

  // edit state
  const [editing, setEditing] = useState(false);
  const [name,    setName]    = useState(profile.full_name ?? "");
  const [phone,   setPhone]   = useState(profile.phone ?? "");
  const [email,   setEmail]   = useState(profile.email ?? "");
  const [saving,  setSaving]  = useState(false);
  const [saveErr, setSaveErr] = useState("");

  // password reset state
  const [resetSending, setResetSending] = useState(false);
  const [resetMsg,     setResetMsg]     = useState("");

  // local copy of profile so edits show immediately without closing
  const [localProfile, setLocalProfile] = useState(profile);

  useEffect(() => {
    if (!profile?.user_id) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.all([
      listJobsByCustomer(profile.user_id),
      listInvoicesByCustomer(profile.user_id),
    ])
      .then(([j, d]) => {
        if (cancelled) return;
        setJobs(j);
        setDocs(d);
      })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [profile?.user_id]);

  function startEdit() {
    setName(localProfile.full_name ?? "");
    setPhone(localProfile.phone ?? "");
    setEmail(localProfile.email ?? "");
    setSaveErr("");
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setSaveErr("");
  }

  async function saveEdit() {
    setSaving(true);
    setSaveErr("");
    try {
      // Always update name + phone
      const updated = await updateCustomerProfile(localProfile.user_id, { fullName: name, phone });
      setLocalProfile((p) => ({ ...p, full_name: updated.full_name, phone: updated.phone }));

      // Update email only if it changed
      const trimmedEmail = email.trim();
      if (trimmedEmail && trimmedEmail !== localProfile.email) {
        await updateCustomerEmail(localProfile.user_id, trimmedEmail);
        setLocalProfile((p) => ({ ...p, email: trimmedEmail }));
      }

      setEditing(false);
    } catch (e) {
      setSaveErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handlePasswordReset() {
    if (!localProfile.email) return;
    if (!window.confirm(`Send a password reset link to ${localProfile.email}?`)) return;
    setResetSending(true);
    setResetMsg("");
    try {
      await sendPasswordReset(localProfile.email);
      setResetMsg("Reset link sent to " + localProfile.email);
    } catch (e) {
      setResetMsg("Error: " + e.message);
    } finally {
      setResetSending(false);
    }
  }

  function handleJobClick(job) {
    if (onJobClick) {
      onClose();
      onJobClick(job.id);
    }
  }

  function handleDocClick(doc) {
    if (onInvoiceClick) {
      onClose();
      onInvoiceClick(doc);
    }
  }

  const invoices = docs.filter((d) => d.type === "invoice" || d.type === "quote");
  const receipts = docs.filter((d) => d.type === "receipt");

  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* panel */}
      <aside
        className="fixed inset-y-0 right-0 z-50 flex flex-col w-full max-w-lg shadow-2xl"
        style={{ background: "var(--t-bg)", borderLeft: "1px solid var(--t-border)" }}
        aria-label="Customer profile"
      >
        {/* header */}
        <div
          className="flex items-center gap-3 px-5 py-4 border-b"
          style={{ borderColor: "var(--t-border)" }}
        >
          <div className="h-10 w-10 rounded-full bg-[#6366F1] flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials(localProfile.full_name)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-sm truncate" style={{ color: "var(--t-text1)" }}>
              {localProfile.full_name || "Unnamed Customer"}
            </p>
            <p className="text-xs truncate" style={{ color: "var(--t-muted)" }}>
              {localProfile.email || "—"}
            </p>
          </div>
          <span
            className={[
              "rounded-full px-2.5 py-0.5 text-xs font-medium flex-shrink-0",
              localProfile.is_active
                ? "bg-green-100 text-green-800"
                : "bg-gray-200 text-gray-600",
            ].join(" ")}
          >
            {localProfile.is_active ? "Active" : "Inactive"}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex-shrink-0 rounded-lg p-1.5 transition-colors hover:bg-black/5 dark:hover:bg-white/10"
            style={{ color: "var(--t-muted)" }}
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {/* tabs */}
        <div
          className="flex items-center gap-1 px-5 py-2 border-b"
          style={{ borderColor: "var(--t-border)" }}
        >
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={[
                "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                tab === id
                  ? "bg-[#6366F1] text-white"
                  : "text-[var(--t-text2)] hover:bg-black/5 dark:hover:bg-white/5",
              ].join(" ")}
            >
              <Icon size={13} />
              {label}
            </button>
          ))}
        </div>

        {/* body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex justify-center py-8">
              <div className="h-6 w-6 rounded-full border-2 border-[#6366F1]/30 border-t-[#6366F1] animate-spin" />
            </div>
          )}

          {/* ── OVERVIEW ── */}
          {!loading && tab === "overview" && (
            <div className="space-y-4">
              <div
                className="rounded-xl border p-4 space-y-4"
                style={{ background: "var(--t-surface)", borderColor: "var(--t-border)" }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--t-muted)" }}>
                    Profile
                  </p>
                  {canEdit && !editing && (
                    <button
                      type="button"
                      onClick={startEdit}
                      className="flex items-center gap-1 text-xs text-[#6366F1] hover:underline"
                    >
                      <Edit2 size={11} /> Edit
                    </button>
                  )}
                </div>

                {saveErr && (
                  <p className="text-xs text-red-600">{saveErr}</p>
                )}

                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--t-text2)" }}>
                        Full Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                        style={{ borderColor: "var(--t-border)", background: "var(--t-bg)", color: "var(--t-text1)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--t-text2)" }}>
                        Phone
                      </label>
                      <input
                        type="text"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                        style={{ borderColor: "var(--t-border)", background: "var(--t-bg)", color: "var(--t-text1)" }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1" style={{ color: "var(--t-text2)" }}>
                        Email address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/30"
                        style={{ borderColor: "var(--t-border)", background: "var(--t-bg)", color: "var(--t-text1)" }}
                      />
                      <p className="mt-1 text-[10px]" style={{ color: "var(--t-muted)" }}>
                        Changing email updates the customer's login address immediately.
                      </p>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg bg-[#6366F1] text-white text-xs font-semibold px-3 py-2 hover:bg-[#4f46e5] disabled:opacity-60 transition-colors"
                      >
                        <Check size={12} />
                        {saving ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={saving}
                        className="flex items-center gap-1.5 rounded-lg border text-xs font-medium px-3 py-2 transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                        style={{ borderColor: "var(--t-border)", color: "var(--t-text2)" }}
                      >
                        <XCircle size={12} />
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <dl className="space-y-2.5 text-sm">
                    <Row label="Full Name"  value={localProfile.full_name || "—"} />
                    <Row label="Phone"      value={localProfile.phone || "—"} />
                    <Row label="Email"      value={localProfile.email || "—"} />
                    <Row label="Joined"     value={fmtDate(localProfile.created_at)} />
                  </dl>
                )}
              </div>

              {/* Account actions */}
              {canEdit && !editing && (
                <div
                  className="rounded-xl border p-4 space-y-3"
                  style={{ background: "var(--t-surface)", borderColor: "var(--t-border)" }}
                >
                  <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--t-muted)" }}>
                    Account Actions
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={handlePasswordReset}
                      disabled={resetSending || !localProfile.email}
                      className="flex items-center gap-1.5 rounded-lg border text-xs font-medium px-3 py-2 transition-colors hover:bg-[#6366F1]/5 disabled:opacity-50"
                      style={{ borderColor: "var(--t-border)", color: "var(--t-text2)" }}
                    >
                      <KeyRound size={12} />
                      {resetSending ? "Sending…" : "Send Password Reset"}
                    </button>
                  </div>
                  {resetMsg && (
                    <p className={[
                      "text-xs",
                      resetMsg.startsWith("Error") ? "text-red-600" : "text-green-700",
                    ].join(" ")}>
                      {resetMsg}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── JOBS ── */}
          {!loading && tab === "jobs" && (
            <div className="space-y-2">
              {jobs.length === 0 ? (
                <p className="text-sm text-center py-8" style={{ color: "var(--t-muted)" }}>
                  No jobs yet.
                </p>
              ) : jobs.map((job) => (
                <button
                  key={job.id}
                  type="button"
                  onClick={() => handleJobClick(job)}
                  className="w-full text-left rounded-xl border p-3.5 space-y-1 transition-colors hover:border-[#6366F1]/40 hover:bg-[#6366F1]/5 group"
                  style={{ background: "var(--t-surface)", borderColor: "var(--t-border)" }}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium" style={{ color: "var(--t-text1)" }}>
                      {job.job_title || "Untitled Job"}
                    </p>
                    <div className="flex items-center gap-1.5 flex-shrink-0">
                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          JOB_STATUS_COLORS[job.status] ?? "bg-gray-100 text-gray-700",
                        ].join(" ")}
                      >
                        {JOB_STATUS_LABELS[job.status] ?? job.status}
                      </span>
                      {onJobClick && (
                        <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 text-[#6366F1] transition-opacity" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-xs" style={{ color: "var(--t-muted)" }}>
                    <span>{job.quote_ref || "—"}</span>
                    <span>·</span>
                    <span>{GHS(jobGrandTotal(job))}</span>
                    <span>·</span>
                    <span>{fmtDate(job.created_at)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* ── DOCUMENTS ── */}
          {!loading && tab === "documents" && (
            <div className="space-y-5">
              <Section title="Invoices & Quotes" rows={invoices} onDocClick={onInvoiceClick ? handleDocClick : null} />
              <Section title="Receipts"           rows={receipts} onDocClick={onInvoiceClick ? handleDocClick : null} />
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex items-start gap-2">
      <dt className="w-24 flex-shrink-0 text-xs font-medium" style={{ color: "var(--t-muted)" }}>
        {label}
      </dt>
      <dd style={{ color: "var(--t-text1)" }}>{value}</dd>
    </div>
  );
}

function Section({ title, rows, onDocClick }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: "var(--t-muted)" }}>
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--t-muted)" }}>None.</p>
      ) : (
        <div className="space-y-2">
          {rows.map((doc) => (
            <button
              key={doc.id}
              type="button"
              onClick={() => onDocClick?.(doc)}
              className={[
                "w-full text-left rounded-xl border p-3.5 transition-colors group",
                onDocClick
                  ? "hover:border-[#6366F1]/40 hover:bg-[#6366F1]/5 cursor-pointer"
                  : "cursor-default",
              ].join(" ")}
              style={{ background: "var(--t-surface)", borderColor: "var(--t-border)" }}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-medium" style={{ color: "var(--t-text1)" }}>
                  {doc.ref}
                </p>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[doc.type] ?? ""}`}>
                    {doc.type}
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[doc.status] ?? ""}`}>
                    {doc.status}
                  </span>
                  {onDocClick && (
                    <ExternalLink size={11} className="opacity-0 group-hover:opacity-60 text-[#6366F1] transition-opacity" />
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: "var(--t-muted)" }}>
                <span>{fmtDate(doc.date || doc.created_at)}</span>
                <span>·</span>
                <span>Total: {new Intl.NumberFormat("en-GH", { style: "currency", currency: "GHS" }).format(doc.total ?? 0)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
