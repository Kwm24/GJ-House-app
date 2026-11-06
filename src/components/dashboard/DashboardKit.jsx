/**
 * DashboardKit.jsx
 * Building blocks for the per-account lobby dashboards (CS, Production,
 * Designer). Styled to genesis-DESIGN.md: 12px-radius bordered cards, flat
 * until hover, General Sans display numbers, muted overline labels, indigo
 * reserved for data marks and interactive states.
 */
import { AlertTriangle } from "lucide-react";
import { PeriodPicker } from "../PeriodPicker.jsx";

// Page wrapper: title, the person it's for, and the period picker.
export function DashboardShell({ title, subtitle, period, onPeriodChange, loading, error, children }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--t-muted)]">Your dashboard</p>
          <h2 className="font-display mt-1 text-2xl font-bold tracking-[-0.03em] text-[var(--t-text1)]">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-[var(--t-text2)]">{subtitle}</p>}
        </div>
      </div>
      {onPeriodChange && <PeriodPicker period={period} onChange={onPeriodChange} />}

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--t-border)] border-t-[#6366F1]" aria-label="Loading" />
        </div>
      ) : children}
    </div>
  );
}

export function StatGrid({ children }) {
  return <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{children}</div>;
}

// One headline number. `alert` adds a warning chip (icon + label, never colour alone).
export function StatTile({ label, value, sub, alert }) {
  return (
    <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] sm:p-5">
      <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--t-muted)]">{label}</p>
      <p className="font-display mt-2 text-2xl font-bold tabular-nums tracking-[-0.03em] text-[var(--t-text1)] sm:text-3xl">{value}</p>
      {sub && <p className="mt-1 text-xs text-[var(--t-text2)]">{sub}</p>}
      {alert && (
        <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
          <AlertTriangle size={12} aria-hidden="true" /> {alert}
        </p>
      )}
    </div>
  );
}

export function Panel({ title, action, children }) {
  return (
    <section className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4 sm:p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-[var(--t-text1)]">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  );
}

// Horizontal bars for a count per category (e.g. jobs by status). Single series,
// one hue (validated: #6366F1 light / #7C83F5 dark), values written beside each
// bar so the numbers never depend on colour. Native title = hover tooltip.
export function CountBars({ rows, emptyText = "Nothing here yet." }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  const total = rows.reduce((s, r) => s + r.value, 0);
  if (!total) return <p className="py-6 text-center text-sm text-[var(--t-text2)]">{emptyText}</p>;
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = Math.round((r.value / total) * 100);
        return (
          <li key={r.label} className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)_3rem] items-center gap-3"
            title={`${r.label}: ${r.value} (${pct}%)`}>
            <span className="truncate text-xs text-[var(--t-text2)]">{r.label}</span>
            <span className="h-2 rounded-full bg-gray-100 dark:bg-white/5" aria-hidden="true">
              {r.value > 0 && (
                <span className="block h-2 rounded-full bg-[#6366F1] dark:bg-[#7C83F5]"
                  style={{ width: `${Math.max(3, (r.value / max) * 100)}%` }} />
              )}
            </span>
            <span className="text-right text-sm font-medium tabular-nums text-[var(--t-text1)]">{r.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

// Divided list rows (Genesis "Lists").
export function RowList({ items, empty, render }) {
  if (!items.length) return <p className="py-6 text-center text-sm text-[var(--t-text2)]">{empty}</p>;
  return (
    <ul className="-mx-4 divide-y divide-[var(--t-border)] sm:-mx-5">
      {items.map((it, i) => (
        <li key={it.id ?? i} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
          {render(it)}
        </li>
      ))}
    </ul>
  );
}
