/**
 * CostBreakdownTab.jsx
 * Accounts → Cost Breakdown. A list of every paid job; tapping one opens its
 * breakdown exactly as the quoter showed it after "Generate quote" — the
 * Offset cost table, or the Digital sheet comparison / quote / layout — with
 * the invoice and payments underneath. Amounts in the list and in the
 * breakdowns take part in the Excel-style Autosum.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Search, X, Download, ChevronRight } from "lucide-react";
import { listAccountsJobs } from "../../lib/jobs.js";
import { listAllExpenditures } from "../../lib/expenditures.js";
import { listInvoiceTotalsByRefs } from "../../lib/invoices.js";
import { jobCostSummary, digitalSnapshotRates } from "../../lib/costBreakdown.js";
import { computeDigitalQuote } from "../../lib/digitalQuoteCalc.js";
import { PARENT_SHEETS, LAM_TYPES, BINDING_TYPES, offsetBookLabel, offsetSheetLabel } from "../../lib/printSpecs.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";
import { formatGHS } from "../../lib/currency.js";
import { exportToCsv } from "../../lib/csvExport.js";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";
import { useCellSelection } from "../../lib/useCellSelection.js";
import { CellSumBar } from "./CellSumBar.jsx";
import { OffsetQuoteBreakdown } from "../quote/OffsetQuoteBreakdown.jsx";
import { DigitalQuoteResults } from "../quote/DigitalQuoteResults.jsx";

// formatGHS drops the sign — keep it for losses / credits
const GHS = (v) => (Number(v) < 0 ? `− ${formatGHS(v)}` : formatGHS(v));

// The amounts on each list row, in order (Autosum columns)
const LIST_COLS = [
  { key: "cost",         label: "Cost",   get: (s) => s.cost },
  { key: "profit",       label: "Profit", get: (s) => s.profit, tone: "text-amber-600" },
  { key: "invoiceTotal", label: "Total",  get: (s) => s.invoiceTotal, strong: true },
  { key: "paid",         label: "Paid",   get: (s) => s.paid, tone: "text-green-600" },
];

const TYPE_FILTERS = [
  { key: "all",     label: "All" },
  { key: "offset",  label: "Offset" },
  { key: "digital", label: "Digital" },
  { key: "mixed",   label: "Mixed" },
  { key: "items",   label: "Items only" },
];
const KIND_LABEL = { offset: "Offset", digital: "Digital", mixed: "Mixed", items: "Items" };

const chip = (on) => [
  "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
  on
    ? "border-[#6366F1] bg-[#6366F1]/10 text-[#6366F1]"
    : "border-[var(--t-border)] text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/5",
].join(" ");

const fmtDate = (iso) => (iso
  ? new Date(iso).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" })
  : "—");

// ── Offset quote, as the Offset quoter shows it ─────────────────────────────
function OffsetSection({ q }) {
  const snap = q.snapshot;
  const job  = snap.job || {};
  const unit = job.dimUnit || "in";
  const resultQtys = (snap.resultQtys ?? []).map(Number).filter((n) => snap.results?.[n]);
  const sheet = job.parentSheet === "custom"
    ? { w: job.customSheetW, h: job.customSheetH, label: "Custom" }
    : PARENT_SHEETS[job.parentSheet];

  return (
    <div className="rounded-xl bg-brand-cream p-4 sm:p-6" style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}>
      <div style={{ marginBottom: 16, background: "#EDE7D9", borderRadius: 8, padding: "12px 16px" }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E" }}>{snap.jobTitle || q.name || "—"}</div>
        <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>
          {snap.clientName && <span>Client: <b>{snap.clientName}</b> &middot; </span>}
          {job.numPages} pages &middot; {job.colours === "1" ? "1 colour" : job.colours === "4" ? "Full colour" : "2 colours"} &middot;{" "}
          {offsetBookLabel(job, unit)}{sheet && <> &middot; {offsetSheetLabel(sheet, unit)}</>} &middot;{" "}
          {BINDING_TYPES.find((b) => b.value === job.bindingType)?.label}
          {job.hasCover && ` · Cover: ${LAM_TYPES.find((l) => l.value === job.laminationType)?.label || "No lam."}`}
        </div>
        <div style={{ fontSize: 11, color: "#888", marginTop: 3 }}>Ref: <b>{snap.ref}</b>{snap.date ? ` · ${snap.date}` : ""}</div>
      </div>

      <OffsetQuoteBreakdown job={job} rates={snap.rates || {}} results={snap.results} resultQtys={resultQtys}
        invoicedQty={q.qty} autosum />
    </div>
  );
}

// ── Digital quote, as the Digital quoter shows it ───────────────────────────
function DigitalSection({ q }) {
  const snap  = q.snapshot;
  const job   = useMemo(() => snap.job || {}, [snap]);
  const rates = useMemo(() => digitalSnapshotRates(snap), [snap]);
  const calc  = useMemo(() => computeDigitalQuote(job, rates, snap.result?.sheetName || null), [job, rates, snap]);

  const shown = calc.isLF ? calc.lfQuote?.sell : calc.sellPrice;
  const saved = snap.result?.sellPrice;
  const drift = saved != null && shown != null && Math.abs(shown - saved) >= 0.01;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4 sm:p-5">
        <p className="text-sm font-semibold text-[var(--t-text1)]">{snap.jobTitle || q.name}</p>
        <p className="mt-0.5 text-xs text-[var(--t-muted)]">{snap.result?.description}</p>
        <p className="mt-1 text-xs text-[var(--t-muted)]">
          Ref <span className="font-mono">{snap.ref}</span>{snap.date ? ` · ${snap.date}` : ""} ·
          Outsource cost <b className="text-[var(--t-text1)]">{GHS(q.cost)}</b> ·
          Markup {snap.result?.markup ?? "—"}% = <b className="text-amber-600">{GHS(q.profit)}</b>
        </p>
      </div>

      {drift && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          Recalculated from the rates saved with this quote. The price saved at the time was {GHS(saved)}.
        </p>
      )}

      <DigitalQuoteResults calc={calc} qty={job.qty} duplex={job.duplex} rates={rates}
        pickedSheet={snap.result?.sheetName || null} autosum />
    </div>
  );
}

function SummaryRow({ label, value, tone, strong }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <span className={`text-sm ${strong ? "font-semibold text-[var(--t-text1)]" : "text-[var(--t-text2)]"}`}>{label}</span>
      <span className={`shrink-0 text-sm tabular-nums ${strong ? "font-semibold" : ""} ${tone || "text-[var(--t-text1)]"}`}>{value}</span>
    </div>
  );
}

function JobCostModal({ job, s, onClose }) {
  const overlayRef = useRef(null);

  useEffect(() => {
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div ref={overlayRef} role="dialog" aria-modal="true" aria-label={`Cost breakdown for ${job.job_title || job.quote_ref}`}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 sm:items-center sm:p-4"
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}>
      <div className="flex h-[94vh] w-full flex-col overflow-hidden rounded-t-xl border border-[var(--t-border)] bg-[var(--t-bg)] shadow-lg sm:h-auto sm:max-h-[92vh] sm:max-w-4xl sm:rounded-xl">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-3 sm:px-5 sm:py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--t-muted)]">Cost breakdown</p>
            <h3 className="truncate text-base font-semibold text-[var(--t-text1)]">{job.job_title || "Untitled job"}</h3>
            <p className="mt-0.5 truncate text-xs text-[var(--t-muted)]">
              <span className="font-mono">{job.quote_ref}</span> · {job.client_name || "—"} · {jobStatusLabel(job.status)}
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close"
            className="shrink-0 rounded-md p-1.5 text-[var(--t-muted)] transition-colors hover:bg-gray-100 hover:text-[var(--t-text1)] dark:hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 pb-24 sm:px-5">
          {s.quotes.length === 0 && (
            <p className="rounded-md border border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-2 text-xs text-[var(--t-muted)]">
              This job wasn't priced from an Offset or Digital quote, so there is no quote breakdown. Only the invoice is shown.
            </p>
          )}

          {s.quotes.map((q, i) => (
            <section key={`${q.ref}-${i}`} className="space-y-2">
              {s.quotes.length > 1 && (
                <h4 className="text-sm font-semibold text-[var(--t-text1)]">
                  {i + 1}. {q.name} <span className="font-normal text-[var(--t-muted)]">· {q.type === "offset" ? "Offset" : "Digital"} quote</span>
                </h4>
              )}
              {q.type === "offset" ? <OffsetSection q={q} /> : <DigitalSection q={q} />}
            </section>
          ))}

          {/* Invoice + payments */}
          <section className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2">
            <div className="divide-y divide-[var(--t-border)]">
              {s.otherLines.map((l, k) => <SummaryRow key={k} label={l.label} value={GHS(l.amount)} />)}
              {s.discount > 0 && <SummaryRow label="Discount" value={`− ${formatGHS(s.discount)}`} />}
              <SummaryRow label="Invoice total" value={GHS(s.invoiceTotal)} strong />
              <SummaryRow label="Paid" value={GHS(s.paid)} tone="text-green-600" />
              <SummaryRow label="Outstanding" value={s.outstanding <= 0 ? "Settled" : GHS(s.outstanding)}
                tone={s.outstanding <= 0 ? "text-green-600" : "text-red-600"} />
              <SummaryRow label="Expenses recorded" value={s.expenses ? GHS(s.expenses) : "—"} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── Tab ──────────────────────────────────────────────────────────────────────
