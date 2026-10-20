import { useState, useEffect, useRef } from "react";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const CURRENT_YEAR = new Date().getFullYear();

/**
 * Month-by-month period selector — single horizontally-scrollable row.
 *
 * period: { year: number, month: number } — specific month
 *       | { year: null,   month: null   } — all time
 *
 * accentColor: optional hex for the active-button fill.
 * bgVar: CSS variable name for the fade gradient (default "--t-surface").
 */
export function PeriodPicker({ period, onChange, accentColor = "#6366F1", bgVar = "--t-surface" }) {
  const [browseYear, setBrowseYear] = useState(period?.year ?? CURRENT_YEAR);
  const activeRef = useRef(null);

  // Sync when parent changes period.year externally
  useEffect(() => {
    if (period?.year != null) setBrowseYear(period.year);
  }, [period?.year]);

  // Scroll the active month button into view when selection changes
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [period?.month, period?.year]);

  const isAll = period?.year == null;

  function prevYear() {
    const y = browseYear - 1;
    setBrowseYear(y);
    if (!isAll) onChange({ year: y, month: period.month });
  }

  function nextYear() {
    const y = browseYear + 1;
    setBrowseYear(y);
    if (!isAll) onChange({ year: y, month: period.month });
  }

  function selectMonth(m) {
    onChange({ year: browseYear, month: m });
  }

  const activeStyle = { backgroundColor: accentColor, borderColor: accentColor };
  const baseCls = "shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold border transition-colors";
  const activeCls = `${baseCls} text-white`;
  const inactiveCls = `${baseCls} bg-[var(--t-surface)] text-[var(--t-text2)] border-[var(--t-border)] hover:border-[var(--t-text2)] hover:text-[var(--t-text1)]`;

  return (
    <div className="relative">
      {/* Single horizontally-scrollable row — no wrapping, hidden scrollbar */}
      <div
        className="flex items-center gap-1.5 overflow-x-auto pb-0.5 [&::-webkit-scrollbar]:hidden"
        style={{ scrollbarWidth: "none" }}
      >

        <span className="shrink-0 text-xs font-semibold text-[var(--t-muted)] pr-0.5">Period:</span>

        {/* Year nav */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={prevYear}
            disabled={browseYear <= 2024}
            className="rounded-l-lg px-2 py-1 text-sm border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors leading-none"
          >
            ‹
          </button>
          <span className="px-2.5 py-1 text-xs font-bold tabular-nums border-t border-b border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text1)] min-w-[3.25rem] text-center leading-5 select-none">
            {browseYear}
          </span>
          <button
            type="button"
            onClick={nextYear}
            disabled={browseYear >= CURRENT_YEAR}
            className="rounded-r-lg px-2 py-1 text-sm border border-[var(--t-border)] bg-[var(--t-surface)] text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/10 disabled:opacity-30 transition-colors leading-none"
          >
            ›
          </button>
        </div>

        {/* Month buttons */}
        {MONTHS.map((m, i) => {
          const active = !isAll && period.month === i && browseYear === period.year;
          return (
            <button
              key={m}
              ref={active ? activeRef : null}
              type="button"
              onClick={() => selectMonth(i)}
              className={active ? activeCls : inactiveCls}
              style={active ? activeStyle : undefined}
            >
              {m}
            </button>
          );
        })}

        {/* Divider */}
        <span className="shrink-0 text-[var(--t-border)] select-none px-0.5">|</span>

        {/* All time */}
        <button
          ref={isAll ? activeRef : null}
          type="button"
          onClick={() => onChange({ year: null, month: null })}
          className={isAll ? activeCls : inactiveCls}
          style={isAll ? activeStyle : undefined}
        >
          All time
        </button>

        {/* Trailing spacer so last button isn't hidden by the fade */}
        <span className="shrink-0 w-6 select-none" aria-hidden />
      </div>

      {/* Right-edge fade — hints that there are more items to scroll */}
      <div
        className="pointer-events-none absolute right-0 top-0 bottom-0.5 w-8"
        style={{
          background: `linear-gradient(to left, var(${bgVar}) 30%, transparent)`,
        }}
      />
    </div>
  );
}

/**
 * Filter an array of items to a specific year+month.
 * If period.year is null, returns the full array unchanged.
 */
export function filterByPeriod(items, period, dateField = "created_at") {
  if (!period || period.year == null) return items;
  return items.filter((item) => {
    const raw = item[dateField] ?? item.created_at;
    if (!raw) return false;
    const d = new Date(raw);
    return d.getFullYear() === period.year && d.getMonth() === period.month;
  });
}

/** Default period: the current calendar month. */
export function defaultPeriod() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() };
}
