/**
 * CustomerPage.jsx
 * Individual customer portal — each customer sees ONLY their own jobs.
 * Jobs are linked via jobs.customer_id = auth.uid() (set by CS in the Jobs tab).
 *
 * Four tabs per job:
 *   Status          — 9-stage progress bar through production stages
 *   Documents       — print quote summary from the job's quote JSONB snapshot
 *   Final Design    — designer-uploaded artwork for customer to review & approve
 *   Finished Product— images/videos CS posts to job-finals/{jobId}/ for download
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../components/AuthProvider.jsx";
import { NotificationBell } from "../components/NotificationBell.jsx";
import { subscribeToTable } from "../lib/realtime.js";
import {
  listCustomerJobs,
  listJobFinals,
  getJobFinalUrl,
  getJobFinalDownloadUrl,
  approveDesign,
} from "../lib/jobs.js";
import { listCustomerUploadedFiles, getJobFileSignedUrl, uploadCustomerFile, uploadDesignFile, uploadReferenceFile, recordJobFile } from "../lib/jobFiles.js";
import { listCustomerDocuments, TYPE_COLORS, STATUS_COLORS as INV_STATUS_COLORS } from "../lib/invoices.js";
import { listPublicItems } from "../lib/items.js";
import { getSettings } from "../lib/settings.js";
import { signOut } from "../lib/auth.js";
import { useNavigate } from "react-router-dom";
import {
  Briefcase, FileText, Tag, ArrowLeft, CheckCircle2, Clock, Download,
  Send, CreditCard, Palette, Printer, Scissors, Package, Truck, Star, Calculator,
} from "lucide-react";
import { ThemeToggle } from "../components/ThemeToggle.jsx";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../components/PeriodPicker.jsx";
import { InstantQuoter, buildInstantQuoteSummary } from "../components/InstantQuoter.jsx";

// ── Production stages (maps DB status values → customer-friendly labels) ──────
const STAGES = [
  { key: "sent",             label: "Quote Sent",       Icon: Send         },
  { key: "approved",         label: "Deposit Paid",     Icon: CreditCard   },
  { key: "ready_for_design", label: "Design in Review", Icon: Palette      },
  { key: "design_ready",     label: "Design Approved",  Icon: CheckCircle2 },
  { key: "in_production",    label: "In Production",    Icon: Printer      },
  { key: "at_finishing",     label: "At Finishing",     Icon: Scissors     },
  { key: "ready_for_pickup", label: "Ready for Pickup", Icon: Package      },
  { key: "delivered",        label: "Collected",        Icon: Truck        },
  { key: "completed",        label: "Job Completed",    Icon: Star         },
];

const STATUS_BADGE = {
  sent:             "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300",
  approved:         "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
  in_production:    "bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300",
  ready_for_design: "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300",
  design_ready:     "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300",
  at_finishing:     "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300",
  ready_for_pickup: "bg-teal-50 text-teal-700 dark:bg-teal-900/20 dark:text-teal-300",
  delivered:        "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
  completed:        "bg-emerald-600 text-white dark:bg-emerald-700",
};

const STATUS_ACCENT = {
  sent:             "#3B82F6",
  approved:         "#10B981",
  in_production:    "#F59E0B",
  ready_for_design: "#A855F7",
  design_ready:     "#6366F1",
  at_finishing:     "#F97316",
  ready_for_pickup: "#14B8A6",
  delivered:        "#22C55E",
  completed:        "#10B981",
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
          const StageIcon = stage.Icon;
          return (
            <div key={stage.key} className="flex items-stretch gap-3">
              {/* Spine */}
              <div className="flex flex-col items-center w-8 shrink-0">
                <div
                  className={[
                    "w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10",
                    done    ? "bg-brand-red text-white"
                    : current ? "bg-brand-red text-white ring-4 ring-brand-red/20"
                    : "bg-gray-100 dark:bg-white/10 text-gray-400 dark:text-gray-500",
                  ].join(" ")}
                >
                  {done
                    ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M2.5 7L5.5 10L11.5 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    : <StageIcon size={13} />
                  }
                </div>
                {i < STAGES.length - 1 && (
                  <div className={["flex-1 w-0.5 my-1", done ? "bg-brand-red" : "bg-gray-200 dark:bg-white/10"].join(" ")} />
                )}
              </div>

              {/* Label */}
              <div className={["pb-5 pt-1 min-w-0", i === STAGES.length - 1 ? "pb-0" : ""].join(" ")}>
                <p className={[
                  "text-sm font-semibold leading-tight",
                  current ? "text-[var(--t-text1)]" : done ? "text-[var(--t-text2)]" : "text-[var(--t-muted)]",
                ].join(" ")}>
                  {stage.label}
                </p>
                {current && (
                  <p className="text-xs text-brand-red mt-0.5 font-medium">← You are here</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Job meta */}
      <div className="rounded-xl bg-[var(--t-bg)] border border-[var(--t-border)] p-4 space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--t-muted)]">Reference</span>
          <span className="font-mono font-medium text-[var(--t-text1)]">{job.quote_ref}</span>
        </div>
        {job.deadline && (
          <div className="flex justify-between">
            <span className="text-[var(--t-muted)]">Deadline</span>
            <span className="font-medium text-[var(--t-text1)]">
              {new Date(job.deadline).toLocaleDateString("en-GH", {
                day: "numeric", month: "short", year: "numeric",
              })}
            </span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-[var(--t-muted)]">Created</span>
          <span className="text-[var(--t-text2)]">
            {new Date(job.created_at).toLocaleDateString("en-GH", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Documents tab — quote snapshot + customer resource uploads ────────────────
function DocumentsTab({ job }) {
  const { user } = useAuth();
  const snap = job.quote || {};
  const qtys = snap.resultQtys ?? Object.keys(snap.results ?? {}).map(Number).sort((a,b)=>a-b);

  const fileInputRef = useRef(null);
  const [uploads,       setUploads]       = useState([]);
  const [uploadUrls,    setUploadUrls]    = useState({});
  const [loadingFiles,  setLoadingFiles]  = useState(true);
  const [uploading,     setUploading]     = useState(false);
  const [uploadMsg,     setUploadMsg]     = useState("");
  // "reference" = resource files/logos/brand materials; "design" = ready artwork
  const [uploadType,    setUploadType]    = useState("reference");

  async function refreshUploads(jobId) {
    const items = await listCustomerUploadedFiles(jobId, user?.id);
    setUploads(items);
    const entries = await Promise.all(
      items.map(async (f) => {
        try { return [f.id, await getJobFileSignedUrl(f.file_path)]; }
        catch { return [f.id, null]; }
      })
    );
    setUploadUrls(Object.fromEntries(entries));
  }

  useEffect(() => {
    setLoadingFiles(true);
    refreshUploads(job.id)
      .catch(() => {})
      .finally(() => setLoadingFiles(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.id]);

  async function handleUpload(file) {
    if (!file || !user) return;
    setUploading(true);
    setUploadMsg("");
    try {
      let path;
      if (uploadType === "design") {
        path = await uploadDesignFile(job.id, file);
      } else {
        path = await uploadReferenceFile(job.id, file);
      }
      await recordJobFile({ jobId: job.id, fileType: uploadType, fileName: file.name, filePath: path, uploadedBy: user.id });
      setUploadMsg(`${uploadType === "design" ? "Design artwork" : "Reference file"} uploaded.`);
      await refreshUploads(job.id);
    } catch (err) {
      setUploadMsg(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--t-muted)] mb-3">
          Print Quotation
        </p>

        <h3 className="font-bold text-[var(--t-text1)] text-base">
          {snap.jobTitle || job.job_title || "Print Job"}
        </h3>

        {snap.clientName && (
          <p className="text-sm text-[var(--t-text2)] mt-0.5">Client: {snap.clientName}</p>
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

      {/* ── Customer resource uploads ── */}
      <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-5">
        <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--t-muted)] mb-1">
          Your Uploaded Files
        </p>
        <p className="text-xs text-[var(--t-muted)] mb-4">
          Upload files for this job. Tell us what type so we route them correctly.
        </p>

        {/* File type selector */}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            onClick={() => setUploadType("reference")}
            className={[
              "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              uploadType === "reference"
                ? "border-brand-red bg-brand-red/10 text-brand-red"
                : "border-gray-300 text-gray-600 hover:border-gray-400",
            ].join(" ")}
          >
            📁 Reference / Resources
            <span className="block text-[10px] font-normal mt-0.5 opacity-70">Logos, brand guidelines, content</span>
          </button>
          <button
            type="button"
            onClick={() => setUploadType("design")}
            className={[
              "flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors",
              uploadType === "design"
                ? "border-brand-red bg-brand-red/10 text-brand-red"
                : "border-gray-300 text-gray-600 hover:border-gray-400",
            ].join(" ")}
          >
            🎨 Design Artwork
            <span className="block text-[10px] font-normal mt-0.5 opacity-70">Ready artwork / print-ready files</span>
          </button>
        </div>

        {/* Upload control */}
        <label className="cursor-pointer inline-flex items-center gap-2 rounded-lg border-2 border-dashed border-gray-300 hover:border-brand-red px-4 py-2.5 text-sm font-medium text-gray-700 hover:text-brand-red transition-colors">
          {uploading ? "Uploading…" : "Choose file to upload"}
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            disabled={uploading}
            onChange={(e) => handleUpload(e.target.files?.[0])}
          />
        </label>

        {uploadMsg && (
          <p className={`mt-2 text-xs ${uploadMsg.includes("failed") || uploadMsg.includes("ailed") ? "text-red-600" : "text-green-700"}`}>
            {uploadMsg}
          </p>
        )}

        {/* Uploaded files list */}
        {loadingFiles ? (
          <div className="mt-4 flex items-center gap-2 text-xs text-[var(--t-muted)]">
            <div className="h-4 w-4 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin" />
            Loading files…
          </div>
        ) : uploads.length > 0 ? (
          <div className="mt-4 space-y-2">
            {uploads.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-lg bg-gray-50 dark:bg-white/5 px-3 py-2 text-sm">
                <span className="truncate flex-1 text-[var(--t-text2)]">
                  {f.file_type === "design" ? "🎨" : "📁"} {f.file_name}
                </span>
                <span className={[
                  "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                  f.file_type === "design"
                    ? "bg-purple-100 text-purple-700"
                    : "bg-blue-100 text-blue-700",
                ].join(" ")}>
                  {f.file_type === "design" ? "Artwork" : "Resource"}
                </span>
                {uploadUrls[f.id] ? (
                  <a
                    href={uploadUrls[f.id]}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0 text-xs font-semibold text-brand-red hover:underline"
                  >
                    View
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-xs text-[var(--t-muted)] italic">No files uploaded yet.</p>
        )}
      </div>
    </div>
  );
}

// ── Final Design tab — designer artwork for customer review & approval ─────────
function FinalDesignTab({ job, onJobUpdate }) {
  const [files,     setFiles]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [urls,      setUrls]      = useState({});   // { [file.id]: signedUrl }
  const [error,     setError]     = useState("");
  const [approving, setApproving] = useState(false);
  // Track approval locally so the UI reacts immediately without waiting for a
  // full re-fetch of all jobs.
  const [approved,  setApproved]  = useState(job.design_approved || false);

  useEffect(() => {
    // Reset approval state when the user switches job
    setApproved(job.design_approved || false);
    setLoading(true);
    listJobFiles(job.id, "design")
      .then(async (items) => {
        setFiles(items);
        const entries = await Promise.all(
          items.map(async (f) => {
            try { return [f.id, await getJobFileSignedUrl(f.file_path)]; }
            catch { return [f.id, null]; }
          })
        );
        setUrls(Object.fromEntries(entries));
      })
      .catch((err) => setError(err.message ?? "Could not load design files."))
      .finally(() => setLoading(false));
  }, [job.id, job.design_approved]);

  async function handleApprove() {
    const confirmed = window.confirm(
      "By approving this design you confirm it is correct and authorise us to\n" +
      "proceed with printing. You accept responsibility for any errors present\n" +
      "in the design as approved.\n\nAre you sure you want to approve?"
    );
    if (!confirmed) return;

    setApproving(true);
    setError("");
    try {
      await approveDesign(job.id);
      setApproved(true);
      // Propagate updated job state upward so Status tab reflects design_ready
      onJobUpdate?.({ ...job, design_approved: true, status: "design_ready" });
    } catch (err) {
      setError(err.message ?? "Could not approve design. Please try again.");
    } finally {
      setApproving(false);
    }
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
        <p className="text-sm font-medium text-gray-700">No design uploaded yet.</p>
        <p className="text-xs text-gray-400">
          Our design team will upload your artwork here for you to review.
        </p>
      </div>
    );
  }

  const isImage = (name) => /\.(jpe?g|png|gif|webp|svg)$/i.test(name ?? "");

  return (
    <div className="space-y-4">
      {/* Status banner */}
      {approved ? (
        <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 flex gap-3 items-center">
          <span className="text-xl shrink-0">✅</span>
          <p className="text-sm font-medium text-green-900">
            You have approved this design. Our production team has been notified
            to proceed with printing.
          </p>
        </div>
      ) : (
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 flex gap-3 items-start">
          <span className="text-lg shrink-0">⚠️</span>
          <p className="text-xs text-amber-800 leading-relaxed">
            <strong>Review your design carefully before approving.</strong> Once
            approved, you authorise us to proceed with printing and accept
            responsibility for any errors present in the approved design.
          </p>
        </div>
      )}

      {/* Design file previews */}
      {files.map((f) => {
        const url  = urls[f.id];
        const name = f.file_name;
        return (
          <div key={f.id} className="rounded-xl overflow-hidden border border-gray-200 bg-white">
            {/* Preview area */}
            {url && isImage(name) ? (
              <img src={url} alt={name} className="w-full object-contain max-h-[70vh]" />
            ) : url ? (
              <div className="p-4 flex items-center gap-3">
                <span className="text-2xl">📄</span>
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-medium text-brand-red hover:underline truncate"
                >
                  View {name}
                </a>
              </div>
            ) : (
              <div className="p-4 flex items-center gap-3">
                <span className="text-2xl">📎</span>
                <p className="text-sm text-gray-500 truncate">{name} (preview unavailable)</p>
              </div>
            )}

            {/* Footer */}
            <div className="px-4 py-2 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-400 truncate">{name}</p>
            </div>
          </div>
        );
      })}

      {/* Approve button — hidden once approved */}
      {!approved && (
        <button
          type="button"
          onClick={handleApprove}
          disabled={approving}
          className="w-full rounded-xl bg-green-600 text-white text-sm font-semibold py-3 px-4 hover:bg-green-700 active:scale-[0.99] disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
        >
          {approving ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
          ) : (
            <span>✅</span>
          )}
          {approving ? "Approving…" : "Approve This Design"}
        </button>
      )}
    </div>
  );
}

// ── Finished Product tab — final files CS uploads after production ─────────────
function FinishedProductTab({ job }) {
  const [files,      setFiles]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [urls,       setUrls]       = useState({});
  const [error,      setError]      = useState("");
  const [dlLoading,  setDlLoading]  = useState({}); // { [fileName]: bool }

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
      .catch((err) => setError(err.message ?? "Could not load files."))
      .finally(() => setLoading(false));
  }, [job.id]);

  async function handleDownload(fileName) {
    setDlLoading((d) => ({ ...d, [fileName]: true }));
    try {
      const url = await getJobFinalDownloadUrl(job.id, fileName);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch { /* silent */ }
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
        <div className="text-4xl">📦</div>
        <p className="text-sm font-medium text-gray-700">
          Your finished product will appear here once ready.
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

            {/* Footer */}
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

// ── Invoice / Receipt print helper ───────────────────────────────────────────
const TYPE_LABEL       = { quote: "Quotation", invoice: "Invoice", receipt: "Receipt" };
const INV_STATUS_LABEL = { draft: "Draft", sent: "Sent", paid: "Paid", cancelled: "Cancelled" };

function buildInvoicePrintHtml(inv, company = {}, payment = {}) {
  const co        = company;
  const coName    = co.name     || "Jage Press";
  const coAddress = co.address  || "";
  const coPhone   = co.phone    || "";
  const coEmail   = co.email    || "";
  const coVat     = co.vatNo    || "";
  const coLogo    = co.logoUrl  || "";
  const accent    = co.accentHex || "#C0392B";

  const typeLabel   = TYPE_LABEL[inv.type]       ?? inv.type;
  const statusLabel = INV_STATUS_LABEL[inv.status] ?? inv.status;
  const lines       = Array.isArray(inv.line_items) ? inv.line_items : [];

  const rowsHtml = lines.map((li) => `
    <tr>
      <td style="padding:7px 10px;border-bottom:1px solid #E5DFD5;font-size:12px;">
        <strong>${li.name ?? ""}</strong>
        ${li.description ? `<div style="color:#666;font-size:11px;margin-top:2px;">${li.description}</div>` : ""}
      </td>
      <td style="padding:7px 10px;border-bottom:1px solid #E5DFD5;text-align:center;font-size:12px;font-family:monospace;">${li.qty ?? 1}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #E5DFD5;text-align:right;font-size:12px;font-family:monospace;">${fmtGHS(li.unitPrice)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #E5DFD5;text-align:right;font-size:12px;font-family:monospace;">${fmtGHS(li.total ?? (li.qty * li.unitPrice))}</td>
    </tr>
  `).join("");

  const vatRow  = Number(inv.vat_amt)     > 0 ? `<tr><td colspan="3" style="padding:5px 10px;text-align:right;font-size:12px;color:#666;">VAT (20%)</td><td style="padding:5px 10px;text-align:right;font-family:monospace;font-size:12px;">${fmtGHS(inv.vat_amt)}</td></tr>` : "";
  const discRow = Number(inv.discount_amt) > 0 ? `<tr><td colspan="3" style="padding:5px 10px;text-align:right;font-size:12px;color:#666;">Discount (${inv.discount_pct}%)</td><td style="padding:5px 10px;text-align:right;font-family:monospace;font-size:12px;color:${accent};">-${fmtGHS(inv.discount_amt)}</td></tr>` : "";

  // For receipts: original invoice total = subtotal - discount + vat; balance = that minus what was paid
  const round2 = (n) => Math.round(Number(n) * 100) / 100;
  const origTotal  = round2((Number(inv.subtotal) || 0) - (Number(inv.discount_amt) || 0) + (Number(inv.vat_amt) || 0));
  const amtPaid    = Number(inv.total) || 0;
  const balanceDue = round2(origTotal - amtPaid);
  const receiptBalanceHtml = inv.type === "receipt" && origTotal > 0
    ? `<div style="margin-top:20px;border:1.5px solid ${accent};border-radius:8px;overflow:hidden;">
         <div style="background:${accent};color:#fff;padding:7px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Payment Summary</div>
         <div style="padding:12px 14px;display:flex;flex-direction:column;gap:8px;font-size:12px;">
           <div style="display:flex;justify-content:space-between;">
             <span style="color:#666;">Invoice Total</span>
             <span style="font-family:monospace;">${fmtGHS(origTotal)}</span>
           </div>
           <div style="display:flex;justify-content:space-between;">
             <span style="color:#666;">Amount Paid</span>
             <span style="font-family:monospace;color:${accent};font-weight:700;">${fmtGHS(amtPaid)}</span>
           </div>
           <div style="display:flex;justify-content:space-between;border-top:1px solid #E5DFD5;padding-top:8px;">
             <span style="font-weight:700;">Balance Due on Delivery</span>
             <span style="font-family:monospace;font-weight:700;font-size:14px;color:${balanceDue <= 0 ? "#10B981" : "#1C1C1E"};">
               ${balanceDue <= 0 ? "PAID IN FULL" : fmtGHS(balanceDue)}
             </span>
           </div>
         </div>
       </div>`
    : "";

  const dateStr    = inv.date     ? new Date(inv.date).toLocaleDateString("en-GH",     { day: "numeric", month: "long", year: "numeric" }) : "";
  const dueDateStr = inv.due_date ? new Date(inv.due_date).toLocaleDateString("en-GH", { day: "numeric", month: "long", year: "numeric" }) : "";

  const logoHtml = coLogo
    ? `<img src="${coLogo}" alt="${coName}" style="max-height:64px;max-width:180px;object-fit:contain;display:block;" />`
    : `<div style="font-size:22px;font-weight:800;letter-spacing:-0.5px;">${coName}</div>`;

  const coSubLines = [coAddress, [coPhone, coEmail].filter(Boolean).join("  ·  ")].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${typeLabel} ${inv.ref}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Segoe UI',Arial,sans-serif; padding:40px; color:#1C1C1E; background:#fff; max-width:800px; margin:0 auto; }
  @media print { body { padding:20px; } @page { margin:15mm 12mm; size:A4; } }
  .hdr { display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:20px; border-bottom:3px solid ${accent}; margin-bottom:28px; }
  .co-sub { font-size:11px; color:#888; margin-top:5px; line-height:1.6; }
  .doc-type { font-size:30px; font-weight:800; color:${accent}; text-align:right; text-transform:uppercase; }
  .doc-ref  { font-size:12px; color:#666; text-align:right; margin-top:4px; font-family:monospace; }
  .badge { display:inline-block; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:600; margin-top:6px; background:${inv.status==="paid"?"#D1FAE5":"#E0F2FE"}; color:${inv.status==="paid"?"#065F46":"#0369A1"}; }
  .meta { display:flex; justify-content:space-between; margin-bottom:28px; }
  .meta-block label { font-size:10px; text-transform:uppercase; letter-spacing:1px; color:#888; display:block; margin-bottom:3px; }
  .meta-block p { font-size:13px; font-weight:600; }
  table { width:100%; border-collapse:collapse; margin-bottom:12px; }
  thead th { background:#1C1C1E; color:#fff; padding:8px 10px; font-size:11px; text-align:right; }
  thead th:first-child { text-align:left; }
  .totals { margin-left:auto; width:280px; }
  .grand  { font-size:15px; font-weight:700; color:${accent}; }
  .notes  { margin-top:24px; padding:14px; background:#F5F0E8; border-radius:8px; font-size:12px; color:#555; line-height:1.5; }
  .footer { margin-top:32px; padding-top:14px; border-top:1px solid #E0D9CF; font-size:10px; color:#AAA; text-align:center; }
</style></head>
<body>
<div class="hdr">
  <div>
    ${logoHtml}
    ${coSubLines.map(l => `<div class="co-sub">${l}</div>`).join("")}
  </div>
  <div>
    <div class="doc-type">${typeLabel}</div>
    <div class="doc-ref">${inv.ref}</div>
    <span class="badge">${statusLabel}</span>
  </div>
</div>

<div class="meta">
  <div class="meta-block">
    <label>Issued To</label>
    <p>${inv.client_name || "—"}</p>
  </div>
  <div class="meta-block" style="text-align:right;">
    <label>Date</label>
    <p>${dateStr}</p>
    ${dueDateStr ? `<label style="margin-top:8px;">Due Date</label><p>${dueDateStr}</p>` : ""}
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="text-align:left;width:48%;">Description</th>
      <th style="text-align:center;">Qty</th>
      <th style="text-align:right;">Unit Price</th>
      <th style="text-align:right;">Total</th>
    </tr>
  </thead>
  <tbody>${rowsHtml}</tbody>
</table>

<table class="totals">
  <tbody>
    <tr><td style="padding:5px 10px;text-align:right;font-size:12px;color:#666;">Subtotal</td><td style="padding:5px 10px;text-align:right;font-family:monospace;font-size:12px;">${fmtGHS(inv.subtotal)}</td></tr>
    ${discRow}${vatRow}
    <tr><td class="grand" style="padding:8px 10px;text-align:right;border-top:2px solid #1C1C1E;">Total</td><td class="grand" style="padding:8px 10px;text-align:right;font-family:monospace;border-top:2px solid #1C1C1E;">${fmtGHS(inv.total)}</td></tr>
  </tbody>
</table>

${receiptBalanceHtml}

${inv.notes ? `<div class="notes"><strong>Notes:</strong> ${inv.notes}</div>` : ""}

${(inv.type !== "receipt" && (payment.momoNumber || payment.bankName)) ? `
<div style="margin-top:28px;border:1.5px solid ${accent};border-radius:8px;overflow:hidden;">
  <div style="background:${accent};color:#fff;padding:8px 16px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">How to Pay</div>
  <div style="padding:14px 16px;display:flex;flex-wrap:wrap;gap:16px 32px;font-size:11px;">
    ${payment.momoNumber ? `
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;margin-bottom:3px;">Mobile Money (MoMo)</div>
      <div style="font-weight:600;font-size:13px;color:#1C1C1E;">${payment.momoNumber}</div>
      ${payment.accountName ? `<div style="font-size:11px;color:#555;margin-top:1px;">${payment.accountName}</div>` : ""}
    </div>` : ""}
    ${payment.bankName ? `
    <div>
      <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;margin-bottom:3px;">Bank Transfer</div>
      <div style="font-weight:600;font-size:13px;color:#1C1C1E;">${payment.bankName}</div>
      ${payment.accountNumber ? `<div style="font-size:11px;font-family:monospace;color:#555;margin-top:1px;">${payment.accountNumber}${payment.accountName ? " — " + payment.accountName : ""}</div>` : ""}
    </div>` : ""}
  </div>
</div>` : ""}

${coVat || coName ? `<div class="footer">${[coVat, coName ? `This is an official receipt issued by ${coName}.` : ""].filter(Boolean).join("  ·  ")}</div>` : ""}
</body></html>`;
}

// Fetches company info from settings then opens a formatted print window.
// Settings are now publicly readable (migration 020) so customers can call this.
async function openInvoicePrint(inv) {
  let company = {};
  let payment = {};
  try {
    const s = await getSettings();
    if (s) {
      company = {
        name:      s.company_name     || "",
        address:   s.company_address  || "",
        phone:     s.company_phone    || "",
        email:     s.company_email    || "",
        vatNo:     s.company_vat_no   || "",
        logoUrl:   s.company_logo_url || "",
        accentHex: s.accent_color     || "#C0392B",
      };
      payment = {
        momoNumber:    s.momo_number    || "",
        bankName:      s.bank_name      || "",
        accountNumber: s.account_number || "",
        accountName:   s.account_name   || "",
      };
    }
  } catch { /* fall through */ }

  const html = buildInvoicePrintHtml(inv, company, payment);

  // Load the full HTML document in a hidden iframe via Blob URL so all styles
  // are applied, then trigger the browser's print-to-PDF dialog.
  const blob    = new Blob([html], { type: "text/html" });
  const blobUrl = URL.createObjectURL(blob);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;top:-9999px;left:-9999px;width:794px;height:1123px;border:none;visibility:hidden;";
  document.body.appendChild(iframe);

  iframe.onload = () => {
    setTimeout(() => {
      try { iframe.contentWindow.print(); } catch { window.open(blobUrl, "_blank"); }
      URL.revokeObjectURL(blobUrl);
      setTimeout(() => { try { document.body.removeChild(iframe); } catch {} }, 2000);
    }, 400);
  };

  iframe.src = blobUrl;
}

// ── Single document card ───────────────────────────────────────────────────────
function DocumentCard({ inv }) {
  const typeLabel   = TYPE_LABEL[inv.type]          ?? inv.type;
  const statusLabel = INV_STATUS_LABEL[inv.status]  ?? inv.status;
  const typeBadge   = TYPE_COLORS[inv.type]         ?? "bg-gray-100 text-gray-700";
  const statusBadge = INV_STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-700";
  const dateStr     = inv.date ? new Date(inv.date).toLocaleDateString("en-GH", {
    day: "numeric", month: "short", year: "numeric",
  }) : "";

  return (
    <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 mb-1">
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${typeBadge}`}>
              {typeLabel}
            </span>
            <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${statusBadge}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-sm font-mono font-medium text-brand-dark truncate">{inv.ref}</p>
          {dateStr && <p className="text-xs text-gray-400 mt-0.5">{dateStr}</p>}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold text-brand-dark">{fmtGHS(inv.total)}</p>
        </div>
      </div>

      {Array.isArray(inv.line_items) && inv.line_items.length > 0 && (
        <div className="mt-2 space-y-0.5">
          {inv.line_items.slice(0, 3).map((li, i) => (
            <div key={i} className="flex justify-between text-xs text-gray-500">
              <span className="truncate mr-2">{li.name}{li.qty > 1 ? ` ×${li.qty}` : ""}</span>
              <span className="font-mono shrink-0">{fmtGHS(li.total ?? (li.qty * li.unitPrice))}</span>
            </div>
          ))}
          {inv.line_items.length > 3 && (
            <p className="text-xs text-gray-400 italic">
              +{inv.line_items.length - 3} more item{inv.line_items.length - 3 !== 1 ? "s" : ""}
            </p>
          )}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-gray-100">
        <button
          type="button"
          onClick={() => openInvoicePrint(inv)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-red hover:underline"
        >
          ⬇ Download PDF
        </button>
      </div>
    </div>
  );
}

// ── Customer Documents view — tabbed: Invoices | Receipts ──────────────────────
function CustomerDocumentsView() {
  const [docs,    setDocs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [docTab,  setDocTab]  = useState("invoices");
  const [period,  setPeriod]  = useState(defaultPeriod());

  useEffect(() => {
    listCustomerDocuments()
      .then(setDocs)
      .catch((err) => setError(err.message ?? "Could not load documents."))
      .finally(() => setLoading(false));
  }, []);

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

  const periodDocs = filterByPeriod(docs, period);
  const invoiceDocs = periodDocs.filter((d) => d.type === "quote" || d.type === "invoice");
  const receiptDocs = periodDocs.filter((d) => d.type === "receipt");

  const DOC_TABS = [
    { key: "invoices", label: "Invoices", count: invoiceDocs.length },
    { key: "receipts", label: "Receipts", count: receiptDocs.length },
  ];

  const shown = docTab === "invoices" ? invoiceDocs : receiptDocs;
  const emptyMsg = docTab === "invoices"
    ? (period.year == null ? "No invoices or quotations yet." : "No invoices for this period.")
    : (period.year == null ? "No receipts yet — these appear once payment is confirmed." : "No receipts for this period.");

  return (
    <div>
      {/* Period filter */}
      <div className="mb-4">
        <PeriodPicker period={period} onChange={setPeriod} accentColor="#C0392B" bgVar="--t-bg" />
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl mb-4">
        {DOC_TABS.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setDocTab(key)}
            className={[
              "flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all",
              docTab === key
                ? "bg-brand-red text-white shadow-sm"
                : "text-[var(--t-text2)] hover:bg-white/60 dark:hover:bg-white/10",
            ].join(" ")}
          >
            {label}
            {count > 0 && (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                docTab === key ? "bg-white/20 text-white" : "bg-gray-200 dark:bg-white/10 text-[var(--t-muted)]"
              }`}>
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <div className="text-center py-10 space-y-2">
          <div className="text-4xl">🧾</div>
          <p className="text-sm font-medium text-gray-600">{emptyMsg}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {shown.map((inv) => <DocumentCard key={inv.id} inv={inv} />)}
        </div>
      )}
    </div>
  );
}

// ── Job detail (tabbed view) ───────────────────────────────────────────────────
function JobDetail({ job, onBack, onJobUpdate }) {
  const [tab, setTab] = useState("status");
  const tabs = [
    { key: "status",    label: "Status",           Icon: CheckCircle2 },
    { key: "documents", label: "Documents",        Icon: FileText     },
    { key: "design",    label: "Final Design",     Icon: Tag          },
    { key: "artwork",   label: "Finished Product", Icon: Download     },
  ];

  return (
    <div>
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand-red mb-4 hover:underline"
      >
        <ArrowLeft size={13} /> My Jobs
      </button>

      {/* Job title header */}
      <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4 mb-5 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-base font-bold text-[var(--t-text1)]">
            {job.job_title || "Print Job"}
          </h2>
          <p className="text-xs text-[var(--t-muted)] mt-0.5 font-mono">{job.quote_ref}</p>
        </div>
        <span className={[
          "rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide shrink-0",
          STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-700",
        ].join(" ")}>
          {stageLabel(job.status)}
        </span>
      </div>

      {/* Tab bar with icons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 rounded-xl bg-gray-100 dark:bg-white/5 p-1 mb-5">
        {tabs.map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={[
              "flex items-center justify-center gap-1.5 rounded-lg py-2 px-1 text-xs font-semibold transition-all duration-150 text-center leading-tight",
              tab === key
                ? "bg-white dark:bg-white/10 text-[var(--t-text1)] shadow-sm"
                : "text-[var(--t-muted)] hover:text-[var(--t-text2)]",
            ].join(" ")}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "status"    && <StatusTab          job={job} />}
      {tab === "documents" && <DocumentsTab       job={job} />}
      {tab === "design"    && <FinalDesignTab     job={job} onJobUpdate={onJobUpdate} />}
      {tab === "artwork"   && <FinishedProductTab job={job} />}
    </div>
  );
}

// ── Job list card ──────────────────────────────────────────────────────────────
function JobCard({ job, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full text-left bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] overflow-hidden hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200 active:scale-[0.99]"
    >
      <div className="p-4 space-y-3">

        {/* Status chip + ref on same row */}
        <div className="flex items-center justify-between gap-2">
          <span className={[
            "rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide shrink-0",
            STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-700",
          ].join(" ")}>
            {stageLabel(job.status)}
          </span>
          <span className="text-[10px] font-mono text-[var(--t-muted)] truncate">{job.quote_ref}</span>
        </div>

        {/* Job title */}
        <p className="font-semibold text-[var(--t-text1)] text-sm leading-snug">
          {job.job_title || "Print Job"}
        </p>

        {/* Deadline */}
        {job.deadline && (
          <div className="flex items-center gap-1.5 text-xs text-[var(--t-muted)]">
            <Clock size={11} />
            <span>{new Date(job.deadline).toLocaleDateString("en-GH", {
              day: "numeric", month: "short", year: "numeric",
            })}</span>
          </div>
        )}

        {/* Design status badge */}
        {job.status === "ready_for_design" && !job.design_approved && (
          <div className="rounded-lg bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-2.5 py-1.5">
            <p className="text-[11px] text-purple-700 dark:text-purple-300 font-semibold">Design work in progress</p>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-1 border-t border-[var(--t-border)]">
          <span className="text-[10px] text-[var(--t-muted)]">
            {new Date(job.created_at).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
          </span>
          <span className="text-[11px] text-brand-red font-semibold flex items-center gap-1 group-hover:gap-2 transition-all">
            View details <span aria-hidden="true">→</span>
          </span>
        </div>
      </div>
    </button>
  );
}

// ── Rates tab — public price list (masonry ecommerce layout) ─────────────────
function RatesView() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    listPublicItems()
      .then(setItems)
      .catch((err) => setError(err.message ?? "Could not load rates."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ columns: "2 160px", gap: "12px" }}>
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} className="rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse"
            style={{ height: i % 2 === 0 ? 200 : 140, breakInside: "avoid", marginBottom: 12 }} />
        ))}
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

  if (items.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <div className="text-4xl">🏷️</div>
        <p className="text-sm font-medium text-[var(--t-text2)]">No rates published yet.</p>
        <p className="text-xs text-[var(--t-muted)] max-w-xs mx-auto">
          Our team will publish pricing information here soon.
        </p>
      </div>
    );
  }

  // Group by category
  const grouped = items.reduce((acc, item) => {
    const key = item.category || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category}>
          <div className="text-xs font-bold uppercase tracking-widest text-brand-red mb-4 border-b border-[var(--t-border)] pb-2">
            {category}
          </div>

          {/* Masonry grid */}
          <div style={{ columns: "2 160px", gap: "12px" }}>
            {catItems.map((item) => (
              <div
                key={item.id}
                className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
                style={{ breakInside: "avoid", marginBottom: "12px" }}
              >
                {/* Thumbnail */}
                {item.thumbnail_url ? (
                  <div className="w-full aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-white/5">
                    <img
                      src={item.thumbnail_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="w-full h-24 bg-gradient-to-br from-brand-red/10 to-brand-red/5 flex items-center justify-center">
                    <span className="text-3xl opacity-40">🏷️</span>
                  </div>
                )}

                {/* Content */}
                <div className="p-3">
                  <p className="font-semibold text-[var(--t-text1)] text-sm leading-snug">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-[var(--t-muted)] mt-0.5 leading-relaxed">{item.description}</p>
                  )}
                  {item.item_type === "print" && item.print_specs && (
                    <div className="mt-1.5 space-y-0.5">
                      {item.print_specs.material && (
                        <p className="text-[10px] text-[var(--t-muted)]">🖨️ {item.print_specs.material}</p>
                      )}
                      {item.print_specs.size && (
                        <p className="text-[10px] text-[var(--t-muted)]">📐 {item.print_specs.size}</p>
                      )}
                    </div>
                  )}

                  {/* Price strip */}
                  <div className="mt-3 pt-2.5 border-t border-[var(--t-border)] flex items-baseline justify-between gap-2">
                    <span className="font-bold text-brand-red text-sm whitespace-nowrap">
                      {fmtGHS(item.unit_price)}
                    </span>
                    <span className="text-[10px] text-[var(--t-muted)] shrink-0">per {item.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-center text-xs text-[var(--t-muted)] px-4 pb-2">
        Prices are subject to change. Contact us for a formal quotation tailored to your job.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function CustomerPage() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Top-level section: "jobs" or "documents"
  const [section,         setSection]         = useState("jobs");
  const [jobs,            setJobs]            = useState([]);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState("");
  const [selectedId,      setSelectedId]      = useState(null);
  const [jobPeriod,       setJobPeriod]       = useState(defaultPeriod());
  const [appName,        setAppName]        = useState("Jage Press");
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [accentHex,      setAccentHex]      = useState("#C0392B");
  const [quoteSummary,   setQuoteSummary]   = useState(null);

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s?.company_name)    setAppName(s.company_name);
        if (s?.whatsapp_number) setWhatsappNumber(s.whatsapp_number);
        if (s?.accent_color)    setAccentHex(s.accent_color);
      })
      .catch(() => {});
  }, []);

  const firstName = (profile?.full_name ?? "").split(" ")[0] || "there";

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setJobs(await listCustomerJobs()); }
    catch (err) { setError(err.message ?? "Could not load your jobs."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Reload jobs list when any job row changes — keeps status bar current in real time
  useEffect(() => subscribeToTable("jobs", () => load()), [load]);

  const selectedJob = jobs.find((j) => j.id === selectedId) ?? null;

  // Update a single job in the local list (e.g. after design approval).
  function handleJobUpdate(updatedJob) {
    setJobs((prev) => prev.map((j) => j.id === updatedJob.id ? { ...j, ...updatedJob } : j));
  }

  // When entering a job detail, stay in the "jobs" section
  function handleSelectJob(id) { setSelectedId(id); setSection("jobs"); }

  async function handleSignOut() {
    await signOut().catch(() => {});
    navigate("/login", { replace: true });
  }

  const SECTIONS = [
    { key: "jobs",      label: "My Jobs",      Icon: Briefcase  },
    { key: "quoter",    label: "Get a Price",  Icon: Calculator },
    { key: "documents", label: "My Documents", Icon: FileText   },
    { key: "rates",     label: "Rates",        Icon: Tag        },
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--t-bg)" }}>
      {/* Header */}
      <header className="sticky top-0 z-10 backdrop-blur-sm border-b" style={{ background: "var(--t-surface)", borderColor: "var(--t-border)" }}>
        <div className="mx-auto max-w-3xl px-4 py-4 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-brand-red">
              {appName}
            </p>
            <h1 className="text-sm font-bold text-[var(--t-text1)] mt-0.5 truncate">
              Welcome back, {firstName} 👋
            </h1>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <NotificationBell onJobClick={(jobId) => { setSelectedId(jobId); setSection("jobs"); }} />
            <ThemeToggle />
            <button
              type="button"
              onClick={handleSignOut}
              className="text-xs text-[var(--t-muted)] hover:text-[var(--t-text2)] transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Section tabs — pill style, hidden when inside a job detail */}
        {!selectedJob && (
          <div className="mx-auto max-w-3xl px-4 pb-3">
            <nav className="flex items-center gap-1 p-1 bg-gray-100 dark:bg-white/5 rounded-xl overflow-x-auto scrollbar-none">
              {SECTIONS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSection(key)}
                  className={[
                    "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap",
                    section === key
                      ? "bg-brand-red text-white shadow-sm"
                      : "text-[var(--t-text2)] hover:bg-white/60 dark:hover:bg-white/10",
                  ].join(" ")}
                >
                  <Icon size={13} />
                  {label}
                </button>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Main */}
      <main className="mx-auto max-w-3xl px-4 py-6">
        {error && (
          <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm px-4 py-3">
            {error}
          </div>
        )}

        {/* ── Job detail ── */}
        {selectedJob ? (
          <div className="bg-[var(--t-surface)] rounded-2xl border border-[var(--t-border)] p-5 sm:p-6">
            <JobDetail
              job={selectedJob}
              onBack={() => setSelectedId(null)}
              onJobUpdate={handleJobUpdate}
            />
          </div>
        ) : section === "jobs" ? (
          /* ── Job list ── */
          <>
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <h2 className="text-base font-bold text-[var(--t-text1)]">My Jobs</h2>
              {!loading && jobs.length > 0 && (
                <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-0.5 text-xs font-semibold text-[#6366F1]">
                  {jobs.length} total
                </span>
              )}
            </div>

            {/* Period filter */}
            <div className="mb-4">
              <PeriodPicker period={jobPeriod} onChange={setJobPeriod} accentColor="#C0392B" bgVar="--t-bg" />
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[1,2,3,4].map((i) => (
                  <div key={i} className="h-32 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />
                ))}
              </div>
            ) : jobs.length === 0 ? (
              <div className="text-center py-16 space-y-3">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-white/5 flex items-center justify-center mx-auto">
                  <Briefcase size={28} className="text-[var(--t-muted)]" />
                </div>
                <p className="text-sm font-semibold text-[var(--t-text2)]">No jobs yet</p>
                <p className="text-xs text-[var(--t-muted)] max-w-xs mx-auto">
                  Once your order is placed and linked to your account, it will appear here.
                </p>
              </div>
            ) : (() => {
              const periodFiltered = filterByPeriod(jobs, jobPeriod);
              return periodFiltered.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-[var(--t-muted)]">No jobs in this period.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {periodFiltered.map((job) => (
                    <JobCard
                      key={job.id}
                      job={job}
                      onClick={() => handleSelectJob(job.id)}
                    />
                  ))}
                </div>
              );
            })()}
          </>
        ) : section === "quoter" ? (
          /* ── Instant Quoter ── */
          <>
            <div className="mb-4">
              <h2 className="text-base font-bold text-[var(--t-text1)]">Get a Price</h2>
              <p className="text-xs text-[var(--t-muted)] mt-0.5">
                Instant digital print pricing — see your estimate right away.
              </p>
            </div>
            <InstantQuoter accentHex={accentHex} onResult={setQuoteSummary} />
            <div className="mt-4 flex flex-col items-center gap-2">
              {(() => {
                const waMsg = quoteSummary ? buildInstantQuoteSummary(quoteSummary) : null;
                const waUrl = waMsg && whatsappNumber
                  ? `https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(waMsg)}`
                  : null;
                return (
                  <a
                    href={waUrl || `mailto:`}
                    target={waUrl ? "_blank" : undefined}
                    rel="noreferrer"
                    className={[
                      "inline-flex items-center gap-2 rounded-xl px-8 py-3 text-sm font-bold text-white shadow-md transition-all",
                      waUrl ? "hover:opacity-90 active:scale-95" : "opacity-50 pointer-events-none",
                    ].join(" ")}
                    style={{ background: accentHex }}
                  >
                    Place Order Now
                  </a>
                );
              })()}
              {!quoteSummary && (
                <p className="text-xs text-[var(--t-muted)]">Configure your job above to enable ordering.</p>
              )}
            </div>
          </>
        ) : section === "documents" ? (
          /* ── Documents section ── */
          <>
            <div className="mb-5">
              <h2 className="text-base font-bold text-[var(--t-text1)]">My Documents</h2>
              <p className="text-xs text-[var(--t-muted)] mt-0.5">
                Quotations, invoices and payment receipts issued to your account.
              </p>
            </div>
            <CustomerDocumentsView />
          </>
        ) : (
          /* ── Rates section ── */
          <>
            <div className="mb-5">
              <h2 className="text-base font-bold text-[var(--t-text1)]">Rates</h2>
              <p className="text-xs text-[var(--t-muted)] mt-0.5">
                Our standard pricing for products and services.
              </p>
            </div>
            <RatesView />
          </>
        )}
      </main>

      {/* ── WhatsApp floating button ── */}
      {whatsappNumber && (
        <a
          href={`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, "")}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Chat with us on WhatsApp"
          className="fixed bottom-6 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
          style={{ backgroundColor: "#25D366" }}
        >
          <svg viewBox="0 0 24 24" fill="white" width="28" height="28" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
        </a>
      )}
    </div>
  );
}