export function CostBreakdownTab() {
  const [rows,    setRows]    = useState([]);   // [{ job, s }]
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [period,  setPeriod]  = useState(defaultPeriod());
  const [search,  setSearch]  = useState("");
  const [kind,    setKind]    = useState("all");
  const [open,    setOpen]    = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [jobs, expenditures] = await Promise.all([listAccountsJobs(), listAllExpenditures()]);
        const invoices = await listInvoiceTotalsByRefs(jobs.map((j) => j.quote_ref));
        // Prefer the invoice document over a quote document sharing the ref
        const byRef = {};
        for (const inv of invoices) if (!byRef[inv.ref] || inv.type === "invoice") byRef[inv.ref] = inv;
        const spent = {};
        for (const e of expenditures) if (e.job_id) spent[e.job_id] = (spent[e.job_id] ?? 0) + Number(e.amount || 0);
        if (alive) setRows(jobs.map((job) => ({ job, s: jobCostSummary(job, byRef[job.quote_ref], spent[job.id]) })));
      } catch (err) {
        if (alive) setError(err.message ?? "Could not load jobs.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const q = search.toLowerCase().trim();
  const visible = useMemo(() => filterByPeriod(rows.map((r) => ({ ...r, created_at: r.job.created_at })), period)
    .filter(({ job, s }) =>
      (kind === "all" || s.kind === kind) &&
      (!q ||
        (job.job_title ?? "").toLowerCase().includes(q) ||
        (job.client_name ?? "").toLowerCase().includes(q) ||
        (job.quote_ref ?? "").toLowerCase().includes(q))),
  [rows, period, kind, q]);

  const getValue = useCallback((r, c) => LIST_COLS[c].get(visible[r].s), [visible]);
  const sel = useCellSelection({
    rowCount: visible.length,
    colCount: LIST_COLS.length,
    getValue,
    resetKey: `${period?.year}-${period?.month}|${kind}|${q}`,
  });

  const totals = useMemo(() => Object.fromEntries(LIST_COLS.map((col) => [
    col.key, visible.reduce((sum, { s }) => sum + (col.get(s) ?? 0), 0),
  ])), [visible]);
  const outstanding = visible.reduce((sum, { s }) => sum + Math.max(0, s.outstanding), 0);

  function handleExport() {
    exportToCsv(`cost-breakdown-${new Date().toISOString().slice(0, 10)}.csv`, visible.map(({ job, s }) => ({
      "Ref":                job.quote_ref,
      "Job":                job.job_title || "",
      "Client":             job.client_name || "",
      "Type":               KIND_LABEL[s.kind],
      "Date":               job.created_at?.slice(0, 10) ?? "",
      "Cost (GHS)":         s.cost == null ? "" : s.cost.toFixed(2),
      "Profit (GHS)":       s.profit == null ? "" : s.profit.toFixed(2),
      "Invoice total (GHS)": s.invoiceTotal.toFixed(2),
      "Paid (GHS)":         s.paid.toFixed(2),
      "Outstanding (GHS)":  s.outstanding.toFixed(2),
      "Expenses (GHS)":     s.expenses.toFixed(2),
    })));
  }

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6 sm:py-8">
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[var(--t-text1)]">Cost Breakdown</h2>
          <p className="mt-1 text-sm text-[var(--t-muted)]">Paid jobs. Tap a job to see its breakdown exactly as the quoter worked it out.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PeriodPicker period={period} onChange={setPeriod} bgVar="--t-bg" />
          <button type="button" onClick={handleExport} disabled={!visible.length}
            className="inline-flex items-center gap-1.5 rounded-md border border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-2 text-sm font-medium text-[var(--t-text2)] transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-white/5">
            <Download size={14} /> Export CSV
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: "Production cost", value: totals.cost,         sub: "From the quoters" },
          { label: "Profit",          value: totals.profit,       sub: "Margin / markup", tone: "text-amber-600" },
          { label: "Invoiced",        value: totals.invoiceTotal, sub: "Charged to clients" },
          { label: "Received",        value: totals.paid,         sub: `${GHS(outstanding)} outstanding`, tone: "text-green-600" },
        ].map((c) => (
          <div key={c.label} className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--t-muted)]">{c.label}</p>
            <p className={`mt-1 text-lg font-semibold tabular-nums sm:text-2xl ${c.tone || "text-[var(--t-text1)]"}`}>{GHS(c.value)}</p>
            <p className="mt-0.5 truncate text-xs text-[var(--t-muted)]">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by job, client or ref…" aria-label="Search jobs"
            className="w-full rounded-md border border-[var(--t-border)] bg-[var(--t-surface)] py-2 pl-8 pr-3 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] transition-colors focus:border-[#6366F1] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Job type">
          {TYPE_FILTERS.map((t) => (
            <button key={t.key} type="button" aria-pressed={kind === t.key} onClick={() => setKind(t.key)} className={chip(kind === t.key)}>{t.label}</button>
          ))}
        </div>
      </div>

      {visible.length > 0 && (
        <p className="-mt-1 text-xs text-[var(--t-muted)]">
          Autosum: tap or drag across amounts to add them up. This works here and inside each breakdown. Shift+click selects a block,
          Ctrl/⌘+click adds single cells, and clicking a heading selects the whole column.
        </p>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#6366F1]/30 border-t-[#6366F1]" aria-label="Loading" />
        </div>
      ) : !error && visible.length === 0 ? (
        <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-10 text-center">
          <p className="text-sm text-[var(--t-muted)]">{q || kind !== "all" ? "No jobs match these filters." : "No paid jobs for this period."}</p>
        </div>
      ) : visible.length > 0 ? (
        <div ref={sel.containerRef} role="grid" aria-label="Paid jobs" aria-multiselectable="true"
          className="overflow-hidden rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)]">
          {/* Column headings (wider screens) — click to select a column */}
          <div role="row" className="hidden items-center gap-3 border-b border-[var(--t-border)] px-4 sm:flex">
            <span className="flex-1 py-2.5 text-xs font-semibold text-[var(--t-muted)]">Job</span>
            <div className="grid w-[460px] shrink-0 grid-cols-4">
              {LIST_COLS.map((col, c) => (
                <button key={col.key} type="button" onClick={(e) => sel.selectColumn(e, c)} title={`Select the whole ${col.label} column`}
                  className="px-2 py-2.5 text-right text-xs font-semibold text-[var(--t-muted)] transition-colors hover:bg-[#6366F1]/[0.06] hover:text-[var(--t-text1)]">
                  {col.label}
                </button>
              ))}
            </div>
            <span className="w-5" />
          </div>

          <ul className="divide-y divide-[var(--t-border)]">
            {visible.map(({ job, s }, i) => (
              <li key={job.id} role="row" className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
                <button type="button" onClick={() => setOpen({ job, s })}
                  className="group flex min-w-0 flex-1 items-center gap-3 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--t-text1)] group-hover:text-[#6366F1]">{job.job_title || "Untitled job"}</span>
                      <span className="shrink-0 rounded-full border border-[var(--t-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--t-text2)]">{KIND_LABEL[s.kind]}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-[var(--t-muted)]">
                      <span className="font-mono">{job.quote_ref}</span> · {job.client_name || "—"} · {fmtDate(job.created_at)}
                    </span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-[var(--t-muted)] sm:hidden" />
                </button>

                <div className="grid grid-cols-2 gap-1 sm:w-[460px] sm:shrink-0 sm:grid-cols-4 sm:gap-0">
                  {LIST_COLS.map((col, c) => {
                    const v  = col.get(s);
                    const on = sel.isSelected(i, c);
                    return (
                      <div key={col.key} {...sel.cellProps(i, c)}
                        className={[
                          "flex cursor-cell select-none items-baseline justify-between gap-2 rounded-md px-2 py-1 outline-none transition-colors sm:block sm:text-right",
                          "focus-visible:shadow-[inset_0_0_0_2px_rgba(99,102,241,0.5)]",
                          on ? "bg-[#6366F1]/[0.12] shadow-[inset_0_0_0_2px_#6366F1]" : "hover:bg-[#6366F1]/[0.05]",
                        ].join(" ")}>
                        <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--t-muted)] sm:hidden">{col.label}</span>
                        <span className={`text-xs tabular-nums sm:text-sm ${col.strong ? "font-semibold" : ""} ${v == null ? "text-[var(--t-muted)]" : col.tone || "text-[var(--t-text1)]"}`}>
                          {v == null ? "—" : GHS(v)}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <button type="button" onClick={() => setOpen({ job, s })} aria-label={`Open breakdown for ${job.job_title || job.quote_ref}`}
                  className="hidden shrink-0 rounded-md p-0.5 text-[var(--t-muted)] transition-colors hover:text-[#6366F1] sm:block">
                  <ChevronRight size={16} />
                </button>
              </li>
            ))}
          </ul>

          {/* Totals */}
          <div className="flex flex-col gap-2 border-t-2 border-[var(--t-border)] bg-[var(--t-bg)] px-4 py-3 sm:flex-row sm:items-center sm:gap-3">
            <span className="flex-1 text-xs font-medium text-[var(--t-muted)]">{visible.length} job{visible.length !== 1 ? "s" : ""}</span>
            <div className="grid grid-cols-2 gap-1 sm:w-[460px] sm:shrink-0 sm:grid-cols-4 sm:gap-0">
              {LIST_COLS.map((col) => (
                <div key={col.key} className="flex items-baseline justify-between gap-2 px-2 sm:block sm:text-right">
                  <span className="text-[10px] uppercase tracking-[0.08em] text-[var(--t-muted)] sm:hidden">{col.label}</span>
                  <span className={`text-xs font-semibold tabular-nums sm:text-sm ${col.tone || "text-[var(--t-text1)]"}`}>{GHS(totals[col.key])}</span>
                </div>
              ))}
            </div>
            <span className="hidden w-5 sm:block" />
          </div>
        </div>
      ) : null}

      {!open && <CellSumBar stats={sel.stats} onCopy={sel.copySelection} onClear={sel.clear} />}

      {open && <JobCostModal job={open.job} s={open.s} onClose={() => setOpen(null)} />}
    </div>
  );
}
