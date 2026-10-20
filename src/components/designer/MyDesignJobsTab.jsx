/**
 * MyDesignJobsTab — designer-only view
 * Shows only the jobs that have been assigned to the currently signed-in
 * designer by admin. Each card links through to the full JobDetail view
 * (spec sheet, resources, design upload).
 */
import { useState, useEffect, useCallback } from "react";
import { listMyDesignJobs } from "../../lib/jobs.js";
import { subscribeToTable } from "../../lib/realtime.js";
import { listInvoicesByRefs } from "../../lib/invoices.js";
import { listDesignItemIds } from "../../lib/items.js";
import { calcDesignCost } from "../../lib/designCost.js";
import { JobCard } from "./JobCard.jsx";
import { JobDetail } from "./JobDetail.jsx";
import { Search, Inbox } from "lucide-react";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";

export function MyDesignJobsTab({ focusJobId }) {
  const [jobs,        setJobs]        = useState([]);
  const [designCosts, setDesignCosts] = useState({});
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [search,      setSearch]      = useState("");
  const [period,      setPeriod]      = useState(defaultPeriod());

  // Auto-open when navigated from a notification
  useEffect(() => {
    if (focusJobId) setSelectedJobId(focusJobId);
  }, [focusJobId]);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listMyDesignJobs();
      setJobs(data);

      // Resolve design costs for each job's matching invoice
      const refs = [...new Set(data.map((j) => j.quote_ref).filter(Boolean))];
      const [invoices, designIds] = await Promise.all([
        listInvoicesByRefs(refs),
        listDesignItemIds(),
      ]);
      const byRef  = Object.fromEntries(invoices.map((inv) => [inv.ref, inv]));
      const idSet  = new Set(designIds);
      const costMap = {};
      for (const job of data) {
        const cost = calcDesignCost(byRef[job.quote_ref], idSet);
        if (cost !== null) costMap[job.id] = cost;
      }
      setDesignCosts(costMap);
    } catch (err) {
      setError(err.message ?? "Could not load your jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  // Reload when any job row changes (e.g. admin assigns this designer to a new job)
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
              Jobs assigned to you by admin. Open a job to view the spec sheet, upload artwork and manage resources.
            </p>
          </div>
          {jobs.length > 0 && (
            <span className="rounded-full bg-purple-50 dark:bg-purple-900/20 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Period filter */}
        <div className="mb-3">
          <PeriodPicker period={period} onChange={setPeriod} accentColor="#A855F7" />
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
                designCost={designCosts[job.id] ?? null}
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
