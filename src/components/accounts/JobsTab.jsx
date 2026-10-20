import { useState, useEffect, useCallback, useRef } from "react";
import { Search, X } from "lucide-react";
import { listAccountsJobs, jobGrandTotal, jobTotalPaid, jobOutstanding } from "../../lib/jobs.js";
import { listAllExpenditures } from "../../lib/expenditures.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { exportToCsv } from "../../lib/csvExport.js";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";

// ── Financial detail row ──────────────────────────────────────────────────────
function FinRow({ label, value, bold, color }) {
  const colorClass =
    color === "green" ? "text-green-600"
    : color === "red"   ? "text-red-600"
    : color === "amber" ? "text-amber-600"
    : "text-[var(--t-text1)]";
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[var(--t-muted)]">{label}</span>
      <span className={`text-sm ${bold ? "font-semibold" : "font-medium"} ${colorClass}`}>{value}</span>
    </div>
  );
}

// ── Job financials modal ──────────────────────────────────────────────────────
function JobFinancialsModal({ job, expenses, onClose }) {
  const overlayRef = useRef(null);
  const grandTotal  = jobGrandTotal(job);
  const totalPaid   = jobTotalPaid(job);
  const outstanding = jobOutstanding(job);
  const profit      = grandTotal - expenses;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div className="w-full max-w-md rounded-2xl bg-[var(--t-surface)] border border-[var(--t-border)] shadow-[0_24px_64px_rgba(0,0,0,0.18)] overflow-hidden">

        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 py-5 border-b border-[var(--t-border)]">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--t-muted)] mb-1">Job Financials</p>
            <h3 className="font-semibold text-[var(--t-text1)] text-base leading-tight truncate">
              {job.job_title || "Untitled job"}
            </h3>
            <p className="text-xs font-mono text-[var(--t-muted)] mt-0.5">{job.quote_ref}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-[var(--t-muted)] hover:bg-gray-100 dark:hover:bg-white/10 hover:text-[var(--t-text1)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Financials */}
        <div className="px-6 py-5 space-y-2.5">
          <FinRow label="Grand Total"       value={GHS(grandTotal)}  bold />
          <FinRow label="Deposit Due (60%)" value={GHS(job.deposit_amount)} />
          <FinRow
            label="Total Paid"
            value={GHS(totalPaid)}
            color={totalPaid > 0 ? "green" : undefined}
          />
          <FinRow
            label="Outstanding"
            value={outstanding <= 0 ? "✓ Settled" : GHS(outstanding)}
            color={outstanding <= 0 ? "green" : "red"}
            bold={outstanding > 0}
          />

          <div className="border-t border-[var(--t-border)] pt-3 mt-3 space-y-2.5">
            <FinRow
              label="Total Expenses"
              value={expenses > 0 ? GHS(expenses) : "—"}
              color={expenses > 0 ? "amber" : undefined}
            />
            <FinRow
              label="Profit Remaining"
              value={GHS(profit)}
              bold
              color={profit < 0 ? "red" : profit === 0 ? undefined : "green"}
            />
          </div>
        </div>

        {/* Job meta */}
        <div className="px-6 pb-5">
          <div className="rounded-xl bg-gray-50 dark:bg-white/5 border border-[var(--t-border)] px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-[var(--t-muted)]">Client</span>
              <span className="font-medium text-[var(--t-text1)]">{job.client_name || "—"}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-[var(--t-muted)]">Status</span>
              <span className="font-medium text-[var(--t-text2)]">{jobStatusLabel(job.status)}</span>
            </div>
            {job.deadline && (
              <div className="flex justify-between text-xs">
                <span className="text-[var(--t-muted)]">Deadline</span>
                <span className="font-medium text-[var(--t-text2)]">
                  {new Date(job.deadline).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Jobs table ────────────────────────────────────────────────────────────────
export function JobsTab() {
  const [jobs,         setJobs]         = useState([]);
  const [expensesByJob,setExpensesByJob]= useState({});
  const [loading,      setLoading]      = useState(true);
  const [error,        setError]        = useState("");
  const [search,       setSearch]       = useState("");
  const [period,       setPeriod]       = useState(defaultPeriod());
  const [selectedJob,  setSelectedJob]  = useState(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [jobList, expenditures] = await Promise.all([
        listAccountsJobs(),
        listAllExpenditures(),
      ]);
      setJobs(jobList);
      const map = {};
      for (const exp of expenditures) {
        if (exp.job_id) {
          map[exp.job_id] = (map[exp.job_id] ?? 0) + Number(exp.amount || 0);
        }
      }
      setExpensesByJob(map);
    } catch (err) {
      setError(err.message ?? "Could not load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadJobs(); }, [loadJobs]);

  function handleExport() {
    exportToCsv(
      `accounts-jobs-${new Date().toISOString().slice(0, 10)}.csv`,
      jobs.map((job) => {
        const grandTotal = jobGrandTotal(job);
        const expenses   = expensesByJob[job.id] ?? 0;
        return {
          "Job title":               job.job_title || "",
          "Quote ref":               job.quote_ref,
          "Client":                  job.client_name || "",
          "Status":                  jobStatusLabel(job.status),
          "Grand total (GHS)":       grandTotal.toFixed(2),
          "Deposit due 60% (GHS)":   Number(job.deposit_amount || 0).toFixed(2),
          "Total paid (GHS)":        jobTotalPaid(job).toFixed(2),
          "Outstanding (GHS)":       jobOutstanding(job).toFixed(2),
          "Expenses (GHS)":          expenses.toFixed(2),
          "Profit remaining (GHS)":  (grandTotal - expenses).toFixed(2),
        };
      })
    );
  }

  const periodJobs = filterByPeriod(jobs, period);
  const q = search.toLowerCase().trim();
  const visibleJobs = q
    ? periodJobs.filter((j) =>
        (j.job_title ?? "").toLowerCase().includes(q) ||
        (j.client_name ?? "").toLowerCase().includes(q) ||
        (j.quote_ref ?? "").toLowerCase().includes(q) ||
        jobStatusLabel(j.status).toLowerCase().includes(q)
      )
    : periodJobs;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--t-text1)]">Jobs</h2>
            <p className="mt-1 text-sm text-[var(--t-muted)]">
              Click any row to view full financial breakdown.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={jobs.length === 0}
            className="rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-4 py-2 text-sm font-medium text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ⬇ Export CSV
          </button>
        </div>

        {/* Period filter */}
        <div className="mb-4">
          <PeriodPicker period={period} onChange={setPeriod} accentColor="#C0392B" />
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
          <input
            type="text"
            placeholder="Search by title, client, ref or status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-bg)] pl-9 pr-4 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin" aria-label="Loading" />
          </div>
        ) : !error && visibleJobs.length === 0 ? (
          <p className="mt-8 text-center text-sm text-[var(--t-muted)] py-8">
            {search ? "No jobs match your search." : "No paid jobs yet."}
          </p>
        ) : visibleJobs.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--t-muted)] border-b border-[var(--t-border)]">
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Total paid</th>
                  <th className="py-2 pr-4 text-right">Grand total</th>
                </tr>
              </thead>
              <tbody>
                {visibleJobs.map((job) => {
                  const totalPaid  = jobTotalPaid(job);
                  const grandTotal = jobGrandTotal(job);
                  return (
                    <tr
                      key={job.id}
                      onClick={() => setSelectedJob(job)}
                      className="border-b border-[var(--t-border)] hover:bg-[var(--t-bg)] cursor-pointer transition-colors group"
                    >
                      <td className="py-3 pr-4 text-[var(--t-text1)]">
                        <div className="font-medium group-hover:text-brand-red transition-colors">
                          {job.job_title || "Untitled job"}
                        </div>
                        <div className="text-xs text-[var(--t-muted)] font-mono">{job.quote_ref}</div>
                      </td>
                      <td className="py-3 pr-4 text-[var(--t-text2)]">{job.client_name || "—"}</td>
                      <td className="py-3 pr-4">
                        <span className="rounded-full bg-gray-100 dark:bg-white/10 px-2.5 py-0.5 text-xs font-medium text-[var(--t-text2)]">
                          {jobStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right whitespace-nowrap">
                        <span className={totalPaid > 0 ? "font-medium text-green-600" : "text-[var(--t-muted)]"}>
                          {GHS(totalPaid)}
                        </span>
                      </td>
                      <td className="py-3 pr-4 text-right font-semibold text-[var(--t-text1)] whitespace-nowrap">
                        {GHS(grandTotal)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selectedJob && (
        <JobFinancialsModal
          job={selectedJob}
          expenses={expensesByJob[selectedJob.id] ?? 0}
          onClose={() => setSelectedJob(null)}
        />
      )}
    </div>
  );
}
