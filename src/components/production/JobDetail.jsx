import { useState, useEffect, useCallback, useRef } from "react";
import {
  getJob,
  updateJobStatus,
  updateJobDeadline,
  updateJobNotes,
  listJobFinals,
  uploadJobFinal,
  deleteJobFinal,
  getJobFinalUrl,
} from "../../lib/jobs.js";
import { getInvoiceByRef } from "../../lib/invoices.js";
import { PRODUCTION_STATUS_OPTIONS, jobStatusLabel } from "../../lib/jobStatus.js";
import { SpecSheet } from "../SpecSheet.jsx";
import { JobFilesList } from "../JobFilesList.jsx";

const ACCEPTED_FINALS = "image/*,video/*";
const isImage = (n) => /\.(jpe?g|png|gif|webp|svg)$/i.test(n);
const isVideo = (n) => /\.(mp4|mov|webm|avi|mkv)$/i.test(n);
function fmtBytes(b) {
  if (b < 1024) return b + " B";
  if (b < 1024 * 1024) return (b / 1024).toFixed(0) + " KB";
  return (b / 1024 / 1024).toFixed(1) + " MB";
}

export function JobDetail({ jobId, onBack }) {
  const [job,              setJob]              = useState(null);
  const [invoiceLineItems, setInvoiceLineItems] = useState([]);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState("");
  const [statusSaving,     setStatusSaving]     = useState(false);
  const [deadlineSaving,   setDeadlineSaving]   = useState(false);
  const [notesDraft,       setNotesDraft]       = useState("");
  const [notesSaving,      setNotesSaving]      = useState(false);

  // Finished product files
  const [finals,       setFinals]       = useState([]);
  const [finalUrls,    setFinalUrls]    = useState({});
  const [finalsLoaded, setFinalsLoaded] = useState(false);
  const [uploading,    setUploading]    = useState(false);
  const [uploadMsg,    setUploadMsg]    = useState("");
  const fileInputRef = useRef(null);

  async function loadFinals(id) {
    try {
      const files = await listJobFinals(id);
      const entries = await Promise.all(
        files.map(async (f) => {
          try { return [f.name, await getJobFinalUrl(id, f.name)]; }
          catch { return [f.name, null]; }
        })
      );
      setFinals(files);
      setFinalUrls(Object.fromEntries(entries));
      setFinalsLoaded(true);
    } catch { /* silently ignore */ }
  }

  async function handleUpload(file) {
    setUploading(true);
    setUploadMsg("");
    try {
      await uploadJobFinal(job.id, file);
      await loadFinals(job.id);
      setUploadMsg(`✓ "${file.name}" uploaded`);
      setTimeout(() => setUploadMsg(""), 3000);
    } catch (err) {
      setUploadMsg("Error: " + (err.message ?? "Upload failed"));
    } finally {
      setUploading(false);
    }
  }

  async function handleDeleteFinal(fileName) {
    if (!window.confirm(`Remove "${fileName}"? The client will no longer see it.`)) return;
    try {
      await deleteJobFinal(job.id, fileName);
      setFinals((prev) => prev.filter((f) => f.name !== fileName));
      setFinalUrls((prev) => {
        const next = { ...prev };
        delete next[fileName];
        return next;
      });
    } catch (err) {
      alert("Could not delete: " + (err.message ?? "Unknown error"));
    }
  }

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getJob(jobId);
      setJob(data);
      setNotesDraft(data.notes ?? "");
      // Fetch invoice line items in parallel so SpecSheet can show print specs
      if (data?.quote_ref) {
        getInvoiceByRef(data.quote_ref)
          .then((inv) => setInvoiceLineItems(inv?.line_items ?? []))
          .catch(() => {}); // non-fatal — spec sheet still renders without it
      }
      // Load finished product files
      loadFinals(data.id);
    } catch (err) {
      setError(err.message ?? "Could not load job.");
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleStatusChange(e) {
    const status = e.target.value;
    setStatusSaving(true);
    setError("");
    try {
      const updated = await updateJobStatus(job.id, status);
      setJob(updated);
    } catch (err) {
      setError(err.message ?? "Could not update status.");
    } finally {
      setStatusSaving(false);
    }
  }

  async function handleNotesSave(notes) {
    setNotesSaving(true);
    try {
      const updated = await updateJobNotes(job.id, notes);
      setJob((j) => ({ ...j, notes: updated.notes }));
    } catch { /* silently ignore — not critical path */ }
    finally { setNotesSaving(false); }
  }

  async function handleDeadlineChange(e) {
    const deadline = e.target.value || null;
    setDeadlineSaving(true);
    setError("");
    try {
      const updated = await updateJobDeadline(job.id, deadline);
      setJob(updated);
    } catch (err) {
      setError(err.message ?? "Could not update deadline.");
    } finally {
      setDeadlineSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="h-8 w-8 rounded-full border-2 border-[var(--t-border)] border-t-brand-red animate-spin"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-[var(--t-muted)] hover:text-[var(--t-text1)] transition-colors"
        >
          ← Back to jobs
        </button>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || "Job not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-[var(--t-muted)] hover:text-[var(--t-text1)] transition-colors"
      >
        ← Back to jobs
      </button>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Header / controls ── */}
      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--t-text1)] truncate">
            {job.job_title || "Untitled job"}
          </h2>
          <p className="mt-1 text-sm text-[var(--t-text2)]">
            {job.client_name || "No client"} · Ref:{" "}
            <span className="font-mono">{job.quote_ref}</span>
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-[var(--t-muted)] mb-1.5">
              Update status
            </label>
            <select
              value={job.status}
              onChange={handleStatusChange}
              disabled={statusSaving}
              className="w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 text-sm text-[var(--t-text1)] focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red disabled:opacity-60"
            >
              {!PRODUCTION_STATUS_OPTIONS.some((o) => o.value === job.status) && (
                <option value={job.status}>{jobStatusLabel(job.status)}</option>
              )}
              {PRODUCTION_STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[var(--t-muted)] mb-1.5">
              Finishing time
            </label>
            <input
              type="date"
              value={job.deadline ?? ""}
              onChange={handleDeadlineChange}
              disabled={deadlineSaving}
              className="w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 text-sm text-[var(--t-text1)] focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      <SpecSheet job={job} invoiceLineItems={invoiceLineItems} />

      {/* ── Internal notes ── */}
      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red mb-3">
          Internal Notes
        </h3>
        <textarea
          rows={3}
          placeholder="Staff-only notes (not visible to customers)…"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
          onBlur={(e) => {
            if (e.target.value !== (job.notes ?? "")) handleNotesSave(e.target.value);
          }}
          disabled={notesSaving}
          className="w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3.5 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red disabled:opacity-60 resize-none"
        />
      </div>

      {/* ── Design files (uploaded by Designer, view-only here) ── */}
      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red">
          Design files
        </h3>
        <div className="mt-4">
          <JobFilesList
            jobId={job.id}
            fileType="design"
            emptyMessage="No design files uploaded yet."
          />
        </div>
      </div>

      {/* ── Finished Product ── */}
      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red">
          Finished Product
        </h3>
        <p className="mt-1 text-xs text-[var(--t-muted)]">
          Upload images or videos of the finished job — the client will see them in their portal under "Finished Product".
        </p>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_FINALS}
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (file) await handleUpload(file);
            e.target.value = "";
          }}
        />

        <button
          type="button"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-dark text-brand-cream text-xs font-semibold px-4 py-2 hover:bg-brand-dark/80 disabled:opacity-60 transition-colors"
        >
          {uploading ? (
            <>
              <span className="h-3.5 w-3.5 rounded-full border-2 border-brand-cream/30 border-t-brand-cream animate-spin inline-block" />
              Uploading…
            </>
          ) : (
            <>📤 Upload Image / Video</>
          )}
        </button>

        {uploadMsg && (
          <p className={[
            "text-xs mt-2 font-medium",
            uploadMsg.startsWith("Error") ? "text-red-600" : "text-green-700",
          ].join(" ")}>
            {uploadMsg}
          </p>
        )}

        {/* Files list */}
        {finalsLoaded && finals.length === 0 && (
          <p className="mt-3 text-xs text-gray-400 italic">No files uploaded yet.</p>
        )}
        {finals.length > 0 && (
          <div className="mt-4 space-y-2">
            {finals.map((f) => {
              const url = finalUrls[f.name];
              return (
                <div key={f.name} className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-2.5">
                  <div className="w-12 h-12 rounded-md overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                    {isImage(f.name) && url ? (
                      <img src={url} alt={f.name} className="w-full h-full object-cover" />
                    ) : isVideo(f.name) ? (
                      <span className="text-2xl">🎬</span>
                    ) : (
                      <span className="text-2xl">📎</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-800 truncate">{f.name}</p>
                    {f.metadata?.size && (
                      <p className="text-[10px] text-gray-400">{fmtBytes(f.metadata.size)}</p>
                    )}
                  </div>
                  {url && (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs font-semibold text-brand-dark hover:underline"
                    >
                      View
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => handleDeleteFinal(f.name)}
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
      </div>
    </div>
  );
}
