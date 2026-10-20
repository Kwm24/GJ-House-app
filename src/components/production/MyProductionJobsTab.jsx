/**
 * MyProductionJobsTab — producer-only view
 * Shows only the jobs that have been assigned to the currently signed-in
 * producer by admin. Each card links through to the full JobDetail view.
 */
import { useState, useEffect, useCallback } from "react";
import { listMyProductionJobs } from "../../lib/jobs.js";
import { subscribeToTable } from "../../lib/realtime.js";
import { JobCard } from "./JobCard.jsx";
import { JobDetail } from "./JobDetail.jsx";
import { Search, Inbox } from "lucide-react";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";

export function MyProductionJobsTab({ focusJobId }) {
  const [jobs,      setJobs]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [search,    setSearch]    = useState("");
  const [period,    setPeriod]    = useState(defaultPeriod());

  // Auto-open when navigated from a notification
  useEffect(() => {
    if (focusJobId) setSelectedJobId(focusJobId);
  }, [focusJobId]);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listMyProductionJobs();
      setJobs(data);
    } catch (err) {
      setError(err.message ?? "Could not load your jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Reload when any job row changes (e.g. admin assigns this producer to a new job)
  useEffect(() => subscribeToTable("jobs", () => loadJobs()), [loadJobs]);

  function handleBack() {
    setSelectedJobId(null);
    loadJobs();
  }

  if (selectedJobId) {
    return <JobDetail jobId={selectedJobId} onBack={handleBack} />;
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

      <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-base font-semibold text-[var(--t-text1)]">My Jobs</h2>
            <p className="mt-0.5 text-xs text-[var(--t-muted)]">
              Jobs assigned to you by admin. Open a job to view the spec sheet and update its status.
            </p>
          </div>
          {jobs.length > 0 && (
            <span className="rounded-full bg-amber-50 dark:bg-amber-900/20 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Period filter */}
        <div className="mb-3">
          <PeriodPicker period={period} onChange={setPeriod} accentColor="#F59E0B" />
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
          <input
            type="text"
            placeholder="Search jobs by title, client or ref…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-bg)] pl-9 pr-4 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors"
          />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3].map((i) => <div key={i} className="h-28 rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse" />)}
          </div>
        ) : (() => {
          const periodJobs = filterByPeriod(jobs, period);
          const q = search.toLowerCase().trim();
          const filtered = q
            ? periodJobs.filter((j) =>
                (j.job_title ?? "").toLowerCase().includes(q) ||
                (j.client_name ?? "").toLowerCase().includes(q) ||
                (j.quote_ref ?? "").toLowerCase().includes(q))
            : periodJobs;
          return filtered.length === 0 ? (
            <div className="flex flex-col items-center py-12 gap-2 text-center">
              <Inbox size={32} className="text-[var(--t-muted)]" />
              <p className="text-sm text-[var(--t-text2)]">
                {search ? "No jobs match your search." : "No jobs assigned to you yet."}
              </p>
              {!search && <p className="text-xs text-[var(--t-muted)]">Jobs will appear here once admin assigns them to your account.</p>}
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                onClick={() => setSelectedJobId(job.id)}
              />
            ))}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
