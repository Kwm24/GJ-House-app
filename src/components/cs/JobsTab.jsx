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
  assignCustomerToJob,
  listJobFinals,
  uploadJobFinal,
  deleteJobFinal,
  getJobFinalUrl,
} from "../../lib/jobs.js";
import { listCustomers } from "../../lib/auth.js";
import { CS_STATUS_OPTIONS, jobStatusLabel } from "../../lib/jobStatus.js";
import { formatGHS } from "../../lib/currency.js";

const ACCEPTED = "image/*,video/*,.pdf";
const isImage  = (n) => /\.(jpe?g|png|gif|webp|svg)$/i.test(n);
const isVideo  = (n) => /\.(mp4|mov|webm|avi|mkv)$/i.test(n);
function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
  return (b / 1024 / 1024).toFixed(1) + " MB";
}

const STATUS_BADGE = {
  sent:             "bg-blue-100 text-blue-800",
  approved:         "bg-green-100 text-green-800",
  in_production:    "bg-yellow-100 text-yellow-800",
  ready_for_design: "bg-purple-100 text-purple-800",
  design_ready:     "bg-indigo-100 text-indigo-800",
  at_finishing:     "bg-orange-100 text-orange-800",
  ready_for_pickup: "bg-teal-100 text-teal-800",
  delivered:        "bg-gray-200 text-gray-800",
  completed:        "bg-green-700 text-white",
};

