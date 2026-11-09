/**
 * DigitalQuoteResults.jsx
 * What the Digital quoter shows once a job is priced: parent sheet comparison,
 * cover comparison (booklets), the quote summary and the layout preview.
 * Used by the quoter itself and by the Accounts cost breakdown, so both show
 * the same thing. `autosum` makes every amount selectable with an
 * Excel-style Sum bar (cell map from digitalResultCells()).
 */
import { useCallback, useMemo } from "react";
import { DIGITAL_SHEET_NAMES } from "../../lib/digitalPrintSpecs.js";
import { digitalResultCells } from "../../lib/digitalQuoteCalc.js";
import { useCellSelection } from "../../lib/useCellSelection.js";
import { CellSumBar } from "../accounts/CellSumBar.jsx";
import { formatGHS as GHS } from "../../lib/currency.js";

const cls = {
  card: "rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4 sm:p-5",
  th:   "py-2 px-3 text-right text-xs font-semibold text-[var(--t-muted)] border-b border-[var(--t-border)]",
  td:   "py-2 px-3 text-right text-sm text-[var(--t-text1)] border-b border-[var(--t-border)] tabular-nums whitespace-nowrap",
};

const SEL_ON = "bg-[#6366F1]/[0.12] shadow-[inset_0_0_0_2px_#6366F1]";

// ── Layout preview ───────────────────────────────────────────────────────────
function SheetPreview({ result, label, sheetDims }) {
  if (!result?.up || !result.f || !sheetDims) return null;
  const S  = sheetDims;
  const sc = Math.min(200 / S.w, 200 / S.h);
  const f  = result.f;
  const m  = 5;
  const ox = m + (S.w - 2 * m - (f.c * f.a + Math.max(0, f.c - 1) * 3)) / 2;
  const oy = m + (S.h - 2 * m - (f.n * f.b + Math.max(0, f.n - 1) * 3)) / 2;
  const pieces = [];
  for (let i = 0; i < f.c; i++) {
    for (let j = 0; j < f.n; j++) {
      pieces.push(
        <rect key={`${i}-${j}`}
          x={(ox + i * (f.a + 3)) * sc} y={(oy + j * (f.b + 3)) * sc}
          width={f.a * sc} height={f.b * sc}
          fill="#6366F1" fillOpacity="0.22" stroke="#6366F1" strokeWidth="1"
        />
      );
    }
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox={`0 0 ${S.w * sc} ${S.h * sc}`} width={S.w * sc} height={S.h * sc}
        className="rounded border border-[var(--t-border)]" style={{ background: 'var(--t-bg)' }}>
        <rect width={S.w * sc} height={S.h * sc} fill="var(--t-bg)" stroke="var(--t-border)" strokeWidth="1"/>
        {pieces}
      </svg>
      <p className="text-[10px] text-[var(--t-muted)] text-center">
        {label && <span className="font-medium">{label}: </span>}
        {result.name}, {f.c}×{f.n} = {f.up} up{f.rotated ? ', rotated' : ''}
      </p>
    </div>
  );
}

