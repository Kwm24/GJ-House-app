import { useState, useEffect } from "react";
import { listAccountsJobs } from "../../lib/jobs.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";

export function DigitalJobsTab() {
  const [jobs,    setJobs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [period,  setPeriod]  = useState(defaultPeriod());

  useEffect(() => {
    listAccountsJobs()
      .then((all) => setJobs(all.filter((j) => j.quote?.quoteType === "digital")))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = filterByPeriod(jobs, period);

  const totals = filtered.reduce(
    (acc, j) => {
      const cost   = j.quote?.result?.totalCost  ?? 0;
      const sell   = j.quote?.result?.sellPrice  ?? 0;
      const profit = sell - cost;
      return {
        cost:   acc.cost   + cost,
        sell:   acc.sell   + sell,
        profit: acc.profit + profit,
      };
    },
    { cost: 0, sell: 0, profit: 0 }
  );

  return (
    <div className="space-y-5">
      {/* Period picker */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h2 className="text-base font-semibold text-[var(--t-text1)]">Digital Print Jobs</h2>
        <PeriodPicker value={period} onChange={setPeriod} bgVar="--t-bg" />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Total outsource cost", value: GHS(totals.cost),   sub: "What you pay out" },
          { label: "Your profit",          value: GHS(totals.profit), sub: "Markup earned",   color: "text-amber-600" },
          { label: "Total billed",         value: GHS(totals.sell),   sub: "Charged to clients" },
        ].map(({ label, value, sub, color }) => (
          <div key={label} className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--t-muted)] mb-1">{label}</p>
            <p className={`text-2xl font-bold tabular-nums ${color || "text-[var(--t-text1)]"}`}>{value}</p>
            <p className="text-xs text-[var(--t-muted)] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Jobs table */}
      {loading ? (
        <p className="text-sm text-[var(--t-muted)]">Loading…</p>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-10 text-center">
          <p className="text-sm text-[var(--t-muted)]">No digital print jobs for this period.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--t-border)] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--t-surface)] border-b border-[var(--t-border)]">
                  {["Ref", "Client", "Job", "Date", "Status", "Outsource cost", "Profit", "Client price"].map((h) => (
                    <th key={h} className="py-2.5 px-3 text-left text-xs font-semibold text-[var(--t-muted)] whitespace-nowrap first:rounded-tl-xl last:rounded-tr-xl">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((job, i) => {
                  const r      = job.quote?.result || {};
                  const cost   = r.totalCost  ?? 0;
                  const sell   = r.sellPrice  ?? 0;
                  const profit = sell - cost;
                  return (
                    <tr key={job.id}
                      className={`border-b border-[var(--t-border)] transition-colors hover:bg-[var(--t-bg)] ${i % 2 === 0 ? "" : "bg-[var(--t-surface)]/40"}`}>
                      <td className="py-2.5 px-3 font-mono text-xs text-[var(--t-text2)] whitespace-nowrap">{job.quote_ref}</td>
                      <td className="py-2.5 px-3 text-[var(--t-text1)] whitespace-nowrap">{job.client_name || "—"}</td>
                      <td className="py-2.5 px-3 text-[var(--t-text1)] max-w-[180px] truncate">{job.job_title || "Digital Print"}</td>
                      <td className="py-2.5 px-3 text-[var(--t-muted)] whitespace-nowrap text-xs">{job.created_at?.slice(0, 10)}</td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <span className="inline-block text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--t-bg)] text-[var(--t-text2)] border border-[var(--t-border)]">
                          {jobStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-[var(--t-text1)] whitespace-nowrap">{GHS(cost)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-amber-600 whitespace-nowrap">{GHS(profit)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums font-semibold text-[var(--t-text1)] whitespace-nowrap">{GHS(sell)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-[var(--t-surface)] border-t-2 border-[var(--t-border)] font-semibold">
                  <td className="py-3 px-3 text-xs text-[var(--t-muted)]" colSpan={5}>
                    {filtered.length} job{filtered.length !== 1 ? "s" : ""}
                  </td>
                  <td className="py-3 px-3 text-right tabular-nums text-[var(--t-text1)]">{GHS(totals.cost)}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-amber-600">{GHS(totals.profit)}</td>
                  <td className="py-3 px-3 text-right tabular-nums text-[var(--t-text1)]">{GHS(totals.sell)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