export function JobsTab() {
  const [jobs,      setJobs]      = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  // Expanded job id (shows inline controls)
  const [expandedId, setExpandedId] = useState(null);

  // Per-job saving state
  const [saving, setSaving]   = useState({}); // { [jobId]: true }
  const [msg,    setMsg]      = useState({}); // { [jobId]: "✓ Saved" }

  // Customer picker state
  const [assignSearch, setAssignSearch] = useState("");

  // Final artwork state — keyed by jobId
  // artworkFiles: { [jobId]: [{name, size, ...}] }
  // artworkUrls:  { [jobId]: { [fileName]: url } }
  // artworkLoaded: { [jobId]: true }
  const [artworkFiles,  setArtworkFiles]  = useState({});
  const [artworkUrls,   setArtworkUrls]   = useState({});
  const [artworkLoaded, setArtworkLoaded] = useState({});
  const [uploading,     setUploading]     = useState({}); // { [jobId]: true }
  const [uploadMsg,     setUploadMsg]     = useState({}); // { [jobId]: string }
  const fileInputRef = useRef(null);
  const [uploadTarget, setUploadTarget] = useState(null); // jobId being uploaded to

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
      if (next && !artworkLoaded[next]) loadArtwork(next);
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
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 rounded-full border-2 border-brand-cream/30 border-t-brand-red animate-spin" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Active Jobs</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Update status, set deadlines, and link customer accounts.
            </p>
          </div>
          <span className="text-xs text-gray-400">{jobs.length} job{jobs.length !== 1 ? "s" : ""}</span>
        </div>

        {jobs.length === 0 ? (
          <p className="text-center py-10 text-sm text-gray-500">
            No jobs yet. Approve a quote to create the first job.
          </p>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => {
              const isOpen    = expandedId === job.id;
              const isSaving  = !!saving[job.id];
              const feedback  = msg[job.id] ?? "";
              const linked    = customers.find((c) => c.user_id === job.customer_id);

              return (
                <div
                  key={job.id}
                  className="rounded-xl border border-gray-200 bg-white overflow-hidden"
                >
                  {/* ── Summary row ── */}
                  <button
                    type="button"
                    onClick={() => toggleExpand(job.id)}
                    className="w-full text-left flex flex-col sm:flex-row sm:items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                  >
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-brand-dark truncate">
                        {job.job_title || "Untitled job"}
                      </p>
                      <p className="text-xs font-mono text-gray-400 mt-0.5">
                        {job.quote_ref}
                        {job.client_name && ` · ${job.client_name}`}
                      </p>
                      {linked && (
                        <p className="text-xs text-green-700 mt-0.5 font-medium">
                          👤 {linked.full_name}
                        </p>
                      )}
                    </div>

                    {/* Badges */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <span className={[
                        "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                        STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-700",
                      ].join(" ")}>
                        {jobStatusLabel(job.status)}
                      </span>
                      {job.deadline && (
                        <span className="text-xs text-gray-500 whitespace-nowrap">
                          📅 {new Date(job.deadline).toLocaleDateString("en-GH", {
                            day: "numeric", month: "short",
                          })}
                        </span>
                      )}
                      <span className="text-brand-red text-xs font-semibold">
                        {formatGHS(job.deposit_amount)} dep.
                      </span>
                      <span className="text-gray-400 text-xs ml-1">
                        {isOpen ? "▲" : "▼"}
                      </span>
                    </div>
                  </button>

                  {/* ── Expanded controls ── */}
                  {isOpen && (
                    <div className="border-t border-gray-200 bg-gray-50 p-4 space-y-4">

                      {/* Status */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          Job Status
                        </label>
                        <select
                          value={job.status}
                          disabled={isSaving}
                          onChange={(e) => handleStatusChange(job, e.target.value)}
                          className="w-full sm:w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                        >
                          {CS_STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Deadline */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          Deadline
                        </label>
                        <input
                          type="date"
                          defaultValue={job.deadline ?? ""}
                          disabled={isSaving}
                          onBlur={(e) => {
                            if (e.target.value !== (job.deadline ?? "")) {
                              handleDeadlineChange(job, e.target.value);
                            }
                          }}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                        />
                      </div>

                      {/* Customer assignment */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          Customer Portal Access
                        </label>
                        {linked ? (
                          <div className="flex items-center gap-3">
                            <span className="text-sm font-medium text-green-700">
                              ✓ Linked to {linked.full_name}
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
                              className="text-xs text-gray-500 hover:underline"
                            >
                              Change
                            </button>
                          </div>
                        ) : (
                          <p className="text-xs text-amber-700 mb-2">
                            Not linked — customer cannot see this job in their portal.
                          </p>
                        )}

                        <input
                          type="text"
                          placeholder="Search customer by name or phone…"
                          value={assignSearch}
                          onChange={(e) => setAssignSearch(e.target.value)}
                          className="mt-1 w-full sm:w-80 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40"
                        />

                        {assignSearch.trim() && (
                          <div className="mt-1 rounded-lg border border-gray-200 bg-white overflow-hidden w-full sm:w-80 max-h-44 overflow-y-auto shadow-sm">
                            {filteredCustomers.length === 0 ? (
                              <p className="px-3 py-2.5 text-xs text-gray-500 italic">
                                No registered customers match — ask them to sign up at /signup.
                              </p>
                            ) : (
                              filteredCustomers.map((c) => (
                                <button
                                  key={c.user_id}
                                  type="button"
                                  disabled={isSaving}
                                  onClick={() => {
                                    handleAssign(job, c.user_id);
                                    setAssignSearch("");
                                  }}
                                  className={[
                                    "w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors border-b border-gray-100 last:border-0",
                                    job.customer_id === c.user_id
                                      ? "bg-green-50 text-green-800 font-medium"
                                      : "text-gray-800",
                                  ].join(" ")}
                                >
                                  {c.full_name}
                                  {c.phone && <span className="text-gray-400 text-xs ml-2">{c.phone}</span>}
                                  {job.customer_id === c.user_id && <span className="ml-2 text-green-600 text-xs">✓ current</span>}
                                </button>
                              ))
                            )}
                          </div>
                        )}
                      </div>

                      {/* ── Final Artwork ── */}
                      <div>
                        <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                          Final Artwork
                        </label>
                        <p className="text-xs text-gray-500 mb-3">
                          Images and videos uploaded here appear in the customer's portal.
                          Customers can download them. Files are automatically removed 4 weeks after upload.
                        </p>

                        {/* Upload button */}
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
                          className="inline-flex items-center gap-2 rounded-lg bg-brand-dark text-brand-cream text-xs font-semibold px-4 py-2 hover:bg-brand-dark/80 disabled:opacity-60 transition-colors"
                        >
                          {uploading[job.id] ? (
                            <>
                              <span className="h-3.5 w-3.5 rounded-full border-2 border-brand-cream/30 border-t-brand-cream animate-spin inline-block" />
                              Uploading…
                            </>
                          ) : (
                            <>📤 Upload Image / Video</>
                          )}
                        </button>

                        {uploadMsg[job.id] && (
                          <p className={[
                            "text-xs mt-2 font-medium",
                            (uploadMsg[job.id] ?? "").startsWith("Error") ? "text-red-600" : "text-green-700",
                          ].join(" ")}>
                            {uploadMsg[job.id]}
                          </p>
                        )}

                        {/* Uploaded files list */}
                        {artworkLoaded[job.id] && (artworkFiles[job.id] ?? []).length > 0 && (
                          <div className="mt-3 space-y-2">
                            {(artworkFiles[job.id] ?? []).map((f) => {
                              const url = artworkUrls[job.id]?.[f.name];
                              return (
                                <div key={f.name} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5">
                                  {/* Thumbnail */}
                                  <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                                    {isImage(f.name) && url ? (
                                      <img src={url} alt={f.name} className="w-full h-full object-cover" />
                                    ) : isVideo(f.name) ? (
                                      <span className="text-2xl">🎬</span>
                                    ) : (
                                      <span className="text-2xl">📎</span>
                                    )}
                                  </div>
                                  {/* Name + size */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-gray-800 truncate">{f.name}</p>
                                    {f.metadata?.size && (
                                      <p className="text-[10px] text-gray-400">{fmtBytes(f.metadata.size)}</p>
                                    )}
                                  </div>
                                  {/* Delete */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteArtwork(job.id, f.name)}
                                    className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0"
                                    title="Remove file"
                                  >
                                    ×
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {artworkLoaded[job.id] && (artworkFiles[job.id] ?? []).length === 0 && (
                          <p className="mt-2 text-xs text-gray-400 italic">No files uploaded yet.</p>
                        )}
                      </div>

                      {/* Feedback */}
                      {(isSaving || feedback) && (
                        <p className={[
                          "text-xs font-medium",
                          feedback.startsWith("Error") ? "text-red-600" : "text-green-700",
                        ].join(" ")}>
                          {isSaving ? "Saving…" : feedback}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