export function DigitalQuoteResults({ calc, qty, duplex, rates, pickedSheet, onPickSheet, autosum = false }) {
  const cellMap  = useMemo(() => digitalResultCells(calc, qty), [calc, qty]);
  const getValue = useCallback((r, c) => cellMap.values[r]?.[c] ?? null, [cellMap]);
  const selection = useCellSelection({ rowCount: cellMap.values.length, colCount: 2, getValue });
  const sel   = autosum ? selection : null;
  const cells = autosum ? cellMap : null;

  const {
    isUnit, unitQuote, isLF, isBook, normPages, leavesPerCopy, comparison, bestSheet, pickedResult,
    coverComparison, bestCover, activeMat, lfQuote, sellPrice,
  } = calc;

  // An amount cell — selectable for Autosum when `sel` is given
  const money = (pos, value, extra = "") => {
    if (!sel || !pos) return <td className={`${cls.td} ${extra}`}>{GHS(value)}</td>;
    const [r, c] = pos;
    return (
      <td {...sel.cellProps(r, c)}
        className={`${cls.td} ${extra} cursor-cell select-none outline-none focus-visible:shadow-[inset_0_0_0_2px_rgba(99,102,241,0.5)] ${sel.isSelected(r, c) ? SEL_ON : "hover:bg-[#6366F1]/[0.05]"}`}>
        {GHS(value)}
      </td>
    );
  };

  const totalProps = sel && cells?.total != null
    ? { ...sel.cellProps(cells.total, 0), className: `inline-block rounded-md px-2 cursor-cell select-none outline-none ${sel.isSelected(cells.total, 0) ? SEL_ON : "hover:bg-[#6366F1]/[0.05]"}` }
    : {};

  const body = (
    <>
      {/* ── Sheet comparison ── */}
      {!isLF && !isUnit && (
        <div className={cls.card}>
          <h3 className="text-sm font-semibold text-[var(--t-text1)] mb-3">Parent sheet comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>
                <th className={cls.th + " text-left"}>Sheet</th>
                <th className={cls.th}>Up</th>
                <th className={cls.th}>Sheets</th>
                <th className={cls.th}>Cost</th>
                <th className={cls.th}>Per copy</th>
              </tr></thead>
              <tbody>
                {DIGITAL_SHEET_NAMES.map((name) => {
                  const r       = comparison[name];
                  const isBest  = bestSheet?.name === name;
                  const isPicked = (pickedSheet === name) || (!pickedSheet && isBest);
                  if (!r || r.up === 0) return (
                    <tr key={name}>
                      <td className={cls.td + " text-left"}>{name}</td>
                      <td className={cls.td + " text-[var(--t-muted)]"} colSpan={4}>Doesn't fit</td>
                    </tr>
                  );
                  const row = cells?.sheet?.[name];
                  return (
                    <tr key={name} onClick={onPickSheet ? () => onPickSheet(name) : undefined}
                      className={`transition-colors ${onPickSheet ? "cursor-pointer" : ""} ${isPicked ? 'bg-[#6366F1]/10' : 'hover:bg-[var(--t-bg)]'}`}>
                      <td className={cls.td + " text-left font-medium"}>
                        {name}
                        {isBest && <span className="ml-2 text-[10px] font-semibold text-green-600">★ cheapest</span>}
                        {!onPickSheet && isPicked && <span className="ml-2 text-[10px] font-semibold text-[#6366F1]">used</span>}
                      </td>
                      <td className={cls.td}>{r.up}</td>
                      <td className={cls.td}>{r.sheets}</td>
                      {money(row != null && [row, 0], r.cost)}
                      {money(row != null && [row, 1], r.cost / qty)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-[var(--t-muted)]">
            {onPickSheet ? "Tap a row to select that sheet. " : "The highlighted sheet was used for this quote. "}Count includes waste.
          </p>
        </div>
      )}

      {/* ── Cover comparison (book) ── */}
      {isBook && (
        <div className={cls.card}>
          <h3 className="text-sm font-semibold text-[var(--t-text1)] mb-3">Cover: parent sheet comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>
                <th className={cls.th + " text-left"}>Sheet</th><th className={cls.th}>Up</th><th className={cls.th}>Sheets</th><th className={cls.th}>Cost</th>
              </tr></thead>
              <tbody>
                {DIGITAL_SHEET_NAMES.map((name) => {
                  const r = coverComparison[name];
                  if (!r || r.up === 0) return <tr key={name}><td className={cls.td + " text-left"}>{name}</td><td className={cls.td + " text-[var(--t-muted)]"} colSpan={3}>Doesn't fit</td></tr>;
                  const row = cells?.cover?.[name];
                  return (
                    <tr key={name} className="hover:bg-[var(--t-bg)] transition-colors">
                      <td className={cls.td + " text-left font-medium"}>{name}{bestCover?.name === name && <span className="ml-2 text-[10px] font-semibold text-green-600">★</span>}</td>
                      <td className={cls.td}>{r.up}</td><td className={cls.td}>{r.sheets}</td>
                      {money(row != null && [row, 0], r.cost)}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Quote summary ── */}
      <div className={cls.card}>
        <h3 className="text-sm font-semibold text-[var(--t-text1)] mb-3">Quote</h3>

        {isUnit ? (unitQuote ? (
          <>
            <div className="text-center py-2">
              <p className="text-[10px] text-[var(--t-muted)] mb-1">Total price</p>
              <p className="text-3xl font-bold text-[var(--t-text1)] tabular-nums"><span {...totalProps}>{GHS(unitQuote.sell)}</span></p>
              <p className="text-xs text-[var(--t-muted)] mt-1">
                {qty} {qty === 1 ? 'piece' : 'pieces'} · {GHS(unitQuote.sell / qty)} per piece · {unitQuote.item}
              </p>
            </div>
            <div className="mt-3 border-t border-[var(--t-border)] pt-3 space-y-1">
              {unitQuote.rows.map((r) => (
                <div key={r.label} className="flex justify-between gap-3 text-xs text-[var(--t-text2)]">
                  <span>{r.label}</span><span className="tabular-nums">{GHS(r.amount)}</span>
                </div>
              ))}
              <div className="flex justify-between gap-3 text-xs text-[var(--t-text2)]">
                <span>Markup ({unitQuote.markup}%)</span><span className="tabular-nums">{GHS(unitQuote.sell - unitQuote.cost)}</span>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-[var(--t-muted)]">Pick an item with a cost above GH₵ 0 to see the price.</p>
        )) : isLF && lfQuote ? (
          <>
            <div className="text-center py-2">
              <p className="text-[10px] text-[var(--t-muted)] mb-1">Total price</p>
              <p className="text-3xl font-bold text-[var(--t-text1)] tabular-nums"><span {...totalProps}>{GHS(lfQuote.sell)}</span></p>
              <p className="text-xs text-[var(--t-muted)] mt-1">{qty} {qty === 1 ? 'piece' : 'pieces'} · {activeMat}</p>
            </div>
          </>
        ) : !isLF && pickedResult ? (
          <>
            <div className="text-center py-2">
              <p className="text-[10px] text-[var(--t-muted)] mb-1">Total price</p>
              <p className="text-3xl font-bold text-[var(--t-text1)] tabular-nums"><span {...totalProps}>{GHS(sellPrice)}</span></p>
              <p className="text-xs text-[var(--t-muted)] mt-1">
                {qty} copies · {GHS(sellPrice / qty)} per copy · {pickedResult.name}
              </p>
            </div>
            <p className="mt-3 text-[11px] text-[var(--t-muted)] text-center">
              {isBook
                ? `${normPages} pp · ${leavesPerCopy} leaf${leavesPerCopy !== 1 ? 'ves' : ''}/copy · ${pickedResult.up}-up${duplex ? ` (${pickedResult.up * 2} pages/sheet)` : ''} · ${qty * leavesPerCopy} pieces ÷ ${pickedResult.up} = ${Math.ceil(qty * leavesPerCopy / pickedResult.up)} sheets, +waste = `
                : `${qty} copies × ${leavesPerCopy} leaf${leavesPerCopy !== 1 ? 'ves' : ''} = ${qty * leavesPerCopy} pieces ÷ ${pickedResult.up} up = ${Math.ceil(qty * leavesPerCopy / pickedResult.up)} sheets, +waste = `}
              <strong>{pickedResult.sheets}</strong>.
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--t-muted)]">This size doesn't fit on any parent sheet. Try a smaller size.</p>
        )}
      </div>

      {/* ── Layout preview ── */}
      {!isLF && !isUnit && pickedResult?.f && (
        <div className={cls.card}>
          <h3 className="text-sm font-semibold text-[var(--t-text1)] mb-3">Layout preview</h3>
          <div className="flex flex-wrap gap-6">
            <SheetPreview result={pickedResult} sheetDims={rates.sheets[pickedResult.name]} />
            {isBook && bestCover?.f && <SheetPreview result={bestCover} label="Cover" sheetDims={rates.sheets[bestCover.name]} />}
          </div>
        </div>
      )}
    </>
  );

  if (!sel) return body;
  return (
    <div ref={sel.containerRef} className="space-y-4">
      {body}
      <CellSumBar stats={sel.stats} onCopy={sel.copySelection} onClear={sel.clear} />
    </div>
  );
}
