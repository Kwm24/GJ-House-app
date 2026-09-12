/**
 * CustomerPage.jsx
 * Individual customer portal — each customer sees ONLY their own jobs.
 * Jobs are linked via jobs.customer_id = auth.uid() (set by CS in the SentTab).
 *
 * Three tabs per job:
 *   Status      — progress bar through production stages + activity feed
 *   Documents   — print quote summary derived from the job's quote JSONB snapshot
 *   Final Artwork — images/videos posted by CS/Designer to job-finals/{jobId}/
 */
import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../components/AuthProvider.jsx";
import { listCustomerJobs, listJobFinals, getJobFinalUrl, getJobFinalDownloadUrl } from "../lib/jobs.js";
import { signOut } from "../lib/auth.js";
import { useNavigate } from "react-router-dom";

// ── Production stages (maps DB status values → customer-friendly labels) ──────
const STAGES = [
  { key: "sent",             label: "Quote Sent",       emoji: "📄" },
  { key: "approved",         label: "Deposit Paid",     emoji: "💰" },
  { key: "in_production",    label: "In Production",    emoji: "🖨️"  },
  { key: "ready_for_design", label: "Design Ready",     emoji: "🎨"  },
  { key: "design_ready",     label: "Design Approved",  emoji: "✅"  },
  { key: "at_finishing",     label: "At Finishing",     emoji: "✂️"  },
  { key: "ready_for_pickup", label: "Ready for Pickup", emoji: "📦"  },
  { key: "delivered",        label: "Collected",        emoji: "🎉"  },
  { key: "completed",        label: "Job Completed",    emoji: "⭐"  },
];

const STATUS_BADGE = {
  sent:             "bg-blue-100 text-blue-800",
  approved:         "bg-green-100 text-green-800",
  in_production:    "bg-yellow-100 text-yellow-800",
  ready_for_design: "bg-purple-100 text-purple-800",
  design_ready:     "bg-indigo-100 text-indigo-800",
  at_finishing:     "bg-orange-100 text-orange-800",
  ready_for_pickup: "bg-teal-100 text-teal-800",
  delivered:        "bg-gray-100 text-gray-800",
  completed:        "bg-green-700 text-white",
};

function stageLabel(status) {
  return STAGES.find((s) => s.key === status)?.label ?? status;
}

