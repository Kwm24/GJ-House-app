import { useState, useEffect, useCallback } from "react";
import { listAllExpenditures } from "../../lib/expenditures.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { exportToCsv } from "../../lib/csvExport.js";

function jobLabel(exp) {
  if (!exp.jobs) return "Not linked to a job";
  return `${exp.jobs.job_title || "Untitled job"} (${exp.jobs.quote_ref})`;
}

function groupByJob(expenditures) {
  const groups = new Map();
  for (const exp of expenditures) {
    const key = exp.job_id ?? "unassigned";
    if (!groups.has(key)) {
      groups.set(key, { label: jobLabel(exp), items: [], total: 0 });
    }
    const group = groups.get(key);
    group.items.push(exp);
    group.total += Number(exp.amount || 0);
  }
  return [...groups.values()];
}

export function ExpenditureTab() {
  const [expenditures, setExpenditures] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadExpenditures = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setExpenditures(await listAllExpenditures());
    } catch (err) {
      setError(err.message ?? "Could not load expenditures.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadExpenditures();
  }, [loadExpenditures]);

  const groups = groupByJob(expenditures);
  const overallTotal = expenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0);

  function handleExport() {
    exportToCsv(
      `accounts-expenditure-${new Date().toISOString().slice(0, 10)}.csv`,
      expenditures.map((e) => ({
        Date: e.date,
        Job: jobLabel(e),
        "Recorded by": e.recorded_by || "",
        Description: e.description,
        Vendor: e.vendor || "",
        "Amount (GHS)": Number(e.amount || 0).toFixed(2),
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
              Expenditure
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Every expense recorded across CS, Production, and Designer, grouped by job.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={expenditures.length === 0}
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
        ) : !error && expenditures.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500 py-8">
            No expenditures recorded yet.
          </p>
        ) : (
          <div className="mt-4 space-y-6">
            {groups.map((group, i) => (
              <div key={i} className="overflow-x-auto">
                <h3 className="text-sm font-semibold text-brand-dark">{group.label}</h3>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Description</th>
                      <th className="py-2 pr-4">Vendor</th>
                      <th className="py-2 pr-4">Recorded by</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((exp) => (
                      <tr key={exp.id} className="border-b border-gray-200">
                        <td className="py-2 pr-4 whitespace-nowrap text-gray-600">{exp.date}</td>
                        <td className="py-2 pr-4 text-brand-dark">{exp.description}</td>
                        <td className="py-2 pr-4 text-gray-600">{exp.vendor || "—"}</td>
                        <td className="py-2 pr-4 text-gray-600 capitalize">
                          {exp.recorded_by || "—"}
                        </td>
                        <td className="py-2 pr-4 text-right text-gray-700 whitespace-nowrap">
                          {GHS(exp.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="py-2 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Job total
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold text-brand-dark whitespace-nowrap">
                        {GHS(group.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}

            <div className="rounded-lg bg-brand-dark text-brand-cream px-5 py-4 flex items-center justify-between">
              <span className="text-sm font-semibold uppercase tracking-wide">
                Overall total
              </span>
              <span className="text-xl font-bold">{GHS(overallTotal)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
