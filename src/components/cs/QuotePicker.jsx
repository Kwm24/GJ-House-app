/**
 * QuotePicker.jsx
 * Searchable picker for adding saved offset / digital print quotes to an
 * invoice as print items. Searches the database (not just recent quotes), so
 * it stays usable with thousands of saved quotes.
 *
 * Styling follows genesis-DESIGN.md: 6px inputs/buttons, 8px popover with
 * shadow-lg, pill filter chips (indigo when active), divided list rows,
 * indigo used only for interactive states.
 */
import { useEffect, useRef, useState } from "react";
import { Search, Plus, X } from "lucide-react";
import { searchSavedQuotes } from "../../lib/quoteStorage.js";
import { formatGHS as GHS } from "../../lib/currency.js";

const PAGE = 25;

const FILTERS = [
  { value: "all",     label: "All" },
  { value: "offset",  label: "Offset" },
  { value: "digital", label: "Digital" },
];

// Price + quantity summary for one result row
function quoteFigures(type, snap) {
  if (type === "digital") {
    const r = snap.result ?? {};
    return { price: Number(r.sellPrice) || 0, qtyLabel: `${Number(r.qty || 0).toLocaleString()} ${r.isUnit || r.isLF ? "pieces" : "copies"}` };
  }
  const qtys = (snap.resultQtys?.length ? snap.resultQtys : Object.keys(snap.results ?? {}))
    .map(Number).filter((n) => n > 0);
  if (!qtys.length) return { price: null, qtyLabel: "Not priced" };
  const minQty = Math.min(...qtys);
  const first  = snap.results?.[minQty] ?? snap.results?.[String(minQty)];   // "from" = smallest run
  const qtyLabel = qtys.length > 1
    ? `${qtys.length} quantities · ${Math.min(...qtys).toLocaleString()}–${Math.max(...qtys).toLocaleString()}`
    : `${qtys[0].toLocaleString()} copies`;
  return { price: first?.grandTotal ?? null, qtyLabel, from: qtys.length > 1 };
}

function fmtDate(d) {
  if (!d) return "";
  try { return new Date(d).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return ""; }
}

