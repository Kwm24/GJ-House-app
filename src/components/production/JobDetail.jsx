import { useState, useEffect, useCallback } from "react";
import { getJob, updateJobStatus, updateJobDeadline } from "../../lib/jobs.js";
import { PRODUCTION_STATUS_OPTIONS, jobStatusLabel } from "../../lib/jobStatus.js";
import { SpecSheet } from "../SpecSheet.jsx";
import { JobFilesList } from "../JobFilesList.jsx";

export function JobDetail({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [deadlineSaving, setDeadlineSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getJob(jobId);
      setJob(data);
    } catch (err) {
      setError(err.message ?? "Could not load job.");
    } finally {
      setLoading(false);
    }
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
          className="h-8 w-8 rounded-full border-2 border-brand-cream/30 border-t-brand-red animate-spin"
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
          className="text-sm font-medium text-brand-cream/70 hover:text-brand-cream transition-colors"
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
        className="text-sm font-medium text-brand-cream/70 hover:text-brand-cream transition-colors"
      >
        ← Back to jobs
      </button>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Header / controls ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold text-brand-dark truncate">
            {job.job_title || "Untitled job"}
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            {job.client_name || "No client"} · Ref:{" "}
            <span className="font-mono">{job.quote_ref}</span>
          </p>
        </div>

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Update status
            </label>
            <select
              value={job.status}
              onChange={handleStatusChange}
              disabled={statusSaving}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red disabled:opacity-60"
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
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Finishing time
            </label>
            <input
              type="date"
              value={job.deadline ?? ""}
              onChange={handleDeadlineChange}
              disabled={deadlineSaving}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      <SpecSheet job={job} />

      {/* ── Design files (uploaded by Designer, view-only here) ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
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
    </div>
  );
}
