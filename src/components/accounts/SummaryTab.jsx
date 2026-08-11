import { useState, useEffect, useCallback } from "react";
import { listAccountsJobs, jobGrandTotal, jobTotalPaid } from "../../lib/jobs.js";
import { listAllExpenditures } from "../../lib/expenditures.js";
import { listPayments } from "../../lib/payments.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { exportToCsv } from "../../lib/csvExport.js";

export function SummaryTab() {
  const [jobs, setJobs] = useState([]);
  const [expenditures, setExpenditures] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [jobsData, expData, paymentsData] = await Promise.all([
        listAccountsJobs(),
        listAllExpenditures(),
        listPayments(),
      ]);
      setJobs(jobsData);
      setExpenditures(expData);
      setPayments(paymentsData);
    } catch (err) {
      setError(err.message ?? "Could not load summary.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const totalRevenue      = jobs.reduce((sum, j) => sum + jobGrandTotal(j), 0);
  const totalCashReceived = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalOutstanding  = jobs.reduce((sum, j) => sum + Math.max(0, jobGrandTotal(j) - jobTotalPaid(j)), 0);
  const totalExpenditure  = expenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netMargin         = totalRevenue - totalExpenditure;

  function handleExport() {
    exportToCsv(`accounts-summary-${new Date().toISOString().slice(0, 10)}.csv`, [
      {
        "Total revenue (GHS)": totalRevenue.toFixed(2),
        "Total expenditure (GHS)": totalExpenditure.toFixed(2),
        "Net margin (GHS)": netMargin.toFixed(2),
      },
    ]);
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
            <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Summary</h2>
            <p className="mt-1 text-sm text-gray-600">
              Revenue, expenditure, and margin across every paid job.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={loading}
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
        ) : (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="rounded-lg bg-white border border-gray-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Quoted revenue
              </p>
              <p className="mt-2 text-2xl font-bold text-brand-dark">{GHS(totalRevenue)}</p>
              <p className="mt-1 text-xs text-gray-400">Sum of approved quote totals</p>
            </div>

            <div className="rounded-lg bg-white border border-green-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Cash received
              </p>
              <p className="mt-2 text-2xl font-bold text-green-700">{GHS(totalCashReceived)}</p>
              <p className="mt-1 text-xs text-gray-400">Sum of all recorded payments</p>
            </div>

            <div className="rounded-lg bg-white border border-orange-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Outstanding
              </p>
              <p className="mt-2 text-2xl font-bold text-orange-600">{GHS(totalOutstanding)}</p>
              <p className="mt-1 text-xs text-gray-400">Unpaid balance across all jobs</p>
            </div>

            <div className="rounded-lg bg-white border border-gray-200 p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                Total expenditure
              </p>
              <p className="mt-2 text-2xl font-bold text-brand-dark">{GHS(totalExpenditure)}</p>
              <p className="mt-1 text-xs text-gray-400">Sum of all recorded expenses</p>
            </div>

            <div className="rounded-lg bg-brand-dark text-brand-cream p-5 sm:col-span-2 lg:col-span-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-cream/60">
                Net margin
              </p>
              <p className={`mt-2 text-2xl font-bold ${netMargin < 0 ? "text-red-400" : "text-brand-cream"}`}>
                {netMargin < 0 ? "-" : ""}{GHS(Math.abs(netMargin))}
              </p>
              <p className="mt-1 text-xs text-brand-cream/50">Quoted revenue minus expenditure</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
