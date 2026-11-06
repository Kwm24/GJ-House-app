import { useState, useEffect, useCallback, useMemo } from "react";
import { listAccountsJobs } from "../../lib/jobs.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";
import { useCellSelection } from "../../lib/useCellSelection.js";
import { CellSumBar } from "./CellSumBar.jsx";

// The money columns that take part in Autosum, in table order
const SUM_COLS = [
  { key: "cost",   label: "Outsource cost" },
  { key: "profit", label: "Profit" },
  { key: "sell",   label: "Client price" },
];

function moneyOf(job) {
  const r    = job.quote?.result || {};
  const cost = r.totalCost ?? 0;
  const sell = r.sellPrice ?? 0;
  return { cost, sell, profit: sell - cost };
}

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

  const filtered = useMemo(() => filterByPeriod(jobs, period), [jobs, period]);
  const money    = useMemo(() => filtered.map(moneyOf), [filtered]);

  // Excel-style Autosum over the three money columns
  const getValue = useCallback((r, c) => money[r]?.[SUM_COLS[c].key] ?? 0, [money]);
  const sel = useCellSelection({
    rowCount: filtered.length,
    colCount: SUM_COLS.length,
    getValue,
    resetKey: `${period?.year}-${period?.month}`,
  });

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
        <PeriodPicker period={period} onChange={setPeriod} bgVar="--t-bg" />
      </div>

      {filtered.length > 0 && (
        <p className="-mt-2 text-xs text-[var(--t-muted)]">
          Autosum: click or drag across the money cells to add them up. Shift+click selects a block,
          Ctrl/⌘+click adds single cells, and clicking a column heading selects the whole column. On a phone, tap cells to add them.
        </p>
      )}

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
            <table ref={sel.containerRef} role="grid" aria-label="Digital print jobs" aria-multiselectable="true" className="w-full text-sm">
              <thead>
                <tr className="bg-[var(--t-surface)] border-b border-[var(--t-border)]">
                  {["Ref", "Client", "Job", "Date", "Status"].map((h) => (
                    <th key={h} className="py-2.5 px-3 text-left text-xs font-semibold text-[var(--t-muted)] whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                  {SUM_COLS.map((col, c) => (
                    <th key={col.key} className="p-0 text-right">
                      <button type="button" onClick={(e) => sel.selectColumn(e, c)}
                        title={`Select the whole ${col.label} column`}
                        className="w-full py-2.5 px-3 text-right text-xs font-semibold text-[var(--t-muted)] whitespace-nowrap transition-colors hover:bg-[#6366F1]/[0.06] hover:text-[var(--t-text1)]">
                        {col.label}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((job, i) => {
                  const m = money[i];
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
                      {SUM_COLS.map((col, c) => {
                        const on = sel.isSelected(i, c);
                        return (
                          <td key={col.key} {...sel.cellProps(i, c)}
                            className={[
                              "py-2.5 px-3 text-right tabular-nums whitespace-nowrap cursor-cell select-none outline-none transition-colors",
                              "focus-visible:shadow-[inset_0_0_0_2px_rgba(99,102,241,0.5)]",
                              col.key === "profit" ? "font-semibold text-amber-600" : col.key === "sell" ? "font-semibold text-[var(--t-text1)]" : "text-[var(--t-text1)]",
                              on ? "bg-[#6366F1]/[0.12] shadow-[inset_0_0_0_2px_#6366F1]" : "hover:bg-[#6366F1]/[0.05]",
                            ].join(" ")}>
                            {GHS(m[col.key])}
                          </td>
                        );
                      })}
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

      <CellSumBar stats={sel.stats} onCopy={sel.copySelection} onClear={sel.clear} />
    </div>
  );
}
