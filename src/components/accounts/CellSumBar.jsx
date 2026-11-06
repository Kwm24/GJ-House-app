/**
 * CellSumBar.jsx
 * Excel-style status bar for selected cells: Sum · Average · Count, with
 * copy and clear. Floats at the bottom of the screen while cells are selected.
 */
import { useState } from "react";
import { Copy, Check, X } from "lucide-react";
import { formatGHS as GHS } from "../../lib/currency.js";

export function CellSumBar({ stats, onCopy, onClear }) {
  const [copied, setCopied] = useState("");

  if (!stats.count) return null;

  function copy(what) {
    if (what === "sum") navigator.clipboard?.writeText(stats.sum.toFixed(2)).catch(() => {});
    else onCopy();
    setCopied(what);
    setTimeout(() => setCopied(""), 1500);
  }

  const items = [
    { label: "Sum",     value: GHS(stats.sum), strong: true },
    { label: "Average", value: GHS(stats.average) },
    { label: "Count",   value: stats.count.toLocaleString() },
  ];
  if (stats.count > 1) {
    items.push({ label: "Min", value: GHS(stats.min), extra: true });
    items.push({ label: "Max", value: GHS(stats.max), extra: true });
  }

  return (
    <div data-cell-summary
      className="fixed inset-x-0 bottom-4 z-[60] flex justify-center px-4 pointer-events-none">
      <div role="status" aria-live="polite"
        className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2.5 shadow-lg">
        {items.map((it) => (
          <div key={it.label} className={`flex items-baseline gap-1.5 ${it.extra ? "hidden sm:flex" : ""}`}>
            <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--t-muted)]">{it.label}</span>
            <span className={`tabular-nums text-sm ${it.strong ? "font-semibold text-[var(--t-text1)]" : "text-[var(--t-text2)]"}`}>
              {it.value}
            </span>
          </div>
        ))}

        <div className="flex items-center gap-1 border-l border-[var(--t-border)] pl-3">
          <button type="button" onClick={() => copy("sum")}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[#6366F1] transition-colors hover:bg-[#6366F1]/[0.08]"
            title="Copy the sum">
            {copied === "sum" ? <Check size={13} /> : <Copy size={13} />} {copied === "sum" ? "Copied" : "Copy sum"}
          </button>
          <button type="button" onClick={() => copy("cells")}
            className="hidden sm:inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-[var(--t-text2)] transition-colors hover:bg-gray-100 dark:hover:bg-white/5"
            title="Copy the selected cells (paste into Excel or Sheets)">
            {copied === "cells" ? <Check size={13} /> : <Copy size={13} />} {copied === "cells" ? "Copied" : "Copy cells"}
          </button>
          <button type="button" onClick={onClear} aria-label="Clear selection"
            className="rounded-md p-1 text-[var(--t-muted)] transition-colors hover:bg-gray-100 hover:text-[var(--t-text1)] dark:hover:bg-white/5">
            <X size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
