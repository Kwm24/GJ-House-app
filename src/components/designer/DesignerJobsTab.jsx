/**
 * DesignerJobsTab — admin-only view
 * Shows every design-related job and lets admin assign each one to a specific
 * designer. Assigned jobs appear in that designer's "My Jobs" tab.
 */
import { useState, useEffect, useCallback } from "react";
import { listDesignerJobs, assignDesigner, deleteJob } from "../../lib/jobs.js";
import { useAuth } from "../AuthProvider.jsx";
import { listDesigners } from "../../lib/auth.js";
import { listInvoicesByRefs } from "../../lib/invoices.js";
import { listDesignItemIds } from "../../lib/items.js";
import { calcDesignCost } from "../../lib/designCost.js";
import { JobCard } from "./JobCard.jsx";
import { JobDetail } from "./JobDetail.jsx";
import { Search, Inbox } from "lucide-react";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";

export function DesignerJobsTab() {
  const { profile } = useAuth();
  const [jobs,        setJobs]        = useState([]);
  const [designers,   setDesigners]   = useState([]);
  const [designCosts, setDesignCosts] = useState({});
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);
  const [search,      setSearch]      = useState("");
  const [period,      setPeriod]      = useState(defaultPeriod());

  // Per-job saving state for the assignment dropdown
  const [assigning, setAssigning] = useState({}); // { jobId: true }
  const [assignMsg, setAssignMsg] = useState({}); // { jobId: "✓ Assigned" }
  const [deleting,  setDeleting]  = useState({}); // { jobId: true }

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [data, designerList] = await Promise.all([
        listDesignerJobs(),
        listDesigners(),
      ]);
      setJobs(data);
      setDesigners(designerList);

      // Resolve design costs in parallel
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
      setError(err.message ?? "Could not load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  async function handleAssign(jobId, designerUserId) {
    setAssigning((a) => ({ ...a, [jobId]: true }));
    try {
      const updated = await assignDesigner(jobId, designerUserId || null);
      setJobs((prev) =>
        prev.map((j) => j.id === jobId ? { ...j, assigned_designer_id: updated.assigned_designer_id } : j)
      );
      const name = designers.find((d) => d.user_id === designerUserId)?.full_name;
      const msg  = designerUserId ? `✓ Assigned to ${name}` : "✓ Unassigned";
      setAssignMsg((m) => ({ ...m, [jobId]: msg }));
      setTimeout(() => setAssignMsg((m) => ({ ...m, [jobId]: "" })), 2500);
    } catch (err) {
      setAssignMsg((m) => ({ ...m, [jobId]: "Error: " + (err.message ?? "Could not save") }));
    } finally {
      setAssigning((a) => ({ ...a, [jobId]: false }));
    }
  }

  async function handleDelete(job) {
    if (!window.confirm(`Permanently delete "${job.job_title || job.quote_ref}"? This cannot be undone.`)) return;
    setDeleting((d) => ({ ...d, [job.id]: true }));
    try {
      await deleteJob(job.id);
      setJobs((prev) => prev.filter((j) => j.id !== job.id));
    } catch (err) {
      alert("Could not delete: " + (err.message ?? "Unknown error"));
    } finally {
      setDeleting((d) => ({ ...d, [job.id]: false }));
    }
  }

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
            <h2 className="text-base font-semibold text-[var(--t-text1)]">All Design Jobs</h2>
            <p className="mt-0.5 text-xs text-[var(--t-muted)]">
              Assign each job to a designer — it will appear in their My Jobs tab.
            </p>
          </div>
          <span className="rounded-full bg-purple-50 dark:bg-purple-900/20 px-2.5 py-0.5 text-xs font-semibold text-purple-700 dark:text-purple-300">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""}
          </span>
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
              <p className="text-sm text-[var(--t-text2)]">{search ? "No jobs match your search" : "No design jobs at the moment."}</p>
            </div>
          ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((job) => (
              <JobCard
                key={job.id}
                job={job}
                designCost={designCosts[job.id] ?? null}
                onClick={() => setSelectedJobId(job.id)}
                assignmentSlot={
                  <div>
                    <label className="block text-[10px] font-semibold uppercase tracking-wide text-[var(--t-muted)] mb-1.5">
                      Assigned designer
                    </label>
                    <select
                      value={job.assigned_designer_id ?? ""}
                      disabled={!!assigning[job.id]}
                      onChange={(e) => handleAssign(job.id, e.target.value)}
                      className="w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-2.5 py-1.5 text-xs text-[var(--t-text1)] focus:outline-none focus:ring-1 focus:ring-[#6366F1]/30 disabled:opacity-60"
                    >
                      <option value="">— Unassigned —</option>
                      {designers.map((d) => (
                        <option key={d.user_id} value={d.user_id}>
                          {d.full_name}
                        </option>
                      ))}
                    </select>
                    {assignMsg[job.id] && (
                      <p className={[
                        "mt-1 text-xs font-medium",
                        assignMsg[job.id].startsWith("Error") ? "text-red-600" : "text-green-700",
                      ].join(" ")}>
                        {assignMsg[job.id]}
                      </p>
                    )}
                    {profile?.role === "admin" && (
                      <button
                        type="button"
                        disabled={!!deleting[job.id]}
                        onClick={() => handleDelete(job)}
                        className="mt-2 text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-60"
                      >
                        {deleting[job.id] ? "Deleting…" : "🗑 Delete job"}
                      </button>
                    )}
                  </div>
                }
              />
            ))}
          </div>
          );
        })()}
      </div>
    </div>
  );
}