export function QuotePicker({ onPick }) {
  const [open,    setOpen]    = useState(false);
  const [term,    setTerm]    = useState("");
  const [query,   setQuery]   = useState("");   // debounced term
  const [type,    setType]    = useState("all");
  const [rows,    setRows]    = useState([]);
  const [count,   setCount]   = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");
  const [active,  setActive]  = useState(0);

  const wrapRef  = useRef(null);
  const inputRef = useRef(null);
  const listRef  = useRef(null);
  const reqId    = useRef(0);

  // Debounce typing so we don't query on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setQuery(term), 250);
    return () => clearTimeout(t);
  }, [term]);

  // Fetch first page whenever the search or filter changes
  useEffect(() => {
    if (!open) return;
    const id = ++reqId.current;
    setLoading(true);
    setError("");
    searchSavedQuotes({ term: query, type, limit: PAGE, offset: 0 })
      .then(({ rows: r, count: c }) => {
        if (id !== reqId.current) return;   // a newer search has started
        setRows(r);
        setCount(c);
        setActive(0);
      })
      .catch((err) => { if (id === reqId.current) setError(err.message ?? "Could not search quotes."); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }, [open, query, type]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  useEffect(() => { if (open) inputRef.current?.focus(); }, [open]);

  // Keep the keyboard-highlighted row in view
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function loadMore() {
    const id = ++reqId.current;
    setLoading(true);
    searchSavedQuotes({ term: query, type, limit: PAGE, offset: rows.length })
      .then(({ rows: r, count: c }) => {
        if (id !== reqId.current) return;
        setRows((prev) => [...prev, ...r]);
        setCount(c);
      })
      .catch((err) => { if (id === reqId.current) setError(err.message ?? "Could not load more quotes."); })
      .finally(() => { if (id === reqId.current) setLoading(false); });
  }

  function pick(row) {
    onPick(row.snapshot, row.type);
    setOpen(false);
    setTerm("");
  }

  function onKeyDown(e) {
    if (e.key === "Escape")    { e.preventDefault(); setOpen(false); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, rows.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); }
    if (e.key === "Enter" && rows[active]) { e.preventDefault(); pick(rows[active]); }
  }

  return (
    <div ref={wrapRef} className="relative">
      {/* Trigger — secondary button */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={[
          "inline-flex h-[38px] items-center gap-2 rounded-md border px-4 text-sm font-medium transition-all duration-200",
          "hover:-translate-y-px",
          open
            ? "border-[#6366F1] text-[#6366F1] bg-[var(--t-surface)] shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
            : "border-[var(--t-border)] text-[var(--t-text1)] bg-[var(--t-surface)] hover:border-[#6366F1]/50",
        ].join(" ")}
      >
        <Plus size={16} aria-hidden="true" />
        Add saved print quote
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Search saved print quotes"
          className="absolute left-0 z-30 mt-2 w-[calc(100vw-32px)] max-w-[560px] overflow-hidden rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] shadow-lg"
        >
          {/* Search */}
          <div className="border-b border-[var(--t-border)] p-3">
            <div className="relative">
              <Search size={16} aria-hidden="true"
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
              <input
                ref={inputRef}
                type="search"
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search ref, job title, client or phone…"
                aria-controls="quote-picker-list"
                className="w-full rounded-md border border-[var(--t-border)] bg-[var(--t-surface)] py-2.5 pl-9 pr-9 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] transition-colors focus:border-[#6366F1] focus:outline-none focus:shadow-[0_0_0_3px_rgba(99,102,241,0.12)]"
              />
              {term && (
                <button type="button" onClick={() => { setTerm(""); inputRef.current?.focus(); }}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-[var(--t-muted)] hover:text-[var(--t-text1)]">
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Type filter chips */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setType(f.value)}
                  aria-pressed={type === f.value}
                  className={[
                    "rounded-full px-3 py-1 text-xs font-medium transition-colors",
                    type === f.value
                      ? "bg-[#6366F1] text-white"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-white/10 dark:text-[var(--t-text2)] dark:hover:bg-white/15",
                  ].join(" ")}
                >
                  {f.label}
                </button>
              ))}
              <span className="ml-auto text-xs text-[var(--t-muted)]" aria-live="polite">
                {loading && !rows.length ? "Searching…" : `${count.toLocaleString()} quote${count === 1 ? "" : "s"}`}
              </span>
            </div>
          </div>

          {/* Results */}
          <ul id="quote-picker-list" ref={listRef} role="listbox" className="max-h-[360px] overflow-y-auto">
            {error && (
              <li className="px-4 py-3 text-sm text-[#EF4444]">{error}</li>
            )}

            {!error && !loading && rows.length === 0 && (
              <li className="px-4 py-8 text-center">
                <p className="text-sm font-medium text-[var(--t-text1)]">No quotes found</p>
                <p className="mt-1 text-xs text-[var(--t-text2)]">
                  {term ? "Try a different ref, title or client name." : "Save a quote in the Offset or Digital quoter first."}
                </p>
              </li>
            )}

            {rows.map((row, i) => {
              const s   = row.snapshot ?? {};
              const fig = quoteFigures(row.type, s);
              const isActive = i === active;
              return (
                <li key={`${row.type}-${s.ref}-${i}`} role="option" aria-selected={isActive} data-index={i}
                  className="border-b border-[var(--t-border)] last:border-0">
                  <button
                    type="button"
                    onClick={() => pick(row)}
                    onMouseEnter={() => setActive(i)}
                    className={[
                      "flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors",
                      isActive ? "bg-[#6366F1]/[0.06]" : "",
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-[var(--t-text2)]">{s.ref}</span>
                        <span className={[
                          "rounded px-1.5 py-0.5 text-[11px] font-medium",
                          row.type === "offset"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                            : "bg-indigo-100 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
                        ].join(" ")}>
                          {row.type === "offset" ? "Offset" : "Digital"}
                        </span>
                      </div>
                      <p className="mt-0.5 truncate text-sm font-medium text-[var(--t-text1)]">
                        {s.jobTitle || "Untitled quote"}
                      </p>
                      <p className="truncate text-xs text-[var(--t-text2)]">
                        {[s.clientName || "No client", fig.qtyLabel, fmtDate(row.updatedAt)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      {fig.price != null ? (
                        <>
                          {fig.from && <p className="text-[11px] text-[var(--t-muted)]">from</p>}
                          <p className="text-sm font-medium tabular-nums text-[var(--t-text1)]">{GHS(fig.price)}</p>
                        </>
                      ) : (
                        <p className="text-xs text-[#F59E0B]">Not priced</p>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}

            {rows.length > 0 && rows.length < count && (
              <li className="p-3 text-center">
                <button type="button" onClick={loadMore} disabled={loading}
                  className="rounded-md px-3 py-1.5 text-sm font-medium text-[#6366F1] hover:bg-[#6366F1]/[0.06] disabled:opacity-60">
                  {loading ? "Loading…" : `Show more (${(count - rows.length).toLocaleString()} left)`}
                </button>
              </li>
            )}
          </ul>

          <div className="border-t border-[var(--t-border)] px-4 py-2 text-[11px] text-[var(--t-muted)]">
            ↑ ↓ to move · Enter to add · Esc to close
          </div>
        </div>
      )}
    </div>
  );
}
