/**
 * JobsTab.jsx  — CS Lobby
 * Full job management: status updates, deadline, customer assignment.
 * CS can move any job through the entire pipeline (all statuses including
 * "Job Completed") and link jobs to registered customer accounts.
 */
import { useState, useEffect, useCallback, useRef } from "react";
import {
  listAllJobsForCS,
  updateJobStatus,
  updateJobDeadline,
  updateJobNotes,
  assignCustomerToJob,
  sendToDesign,
  listJobFinals,
  uploadJobFinal,
  deleteJobFinal,
  getJobFinalUrl,
  deleteJob,
} from "../../lib/jobs.js";
import {
  uploadDesignFile,
  recordJobFile,
  listJobFiles,
  getJobFileSignedUrl,
} from "../../lib/jobFiles.js";
import { useAuth } from "../AuthProvider.jsx";
import { listCustomers } from "../../lib/auth.js";
import { CS_STATUS_OPTIONS, jobStatusLabel } from "../../lib/jobStatus.js";
import { formatGHS } from "../../lib/currency.js";
import { Search, Inbox, X, FileText, Trash2, Upload, Palette, ChevronRight } from "lucide-react";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";

const ACCEPTED = "image/*,video/*,.pdf";
const isImage  = (n) => /\.(jpe?g|png|gif|webp|svg)$/i.test(n);
const isVideo  = (n) => /\.(mp4|mov|webm|avi|mkv)$/i.test(n);
function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
  return (b / 1024 / 1024).toFixed(1) + " MB";
}

const STATUS_BADGE = {
  sent:             "bg-blue-50 text-blue-700 dark:bg-blue-900/20",
  approved:         "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20",
  in_production:    "bg-amber-50 text-amber-700 dark:bg-amber-900/20",
  ready_for_design: "bg-purple-50 text-purple-700 dark:bg-purple-900/20",
  design_ready:     "bg-indigo-50 text-[#6366F1] dark:bg-indigo-900/20",
  at_finishing:     "bg-orange-50 text-orange-700 dark:bg-orange-900/20",
  ready_for_pickup: "bg-teal-50 text-teal-700 dark:bg-teal-900/20",
  delivered:        "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300",
  completed:        "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30",
};

const INP = "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-3.5 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors";
const LBL = "block text-xs font-medium text-[var(--t-text2)] mb-1.5 uppercase tracking-wide";