function fmtGHS(n) {
  return "GH₵ " + Number(n || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

// ── Status progress bar ────────────────────────────────────────────────────────
function StatusTab({ job }) {
  const currentIdx = STAGES.findIndex((s) => s.key === job.status);

  return (
    <div className="space-y-6">
      {/* Progress steps */}
      <div className="space-y-0">
        {STAGES.map((stage, i) => {
          const done    = i < currentIdx;
          const current = i === currentIdx;
          const future  = i > currentIdx;
          return (
            <div key={stage.key} className="flex items-stretch gap-3">
              {/* Spine */}
              <div className="flex flex-col items-center w-8 shrink-0">
                <div
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 z-10",
                    done    ? "bg-brand-red text-white"
                    : current ? "bg-brand-red text-white ring-4 ring-brand-red/20"
                    : "bg-gray-200 text-gray-400",
                  ].join(" ")}
                >
                  {done ? "✓" : stage.emoji}
                </div>
                {i < STAGES.length - 1 && (
                  <div className={["flex-1 w-0.5 my-1", done ? "bg-brand-red" : "bg-gray-200"].join(" ")} />
                )}
              </div>

              {/* Label */}
              <div className={["pb-5 pt-1 min-w-0", i === STAGES.length - 1 ? "pb-0" : ""].join(" ")}>
                <p className={[
                  "text-sm font-semibold leading-tight",
                  current ? "text-brand-dark" : done ? "text-gray-700" : "text-gray-400",
                ].join(" ")}>
                  {stage.label}
                </p>
                {current && (
                  <p className="text-xs text-brand-red mt-0.5 font-medium">← Current stage</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Job meta */}
      <div className="rounded-xl bg-gray-50 border border-gray-200 p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Reference</span>
          <span className="font-mono font-medium text-brand-dark">{job.quote_ref}</span>
        </div>
        {job.deadline && (
          <div className="flex justify-between">
            <span className="text-gray-500">Deadline</span>
            <span className="font-medium text-brand-dark">
              {new Date(job.deadline).toLocaleDateString("en-GH", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-gray-500">Created</span>
          <span className="text-gray-700">
            {new Date(job.created_at).toLocaleDateString("en-GH", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Documents tab — summary from quote JSONB snapshot ─────────────────────────
function DocumentsTab({ job }) {
  const snap = job.quote || {};
  const qtys = snap.resultQtys ?? Object.keys(snap.results ?? {}).map(Number).sort((a,b)=>a-b);

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-gray-200 bg-white p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-3">
          Print Quotation
        </p>

        <h3 className="font-bold text-brand-dark text-base">
          {snap.jobTitle || job.job_title || "Print Job"}
        </h3>

        {snap.clientName && (
          <p className="text-sm text-gray-600 mt-0.5">Client: {snap.clientName}</p>
        )}

        {/* Spec summary if available */}
        {snap.specs && (
          <div className="mt-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600 leading-relaxed">
            {[
              snap.specs.size,
              snap.specs.pages && `${snap.specs.pages}pp`,
              snap.specs.bodyColor,
              snap.specs.binding,
            ].filter(Boolean).join(" · ")}
          </div>
        )}

        {/* Pricing per quantity */}
        {qtys.length > 0 ? (
          <div className="mt-4 space-y-2">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Pricing</p>
            {qtys.map((qty) => {
              const r = snap.results?.[qty] ?? snap.results?.[String(qty)];
              if (!r) return null;
              return (
                <div key={qty} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <span className="text-sm font-semibold text-brand-dark">
                      {Number(qty).toLocaleString()} copies
                    </span>
                    {r.unitCost != null && (
                      <span className="text-xs text-gray-500 ml-2">
                        ({fmtGHS(r.unitCost)} / copy)
                      </span>
                    )}
                  </div>
                  <span className="font-bold text-brand-red">
                    {fmtGHS(r.grandTotal)}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="mt-4 text-sm text-gray-500 italic">
            Pricing details will appear once your quote is finalised.
          </p>
        )}

        {/* Deposit summary */}
        {job.deposit_amount > 0 && (
          <div className="mt-4 rounded-lg bg-amber-50 border border-amber-200 p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-amber-800">60% Deposit</span>
              <span className="font-bold text-amber-900">{fmtGHS(job.deposit_amount)}</span>
            </div>
            {qtys[0] != null && (() => {
              const r = snap.results?.[qtys[0]] ?? snap.results?.[String(qtys[0])];
              const balance = r ? Math.round((r.grandTotal - job.deposit_amount) * 100) / 100 : null;
              return balance != null ? (
                <div className="flex justify-between border-t border-amber-200 pt-1.5">
                  <span className="text-amber-800">Balance on delivery</span>
                  <span className="font-bold text-amber-900">{fmtGHS(balance)}</span>
                </div>
              ) : null;
            })()}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-400 px-4">
        Need a printed copy? Contact us and we'll send the formal invoice.
      </p>
    </div>
  );
}

// ── Final Artwork tab ──────────────────────────────────────────────────────────
function ArtworkTab({ job }) {
  const [files,      setFiles]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [urls,       setUrls]       = useState({});
  const [error,      setError]      = useState("");
  const [dlLoading,  setDlLoading]  = useState({}); // { [fileName]: true }

  useEffect(() => {
    setLoading(true);
    listJobFinals(job.id)
      .then(async (items) => {
        setFiles(items);
        const entries = await Promise.all(
          items.map(async (f) => {
            try { return [f.name, await getJobFinalUrl(job.id, f.name)]; }
            catch { return [f.name, null]; }
          })
        );
        setUrls(Object.fromEntries(entries));
      })
      .catch((err) => setError(err.message ?? "Could not load artwork."))
      .finally(() => setLoading(false));
  }, [job.id]);

  async function handleDownload(fileName) {
    setDlLoading((d) => ({ ...d, [fileName]: true }));
    try {
      const url = await getJobFinalDownloadUrl(job.id, fileName);
      // Open the signed download URL — browser treats it as a Save-As
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { /* silently ignore */ }
    finally { setDlLoading((d) => ({ ...d, [fileName]: false })); }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-7 w-7 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
        {error}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <div className="text-4xl">🎨</div>
        <p className="text-sm font-medium text-gray-700">
          Your final artwork will appear here once it's ready.
        </p>
        <p className="text-xs text-gray-400">
          Our team will upload it as soon as your job is completed.
        </p>
      </div>
    );
  }

  const isImage = (name) => /\.(jpe?g|png|gif|webp|svg)$/i.test(name);
  const isVideo = (name) => /\.(mp4|mov|webm|avi|mkv)$/i.test(name);

  return (
    <div className="space-y-4">
      {/* ⚠️ Expiry notice */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex gap-3 items-start">
        <span className="text-lg shrink-0">⏳</span>
        <p className="text-xs text-amber-800 leading-relaxed">
          <strong>Please download and save your files.</strong> These files will be
          removed from our servers <strong>4 weeks after your job is completed</strong>.
          We cannot recover them after that date.
        </p>
      </div>

      {files.map((f) => {
        const url = urls[f.name];
        if (!url) return null;
        return (
          <div key={f.name} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
            {/* Preview */}
            {isImage(f.name) ? (
              <img src={url} alt={f.name} className="w-full object-contain max-h-[70vh]" />
            ) : isVideo(f.name) ? (
              <video controls src={url} className="w-full max-h-[70vh]" playsInline />
            ) : (
              <div className="p-4 flex items-center gap-3">
                <span className="text-2xl">📎</span>
                <p className="text-sm font-medium text-gray-800 truncate">{f.name}</p>
              </div>
            )}

            {/* Footer: filename + download button */}
            <div className="px-4 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500 truncate">{f.name}</p>
              <button
                type="button"
                onClick={() => handleDownload(f.name)}
                disabled={!!dlLoading[f.name]}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-brand-red text-white text-xs font-semibold px-3 py-1.5 hover:bg-brand-red/90 disabled:opacity-60 transition-colors"
              >
                {dlLoading[f.name] ? (
                  <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" />
                ) : "⬇"}
                Download
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Job detail (tabbed view) ───────────────────────────────────────────────────
function JobDetail({ job, onBack }) {
  const [tab, setTab] = useState("status");
  const tabs = [
    { key: "status",    label: "Status" },
    { key: "documents", label: "Documents" },
    { key: "artwork",   label: "Final Artwork" },
  ];

  return (
    <div>
      {/* Back + header */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm font-medium text-brand-red mb-4 hover:underline"
      >
        ← My Jobs
      </button>

      <div className="flex flex-wrap items-start justify-between gap-2 mb-5">
        <div>
          <h2 className="text-lg font-bold text-brand-dark">
            {job.job_title || "Print Job"}
          </h2>
          <p className="text-sm text-gray-500 mt-0.5 font-mono">{job.quote_ref}</p>
        </div>
        <span className={[
          "rounded-full px-3 py-1 text-xs font-semibold shrink-0",
          STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-700",
        ].join(" ")}>
          {stageLabel(job.status)}
        </span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 rounded-xl bg-gray-100 p-1 mb-5">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={[
              "flex-1 rounded-lg py-2 text-xs sm:text-sm font-semibold transition-colors",
              tab === t.key
                ? "bg-white text-brand-dark shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "status"    && <StatusTab    job={job} />}
      {tab === "documents" && <DocumentsTab job={job} />}
      {tab === "artwork"   && <ArtworkTab   job={job} />}
    </div>
  );
}

// ── Job list card ──────────────────────────────────────────────────────────────
function JobCard({ job, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-xl border border-gray-200 bg-white p-4 hover:border-brand-red/40 hover:shadow-sm transition-all active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <p className="font-semibold text-brand-dark text-sm leading-snug">
          {job.job_title || "Print Job"}
        </p>
        <span className={[
          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold whitespace-nowrap shrink-0",
          STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-700",
        ].join(" ")}>
          {stageLabel(job.status)}
        </span>
      </div>

      <p className="text-xs font-mono text-gray-400">{job.quote_ref}</p>

      {job.deadline && (
        <p className="text-xs text-gray-500 mt-1.5">
          Deadline: {new Date(job.deadline).toLocaleDateString("en-GH", {
            day: "numeric", month: "short", year: "numeric",
          })}
        </p>
      )}

      <p className="text-xs text-brand-red font-medium mt-2">
        View details →
      </p>
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function CustomerPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const [jobs,       setJobs]       = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setJobs(await listCustomerJobs()); }
    catch (err) { setError(err.message ?? "Could not load your jobs."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null;

  async function handleSignOut() {
    await signOut().catch(() => {});
    navigate("/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-brand-dark">
      {/* Header */}
      <header className="bg-brand-dark border-b border-white/10">
        <div className="mx-auto max-w-2xl px-4 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-red">
              PrintPress GH
            </p>
            <h1 className="text-base font-bold text-brand-cream mt-0.5">
              Welcome back, {firstName} 👋
            </h1>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="text-xs text-brand-cream/50 hover:text-brand-cream/80 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Main */}
      <main className="mx-auto max-w-2xl px-4 py-6">
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3">
            {error}
          </div>
        )}

        <div className="rounded-xl bg-brand-cream p-5 sm:p-6">
          {selectedJob ? (
            <JobDetail job={selectedJob} onBack={() => setSelectedId(null)} />
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-base font-bold text-brand-dark">My Jobs</h2>
                {!loading && (
                  <span className="text-xs text-gray-400">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
                )}
              </div>

              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="h-7 w-7 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin" />
                </div>
              ) : jobs.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <div className="text-4xl">📋</div>
                  <p className="text-sm font-medium text-gray-700">No jobs yet</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto">
                    Once your order is placed and linked to your account, it will appear here.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {jobs.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onClick={() => setSelectedId(job.id)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
