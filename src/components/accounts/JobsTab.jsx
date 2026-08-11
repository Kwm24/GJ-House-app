import { useState, useEffect, useCallback } from "react";
import { listAccountsJobs, jobGrandTotal, jobTotalPaid, jobOutstanding } from "../../lib/jobs.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { exportToCsv } from "../../lib/csvExport.js";

export function JobsTab() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setJobs(await listAccountsJobs());
    } catch (err) {
      setError(err.message ?? "Could not load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  function handleExport() {
    exportToCsv(
      `accounts-jobs-${new Date().toISOString().slice(0, 10)}.csv`,
      jobs.map((job) => ({
        "Job title": job.job_title || "",
        "Quote ref": job.quote_ref,
        Client: job.client_name || "",
        Status: jobStatusLabel(job.status),
        "Grand total (GHS)": jobGrandTotal(job).toFixed(2),
        "Deposit due 60% (GHS)": Number(job.deposit_amount || 0).toFixed(2),
        "Total paid (GHS)": jobTotalPaid(job).toFixed(2),
        "Outstanding (GHS)": jobOutstanding(job).toFixed(2),
      }))
    );
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

      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">
              Jobs
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Every paid job, with grand total, deposit, and balance due.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={jobs.length === 0}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            ⬇ Export CSV
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin"
              aria-label="Loading"
            />
          </div>
        ) : !error && jobs.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500 py-8">
            No paid jobs yet.
          </p>
        ) : jobs.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300">
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Grand total</th>
                  <th className="py-2 pr-4 text-right">Deposit due (60%)</th>
                  <th className="py-2 pr-4 text-right">Total paid</th>
                  <th className="py-2 pr-4 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => {
                  const totalPaid = jobTotalPaid(job);
                  const outstanding = jobOutstanding(job);
                  return (
                  <tr key={job.id} className="border-b border-gray-200">
                    <td className="py-2.5 pr-4 text-brand-dark">
                      <div className="font-medium">{job.job_title || "Untitled job"}</div>
                      <div className="text-xs text-gray-500 font-mono">{job.quote_ref}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">{job.client_name || "—"}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {jobStatusLabel(job.status)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-medium text-brand-dark whitespace-nowrap">
                      {GHS(jobGrandTotal(job))}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-gray-600 whitespace-nowrap">
                      {GHS(job.deposit_amount)}
                    </td>
                    <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                      <span className={totalPaid > 0 ? "font-medium text-green-700" : "text-gray-400"}>
                        {GHS(totalPaid)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-right font-medium whitespace-nowrap">
                      <span className={outstanding <= 0 ? "text-green-700" : "text-brand-red"}>
                        {outstanding <= 0 ? "✓ Settled" : GHS(outstanding)}
                      </span>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