export function JobsTab({ focusJobId }) {
  const { user, profile } = useAuth();

  const [jobs,      setJobs]      = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [search,    setSearch]    = useState("");
  const [period,    setPeriod]    = useState(defaultPeriod());

  // Expanded job id (shows inline controls)
  const [expandedId, setExpandedId] = useState(null);

  // Auto-expand when navigated from a notification
  useEffect(() => {
    if (focusJobId) setExpandedId(focusJobId);
  }, [focusJobId]);

  // Delete state (admin only)
  const [deleting, setDeleting] = useState({}); // { [jobId]: true }

  // Per-job saving state
  const [saving, setSaving]   = useState({}); // { [jobId]: true }
  const [msg,    setMsg]      = useState({}); // { [jobId]: "✓ Saved" }

  // Customer picker state
  const [assignSearch, setAssignSearch] = useState("");

  // ── Design files — keyed by jobId ────────────────────────────────────────────
  const [designFiles,    setDesignFiles]    = useState({});  // { [jobId]: [{id, file_name, file_path}] }
  const [designLoaded,   setDesignLoaded]   = useState({});  // { [jobId]: true }
  const [designUploading,setDesignUploading]= useState({});  // { [jobId]: true }
  const [designUploadMsg,setDesignUploadMsg]= useState({});  // { [jobId]: string }

  // ── Customer uploads — keyed by jobId ────────────────────────────────────────
  const [customerFiles,       setCustomerFiles]       = useState({});  // { [jobId]: [{id, file_name, file_path}] }
  const [customerFilesLoaded, setCustomerFilesLoaded] = useState({});  // { [jobId]: true }
  const designFileInputRef = useRef(null);
  const [designUploadTarget, setDesignUploadTarget] = useState(null);

  // ── Final artwork state — keyed by jobId ─────────────────────────────────────
  const [artworkFiles,  setArtworkFiles]  = useState({});
  const [artworkUrls,   setArtworkUrls]   = useState({});
  const [artworkLoaded, setArtworkLoaded] = useState({});
  const [uploading,     setUploading]     = useState({}); // { [jobId]: true }
  const [uploadMsg,     setUploadMsg]     = useState({}); // { [jobId]: string }
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null); // jobId being uploaded to

  // ── Notes — keyed by jobId ───────────────────────────────────────────────────
  const [notesDraft, setNotesDraft] = useState({}); // { [jobId]: string }

  async function loadDesignFiles(jobId) {
    try {
      const files = await listJobFiles(jobId, "design");
      setDesignFiles((p) => ({ ...p, [jobId]: files }));
      setDesignLoaded((p) => ({ ...p, [jobId]: true }));
    } catch { /* silently ignore */ }
  }

  async function loadCustomerFiles(jobId) {
    try {
      const files = await listJobFiles(jobId, "customer_upload");
      setCustomerFiles((p) => ({ ...p, [jobId]: files }));
      setCustomerFilesLoaded((p) => ({ ...p, [jobId]: true }));
    } catch { /* silently ignore */ }
  }

  async function handleDesignUpload(jobId, file) {
    setDesignUploading((u) => ({ ...u, [jobId]: true }));
    setDesignUploadMsg((m) => ({ ...m, [jobId]: "" }));
    try {
      const path = await uploadDesignFile(jobId, file);
      await recordJobFile({
        jobId,
        fileType: "design",
        fileName: file.name,
        filePath: path,
        uploadedBy: user?.id,
      });
      await loadDesignFiles(jobId);
      setDesignUploadMsg((m) => ({ ...m, [jobId]: `✓ "${file.name}" uploaded` }));
      setTimeout(() => setDesignUploadMsg((m) => ({ ...m, [jobId]: "" })), 3000);
    } catch (err) {
      setDesignUploadMsg((m) => ({ ...m, [jobId]: "Error: " + (err.message ?? "Upload failed") }));
    } finally {
      setDesignUploading((u) => ({ ...u, [jobId]: false }));
    }
  }

  async function handleViewDesignFile(filePath) {
    try {
      const url = await getJobFileSignedUrl(filePath);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(err.message ?? "Could not load file.");
    }
  }

  async function loadArtwork(jobId) {
    try {
      const files = await listJobFinals(jobId);
      const entries = await Promise.all(
        files.map(async (f) => {
          try { return [f.name, await getJobFinalUrl(jobId, f.name)]; }
          catch { return [f.name, null]; }
        })
      );
      setArtworkFiles((p) => ({ ...p, [jobId]: files }));
      setArtworkUrls((p) => ({ ...p, [jobId]: Object.fromEntries(entries) }));
      setArtworkLoaded((p) => ({ ...p, [jobId]: true }));
    } catch { /* silently ignore */ }
  }

  async function handleUpload(jobId, file) {
    setUploading((u) => ({ ...u, [jobId]: true }));
    setUploadMsg((m) => ({ ...m, [jobId]: "" }));
    try {
      await uploadJobFinal(jobId, file);
      await loadArtwork(jobId);
      setUploadMsg((m) => ({ ...m, [jobId]: `✓ "${file.name}" uploaded` }));
      setTimeout(() => setUploadMsg((m) => ({ ...m, [jobId]: "" })), 3000);
    } catch (err) {
      setUploadMsg((m) => ({ ...m, [jobId]: "Error: " + (err.message ?? "Upload failed") }));
    } finally {
      setUploading((u) => ({ ...u, [jobId]: false }));
    }
  }

  async function handleDeleteArtwork(jobId, fileName) {
    if (!window.confirm(`Remove "${fileName}" from this job? The customer will no longer see it.`)) return;
    try {
      await deleteJobFinal(jobId, fileName);
      setArtworkFiles((p) => ({ ...p, [jobId]: (p[jobId] ?? []).filter((f) => f.name !== fileName) }));
      setArtworkUrls((p) => {
        const next = { ...(p[jobId] ?? {}) };
        delete next[fileName];
        return { ...p, [jobId]: next };
      });
    } catch (err) {
      alert("Could not delete: " + (err.message ?? "Unknown error"));
    }
  }

  async function handleDeleteJob(job) {
    if (!window.confirm(`Permanently delete "${job.job_title || job.quote_ref}"? This cannot be undone.`)) return;
    setDeleting((d) => ({ ...d, [job.id]: true }));
    try {
      await deleteJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
      setExpandedId((id) => (id === job.id ? null : id));
    } catch (err) {
      alert("Could not delete: " + (err.message ?? "Unknown error"));
    } finally {
      setDeleting((d) => ({ ...d, [job.id]: false }));
    }
  }

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [jobData, custData] = await Promise.all([
        listAllJobsForCS(),
        listCustomers(),
      ]);
      setJobs(jobData);
      setCustomers(custData);
    } catch (err) {
      setError(err.message ?? "Could not load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleExpand(id) {
    setExpandedId((prev) => {
      const next = prev === id ? null : id;
      if (next) {
        if (!designLoaded[next])        loadDesignFiles(next);
        if (!artworkLoaded[next])       loadArtwork(next);
        if (!customerFilesLoaded[next]) loadCustomerFiles(next);
        const job = jobs.find((j) => j.id === next);
        if (job) setNotesDraft((d) => ({ ...d, [next]: d[next] ?? (job.notes ?? "") }));
      }
      return next;
    });
    setAssignSearch("");
  }

  function setSavingFor(id, val) {
    setSaving((s) => ({ ...s, [id]: val }));
  }
  function setMsgFor(id, text) {
    setMsg((m) => ({ ...m, [id]: text }));
    if (text) setTimeout(() => setMsg((m) => ({ ...m, [id]: "" })), 2500);
  }

  async function handleStatusChange(job, newStatus) {
    setSavingFor(job.id, true);
    try {
      const updated = await updateJobStatus(job.id, newStatus);
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: updated.status } : j));
      setMsgFor(job.id, "✓ Status updated");
    } catch (err) {
      setMsgFor(job.id, "Error: " + (err.message ?? "Could not update"));
    } finally {
      setSavingFor(job.id, false);
    }
  }

  async function handleDeadlineChange(job, deadline) {
    setSavingFor(job.id, true);
    try {
      const updated = await updateJobDeadline(job.id, deadline || null);
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, deadline: updated.deadline } : j));
      setMsgFor(job.id, "✓ Deadline saved");
    } catch (err) {
      setMsgFor(job.id, "Error: " + (err.message ?? "Could not update"));
    } finally {
      setSavingFor(job.id, false);
    }
  }

  async function handleNotesSave(job, notes) {
    try {
      const updated = await updateJobNotes(job.id, notes);
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, notes: updated.notes } : j));
      setMsgFor(job.id, "✓ Notes saved");
    } catch (err) {
      setMsgFor(job.id, "Error: " + (err.message ?? "Could not save notes"));
    }
  }

  async function handleAssign(job, customerUserId) {
    setSavingFor(job.id, true);
    try {
      await assignCustomerToJob(job.id, customerUserId || null);
      setJobs((prev) =>
        prev.map((j) => j.id === job.id ? { ...j, customer_id: customerUserId || null } : j)
      );
      setMsgFor(job.id, customerUserId ? "✓ Customer linked" : "✓ Link removed");
    } catch (err) {
      setMsgFor(job.id, "Error: " + (err.message ?? "Could not save"));
    } finally {
      setSavingFor(job.id, false);
    }
  }

  const filteredCustomers = customers.filter((c) => {
    if (!assignSearch.trim()) return true;
    const q = assignSearch.toLowerCase();
    return (c.full_name ?? "").toLowerCase().includes(q)
        || (c.phone ?? "").toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-3">
        {[1,2,3].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />
        ))}
      </div>
    );
  }

  const periodJobs = filterByPeriod(jobs, period);
  const filteredJobs = periodJobs.filter((j) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (j.job_title ?? "").toLowerCase().includes(q)
        || (j.client_name ?? "").toLowerCase().includes(q)
        || (j.quote_ref ?? "").toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Header + search */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-lg font-semibold text-[var(--t-text1)]">Active Jobs</h2>
          <p className="text-xs text-[var(--t-muted)] mt-0.5">
            Update status, set deadlines, and link customer accounts.
          </p>
        </div>
        <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-0.5 text-xs font-semibold text-[#6366F1]">
          {jobs.length} job{jobs.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Period filter */}
      <div className="mb-4">
        <PeriodPicker period={period} onChange={setPeriod} accentColor="#6366F1" bgVar="--t-bg" />
      </div>

      {/* Search bar */}
      <div className="relative mb-5">
        <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
        <input
          type="text"
          placeholder="Search jobs by title, client or ref..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] pl-9 pr-4 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors"
        />
      </div>

      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Inbox size={40} className="text-[var(--t-muted)] mb-3" />
          <p className="font-medium text-[var(--t-text2)]">
            {search ? "No jobs match your search" : "No jobs yet"}
          </p>
          <p className="text-xs text-[var(--t-muted)] mt-1">
            {search ? "Try a different search term" : "Approve a quote to create the first job."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => {
              const linked      = customers.find((c) => c.user_id === job.customer_id);
              const needsDesign = job.needs_design || job.quote?.needsDesign === true;

              return (
                <div
                  key={job.id}
                  className="group bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] overflow-hidden transition-all duration-200 hover:shadow-card-hover hover:-translate-y-0.5"
                >
                  {/* ── Summary row ── */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(job.id)}
                    className="w-full text-left flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-white/3 transition-colors"
                  >
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-[var(--t-text1)] truncate">
                        {job.job_title || "Untitled job"}
                      </p>
                      <p className="text-xs font-mono text-[var(--t-muted)] mt-0.5">
                        {job.quote_ref}
                        {job.client_name && ` · ${job.client_name}`}
                      </p>
                      {linked && (
                        <p className="text-xs text-emerald-600 mt-0.5 font-medium">
                          {linked.full_name}
                        </p>
                      )}
                      {needsDesign && (
                        <p className="text-xs text-purple-600 mt-0.5 font-medium">Needs design</p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className={[
                        "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-700 dark:bg-white/10",
                      ].join(" ")}>
                        {jobStatusLabel(job.status)}
                      </span>
                      {job.deadline && (() => {
                        const dl = new Date(job.deadline);
                        const overdue = dl < new Date() && !["delivered","completed"].includes(job.status);
                        return (
                          <span className={`text-xs whitespace-nowrap ${overdue ? "text-red-600 font-semibold" : "text-[var(--t-muted)]"}`}>
                            {overdue ? "⚠ " : ""}{dl.toLocaleDateString("en-GH", { day: "numeric", month: "short" })}
                          </span>
                        );
                      })()}
                      <span className="text-brand-red text-xs font-semibold">
                        {formatGHS(job.deposit_amount)} dep.
                      </span>
                      <ChevronRight size={14} className="text-[var(--t-muted)] opacity-0 group-hover:opacity-100 transition-opacity duration-150" />
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        )}

      {/* ── Job detail modal ── */}
      {(() => {
        const job = filteredJobs.find((j) => j.id === expandedId);
        if (!job) return null;
        const isSaving    = !!saving[job.id];
        const feedback    = msg[job.id] ?? "";
        const linked      = customers.find((c) => c.user_id === job.customer_id);
        const needsDesign = job.needs_design || job.quote?.needsDesign === true;

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4">
            {/* Blur backdrop */}
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setExpandedId(null)}
            />

            {/* Panel */}
            <div className="relative z-10 bg-[var(--t-surface)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl animate-scale-in">

              {/* Modal header */}
              <div className="sticky top-0 z-10 bg-[var(--t-surface)] border-b border-[var(--t-border)] px-6 py-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="font-bold text-[var(--t-text1)] text-base truncate">
                    {job.job_title || "Untitled job"}
                  </p>
                  <p className="text-xs font-mono text-[var(--t-muted)] mt-0.5">
                    {job.quote_ref}{job.client_name && ` · ${job.client_name}`}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={[
                    "rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-700 dark:bg-white/10",
                  ].join(" ")}>
                    {jobStatusLabel(job.status)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setExpandedId(null)}
                    className="flex items-center justify-center w-8 h-8 rounded-lg text-[var(--t-muted)] hover:text-[var(--t-text1)] hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
                    aria-label="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Two-column body */}
              <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-6">

                {/* ── Left column: Status · Deadline · Customer Portal ── */}
                <div className="space-y-5">
                  <div>
                    <label className={LBL}>Job Status</label>
                    <select
                      value={job.status}
                      disabled={isSaving}
                      onChange={(e) => handleStatusChange(job, e.target.value)}
                      className={INP}
                    >
                      {CS_STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Send to Design Team */}
                  {needsDesign && job.status !== "ready_for_design" && job.status !== "design_ready" && (
                    <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 p-4">
                      <p className="text-sm font-semibold text-purple-800 dark:text-purple-300 mb-1">🎨 Needs design work</p>
                      <p className="text-xs text-purple-600 dark:text-purple-400 mb-3">
                        Send it to the Design team — it will appear in the Designer lobby.
                      </p>
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={async () => {
                          setSavingFor(job.id, true);
                          try {
                            const updated = await sendToDesign(job.id);
                            setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, ...updated } : j));
                            setMsgFor(job.id, "✓ Sent to Design team");
                          } catch (err) {
                            setMsgFor(job.id, "Error: " + (err.message ?? "Could not update"));
                          } finally {
                            setSavingFor(job.id, false);
                          }
                        }}
                        className="inline-flex items-center gap-2 rounded-lg bg-purple-700 text-white text-xs font-semibold px-3 py-1.5 hover:bg-purple-800 disabled:opacity-60 transition-colors"
                      >
                        🎨 Send to Design Team
                      </button>
                    </div>
                  )}

                  {needsDesign && job.status === "ready_for_design" && (
                    <div className="rounded-xl bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 px-4 py-3">
                      <p className="text-xs font-semibold text-purple-700 dark:text-purple-300">✓ Currently with the Design team</p>
                    </div>
                  )}

                  {needsDesign && job.status === "design_ready" && (
                    <div className="rounded-xl bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800 px-4 py-3">
                      <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">✓ Design completed by designer</p>
                    </div>
                  )}

                  <div>
                    <label className={LBL}>Deadline</label>
                    <input
                      type="date"
                      defaultValue={job.deadline ?? ""}
                      disabled={isSaving}
                      onBlur={(e) => {
                        if (e.target.value !== (job.deadline ?? "")) {
                          handleDeadlineChange(job, e.target.value);
                        }
                      }}
                      className={INP}
                    />
                  </div>

                  <div>
                    <label className={LBL}>Internal Notes</label>
                    <textarea
                      rows={3}
                      placeholder="Staff-only notes (not visible to customers)…"
                      value={notesDraft[job.id] ?? (job.notes ?? "")}
                      onChange={(e) => setNotesDraft((d) => ({ ...d, [job.id]: e.target.value }))}
                      onBlur={(e) => {
                        const val = e.target.value;
                        if (val !== (job.notes ?? "")) handleNotesSave(job, val);
                      }}
                      className={`${INP} resize-none`}
                    />
                  </div>

                  <div>
                    <label className={LBL}>Customer Portal Access</label>
                    {linked ? (
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="text-sm font-medium text-green-700 dark:text-green-400">
                          ✓ {linked.full_name}
                        </span>
                        <button
                          type="button"
                          disabled={isSaving}
                          onClick={() => handleAssign(job, null)}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setAssignSearch(" ")}
                          className="text-xs text-[var(--t-muted)] hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                        Not linked — customer cannot see this job.
                      </p>
                    )}
                    <input
                      type="text"
                      placeholder="Search customer by name or phone..."
                      value={assignSearch}
                      onChange={(e) => setAssignSearch(e.target.value)}
                      className={INP}
                    />
                    {assignSearch.trim() && (
                      <div className="mt-1 rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] overflow-hidden max-h-44 overflow-y-auto shadow-sm animate-slide-down">
                        {filteredCustomers.length === 0 ? (
                          <p className="px-3 py-2.5 text-xs text-[var(--t-muted)] italic">No matches.</p>
                        ) : (
                          filteredCustomers.map((c) => (
                            <button
                              key={c.user_id}
                              type="button"
                              disabled={isSaving}
                              onClick={() => { handleAssign(job, c.user_id); setAssignSearch(""); }}
                              className={[
                                "w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 dark:hover:bg-white/5 transition-colors border-b border-[var(--t-border)] last:border-0",
                                job.customer_id === c.user_id
                                  ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 font-medium"
                                  : "text-[var(--t-text1)]",
                              ].join(" ")}
                            >
                              {c.full_name}
                              {c.phone && <span className="text-[var(--t-muted)] text-xs ml-2">{c.phone}</span>}
                              {job.customer_id === c.user_id && <span className="ml-2 text-emerald-600 text-xs">current</span>}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* ── Right column: Customer Resources · Design Files · Final Artwork ── */}
                <div className="space-y-5">

                  {/* Customer Resources */}
                  <div>
                    <label className={LBL}>Customer Resources</label>
                    <p className="text-xs text-[var(--t-muted)] mb-3">
                      Files uploaded by the customer for this job.
                    </p>
                    {customerFilesLoaded[job.id] ? (
                      (customerFiles[job.id] ?? []).length === 0 ? (
                        <p className="text-xs text-[var(--t-muted)] italic">No files uploaded by the customer yet.</p>
                      ) : (
                        <ul className="space-y-2">
                          {(customerFiles[job.id] ?? []).map((f) => (
                            <li key={f.id} className="flex items-center gap-3 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5">
                              <FileText size={14} className="text-teal-500 shrink-0" />
                              <span className="flex-1 text-xs font-medium text-[var(--t-text1)] truncate min-w-0">{f.file_name}</span>
                              <button
                                type="button"
                                onClick={() => handleViewDesignFile(f.file_path)}
                                className="shrink-0 text-xs font-semibold text-teal-600 hover:underline"
                              >
                                View
                              </button>
                            </li>
                          ))}
                        </ul>
                      )
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin" />
                    )}
                  </div>

                  {/* Design Files */}
                  <div>
                    <label className={LBL}>Design Files</label>
                    <p className="text-xs text-[var(--t-muted)] mb-3">
                      Artwork from designers. Customers can review and approve from their portal.
                    </p>
                    <input
                      ref={designFileInputRef}
                      type="file"
                      accept="image/*,application/pdf,.ai,.eps,.psd,.indd"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && designUploadTarget) await handleDesignUpload(designUploadTarget, file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={!!designUploading[job.id]}
                      onClick={() => {
                        setDesignUploadTarget(job.id);
                        setTimeout(() => designFileInputRef.current?.click(), 50);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-purple-600 text-white text-xs font-semibold px-4 py-2 hover:bg-purple-700 active:scale-95 disabled:opacity-60 transition-all duration-150"
                    >
                      {designUploading[job.id] ? (
                        <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" /> Uploading...</>
                      ) : (
                        <><Palette size={12} /> Upload Design File</>
                      )}
                    </button>
                    {designUploadMsg[job.id] && (
                      <p className={["text-xs mt-2 font-medium", (designUploadMsg[job.id] ?? "").startsWith("Error") ? "text-red-600" : "text-green-700"].join(" ")}>
                        {designUploadMsg[job.id]}
                      </p>
                    )}
                    {designLoaded[job.id] && (
                      (designFiles[job.id] ?? []).length === 0 ? (
                        <p className="mt-2 text-xs text-[var(--t-muted)] italic">No design files yet.</p>
                      ) : (
                        <ul className="mt-3 space-y-2">
                          {(designFiles[job.id] ?? []).map((f) => (
                            <li key={f.id} className="flex items-center gap-3 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-colors">
                              <FileText size={14} className="text-purple-500 shrink-0" />
                              <span className="flex-1 text-xs font-medium text-[var(--t-text1)] truncate min-w-0">{f.file_name}</span>
                              <button
                                type="button"
                                onClick={() => handleViewDesignFile(f.file_path)}
                                className="shrink-0 text-xs font-semibold text-[#6366F1] hover:underline"
                              >
                                View
                              </button>
                            </li>
                          ))}
                        </ul>
                      )
                    )}
                  </div>

                  {/* Final Artwork */}
                  <div>
                    <label className={LBL}>Final Artwork</label>
                    <p className="text-xs text-[var(--t-muted)] mb-3">
                      Images/videos visible in the customer portal. Auto-removed 4 weeks after upload.
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED}
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file && uploadTarget) await handleUpload(uploadTarget, file);
                        e.target.value = "";
                      }}
                    />
                    <button
                      type="button"
                      disabled={!!uploading[job.id]}
                      onClick={() => {
                        setUploadTarget(job.id);
                        setTimeout(() => fileInputRef.current?.click(), 50);
                      }}
                      className="inline-flex items-center gap-2 rounded-lg bg-[#6366F1] text-white text-xs font-semibold px-4 py-2 hover:bg-[#4F46E5] active:scale-95 disabled:opacity-60 transition-all duration-150"
                    >
                      {uploading[job.id] ? (
                        <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin inline-block" /> Uploading...</>
                      ) : (
                        <><Upload size={12} /> Upload Image / Video</>
                      )}
                    </button>
                    {uploadMsg[job.id] && (
                      <p className={["text-xs mt-2 font-medium", (uploadMsg[job.id] ?? "").startsWith("Error") ? "text-red-600" : "text-green-700"].join(" ")}>
                        {uploadMsg[job.id]}
                      </p>
                    )}
                    {artworkLoaded[job.id] && (artworkFiles[job.id] ?? []).length > 0 && (
                      <div className="mt-3 space-y-2">
                        {(artworkFiles[job.id] ?? []).map((f) => {
                          const url = artworkUrls[job.id]?.[f.name];
                          return (
                            <div key={f.name} className="flex items-center gap-3 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] p-2.5">
                              <div className="w-10 h-10 rounded-md overflow-hidden bg-gray-100 dark:bg-white/10 shrink-0 flex items-center justify-center">
                                {isImage(f.name) && url ? (
                                  <img src={url} alt={f.name} className="w-full h-full object-cover" />
                                ) : isVideo(f.name) ? (
                                  <span className="text-xl">🎬</span>
                                ) : (
                                  <span className="text-xl">📎</span>
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-[var(--t-text1)] truncate">{f.name}</p>
                                {f.metadata?.size && <p className="text-[10px] text-[var(--t-muted)]">{fmtBytes(f.metadata.size)}</p>}
                              </div>
                              <button
                                type="button"
                                onClick={() => handleDeleteArtwork(job.id, f.name)}
                                className="text-[var(--t-muted)] hover:text-red-600 transition-colors shrink-0"
                                title="Remove file"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {artworkLoaded[job.id] && (artworkFiles[job.id] ?? []).length === 0 && (
                      <p className="mt-2 text-xs text-[var(--t-muted)] italic">No artwork uploaded yet.</p>
                    )}
                  </div>
                </div>
              </div>

              {/* Modal footer: delete + feedback */}
              <div className="sticky bottom-0 bg-[var(--t-surface)] border-t border-[var(--t-border)] px-6 py-3 flex items-center justify-between gap-4">
                <div>
                  {(isSaving || feedback) && (
                    <p className={["text-xs font-medium", feedback.startsWith("Error") ? "text-red-600" : "text-emerald-600"].join(" ")}>
                      {isSaving ? "Saving..." : feedback}
                    </p>
                  )}
                </div>
                {profile?.role === "admin" && (
                  <button
                    type="button"
                    disabled={!!deleting[job.id]}
                    onClick={() => handleDeleteJob(job)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 dark:border-red-900/30 text-red-600 dark:text-red-400 text-xs font-semibold px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 disabled:opacity-60 transition-all duration-150"
                  >
                    <Trash2 size={11} />
                    {deleting[job.id] ? "Deleting..." : "Delete job"}
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
