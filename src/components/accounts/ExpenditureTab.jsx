import { useState, useEffect, useCallback } from "react";
import { Search } from "lucide-react";
import { listAllExpenditures } from "../../lib/expenditures.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { exportToCsv } from "../../lib/csvExport.js";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";

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
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState(defaultPeriod());

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

  function handleExport() {
    exportToCsv(
      `accounts-expenditure-${new Date().toISOString().slice(0, 10)}.csv`,
      visibleExpenditures.map((e) => ({
        Date: e.date,
        Job: jobLabel(e),
        "Recorded by": e.recorded_by || "",
        Description: e.description,
        Vendor: e.vendor || "",
        "Amount (GHS)": Number(e.amount || 0).toFixed(2),
      }))
    );
  }

  const periodExpenditures = filterByPeriod(expenditures, period, "date");
  const q = search.toLowerCase().trim();
  const visibleExpenditures = q
    ? periodExpenditures.filter((e) =>
        (e.description ?? "").toLowerCase().includes(q) ||
        (e.vendor ?? "").toLowerCase().includes(q) ||
        (e.recorded_by ?? "").toLowerCase().includes(q) ||
        (e.jobs?.job_title ?? "").toLowerCase().includes(q) ||
        (e.jobs?.quote_ref ?? "").toLowerCase().includes(q)
      )
    : periodExpenditures;

  const groups = groupByJob(visibleExpenditures);
  const overallTotal = visibleExpenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0);

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

      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--t-text1)]">Expenditure</h2>
            <p className="mt-1 text-sm text-[var(--t-muted)]">
              Every expense recorded across CS, Production, and Designer, grouped by job.
            </p>
          </div>
          <button
            type="button"
            onClick={handleExport}
            disabled={expenditures.length === 0}
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
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
          <input
            type="text"
            placeholder="Search by description, vendor, job or recorded by…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-bg)] pl-9 pr-4 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin"
              aria-label="Loading"
            />
          </div>
        ) : !error && visibleExpenditures.length === 0 ? (
          <p className="mt-8 text-center text-sm text-[var(--t-muted)] py-8">
            {search ? "No expenditures match your search." : "No expenditures recorded yet."}
          </p>
        ) : (
          <div className="mt-2 space-y-6">
            {groups.map((group, i) => (
              <div key={i} className="overflow-x-auto">
                <h3 className="text-sm font-semibold text-[var(--t-text1)]">{group.label}</h3>
                <table className="mt-2 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-[var(--t-muted)] border-b border-[var(--t-border)]">
                      <th className="py-2 pr-4">Date</th>
                      <th className="py-2 pr-4">Description</th>
                      <th className="py-2 pr-4">Vendor</th>
                      <th className="py-2 pr-4">Recorded by</th>
                      <th className="py-2 pr-4 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((exp) => (
                      <tr key={exp.id} className="border-b border-[var(--t-border)]">
                        <td className="py-2 pr-4 whitespace-nowrap text-[var(--t-muted)]">{exp.date}</td>
                        <td className="py-2 pr-4 text-[var(--t-text1)]">{exp.description}</td>
                        <td className="py-2 pr-4 text-[var(--t-text2)]">{exp.vendor || "—"}</td>
                        <td className="py-2 pr-4 text-[var(--t-text2)] capitalize">
                          {exp.recorded_by || "—"}
                        </td>
                        <td className="py-2 pr-4 text-right text-[var(--t-text2)] whitespace-nowrap">
                          {GHS(exp.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="py-2 pr-4 text-right text-xs font-semibold uppercase tracking-wide text-[var(--t-muted)]">
                        Job total
                      </td>
                      <td className="py-2 pr-4 text-right font-semibold text-[var(--t-text1)] whitespace-nowrap">
                        {GHS(group.total)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ))}

            <div className="rounded-lg px-5 py-4 flex items-center justify-between" style={{ background: "var(--t-text1)", color: "var(--t-bg)" }}>
              <span className="text-sm font-semibold uppercase tracking-wide">
                {search ? "Filtered total" : "Overall total"}
              </span>
              <span className="text-xl font-bold">{GHS(overallTotal)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
