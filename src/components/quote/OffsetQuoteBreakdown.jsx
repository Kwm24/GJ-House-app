/**
 * OffsetQuoteBreakdown.jsx
 * The cost bar and cost table the Offset quoter shows after "Generate quote"
 * (plates, paper, impressions, cover, finishing, subtotal, margin, VAT, grand
 * total, unit price, deposit and balance — one column per quantity).
 * Used by the quoter itself and by the Accounts cost breakdown so both show
 * exactly the same thing. `autosum` makes every amount selectable with an
 * Excel-style Sum bar (row = table row, column = quantity).
 */
import { useCallback } from "react";
import { useCellSelection } from "../../lib/useCellSelection.js";
import { CellSumBar } from "../accounts/CellSumBar.jsx";
import { LAM_TYPES, BINDING_TYPES } from "../../lib/printSpecs.js";
import { formatGHS as GHS } from "../../lib/currency.js";

// Print-critical inline styles (the quote is also printed / saved as PDF)
const S = {
  tbl:     { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  th:      { padding: "8px 10px", background: "#1C1C1E", color: "#F5F0E8", textAlign: "right", fontFamily: "monospace", fontSize: 11, fontWeight: 600 },
  thF:     { textAlign: "left", width: 190 },
  td:      { padding: "6px 10px", borderBottom: "1px solid #E5DFD5", color: "#333", textAlign: "right", fontFamily: "monospace", fontSize: 12 },
  tdF:     { textAlign: "left", fontFamily: "inherit", fontSize: 11, color: "#666" },
  tdSub:   { fontWeight: 700, color: "#1C1C1E", background: "#EDE7D9" },
  tdGrand: { fontWeight: 700, color: "#C0392B", background: "#FAE8E6", fontSize: 14 },
  pill:    (bg) => ({ display: "inline-block", background: bg || "#555", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, marginLeft: 6 }),
};

const SEL_STYLE = { background: "rgba(99,102,241,0.18)", boxShadow: "inset 0 0 0 2px #6366F1" };

// ── Cost bar ─────────────────────────────────────────────────────────────────
export function CostBar({ r, qty }) {
  if (!r) return null;
  const items = [
    { label: "Plates",      val: r.plateCost,                              color: "#6366F1" },
    { label: "Paper",       val: r.paperCost,                              color: "#E67E22" },
    { label: "Impressions", val: r.impressionCost,                         color: "#2980B9" },
    { label: "Post-press",  val: (r.trimCost || 0) + r.foldCost + r.bindingCost, color: "#27AE60" },
    { label: "Cover",       val: r.coverPlateCost + r.coverPaperCost + r.coverLamCost + (r.coverImpressionCost || 0), color: "#8E44AD" },
    { label: "Margin",      val: r.margin,                                 color: "#7F8C8D" },
    { label: "VAT",         val: r.vatAmt,                                 color: "#BDC3C7" },
  ].filter(i => i.val > 0);
  const total = items.reduce((s, i) => s + i.val, 0);
  return (
    <div className="cost-bar-wrap mb-5">
      <p className="text-[10px] text-[var(--t-muted)] mb-1.5 tracking-widest uppercase">
        Cost breakdown &mdash; {qty?.toLocaleString()} copies
      </p>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {items.map(i => (
          <div key={i.label} title={`${i.label}: ${GHS(i.val)}`}
            style={{ width: `${(i.val / total) * 100}%`, background: i.color, transition: "width 0.4s" }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {items.map(i => (
          <span key={i.label} className="text-[10px] text-[var(--t-muted)] flex items-center gap-1">
            <span style={{ width: 7, height: 7, borderRadius: 2, background: i.color, display: "inline-block" }} />
            {i.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// The money rows of the table, in display order
function moneyRows(job, rates) {
  const lam = LAM_TYPES.find(l => l.value === job.laminationType)?.label;
  const bind = BINDING_TYPES.find(b => b.value === job.bindingType)?.label;
  const rows = [
    { key: "plates", cls: "spec-row", get: (r) => r?.plateCost,
      label: (R, Q) => <>Sepos &amp; Plates <span style={S.pill("#555")}>{R[Q[0]]?.numPlates} plates</span></> },
    { key: "paper", cls: "spec-row", get: (r) => r?.paperCost,
      label: (R, Q) => <>Paper {Q.map(q => <span key={q} style={{ ...S.pill("#E67E22"), marginRight: 3 }}>{R[q]?.paper?.reamsNeeded} rms</span>)}</> },
    { key: "impr", cls: "spec-row", get: (r) => r?.impressionCost,
      label: (R, Q) => <>Impressions <span style={S.pill("#2980B9")}>{R[Q[0]]?.impressions} impr.</span></> },
  ];
  if (job.hasCover) {
    rows.push(
      { key: "cplates", cls: "spec-row", get: (r) => r?.coverPlateCost, label: () => <>Cover &mdash; Plates</> },
      { key: "cimpr", cls: "spec-row", get: (r) => r?.coverImpressionCost,
        label: () => <>Cover &mdash; Impressions <span style={S.pill("#2980B9")}>{job.coverColours} clrs</span></> },
      { key: "cpaper", cls: "spec-row", get: (r) => r?.coverPaperCost,
        label: (R, Q) => <>Cover &mdash; Paper {Q.map(q => <span key={q} style={{ ...S.pill("#8E44AD"), marginRight: 3 }}>{R[q]?.coverPaper?.reamsNeeded} rms</span>)}</> },
    );
    if (job.laminationType !== "none") {
      rows.push({ key: "lam", cls: "spec-row", get: (r) => r?.coverLamCost,
        label: () => <>Lamination <span style={S.pill("#8E44AD")}>{lam}</span></> });
    }
  }
  rows.push(
    { key: "fold", cls: "spec-row", get: (r) => r?.foldCost, label: () => <>Fold &amp; Collate</> },
    { key: "trim", cls: "spec-row", get: (r) => r?.trimCost, label: () => <>Trimming</> },
    { key: "bind", cls: "spec-row", get: (r) => r?.bindingCost,
      label: () => <>Binding <span style={S.pill("#27AE60")}>{bind}</span></> },
    { key: "sub", cls: "subtotal-row spec-row", get: (r) => r?.subtotal, sub: true, label: () => <>Subtotal</> },
    { key: "margin", cls: "spec-row", get: (r) => r?.margin, label: () => <>Profit margin ({rates.profitMargin}%)</> },
    { key: "before", cls: "subtotal-row spec-row", get: (r) => r?.beforeVAT, sub: true, label: () => <>Total before VAT</> },
  );
  if (job.applyVAT) rows.push({ key: "vat", get: (r) => r?.vatAmt, label: () => <>VAT @ 20% (VAT + NHIL + GETFund)</> });
  rows.push(
    { key: "grand", cls: "grand-row", get: (r) => r?.grandTotal, grand: true,
      labelStyle: { fontWeight: 800, fontSize: 13, color: "#C0392B" }, label: () => <>GRAND TOTAL</> },
    { key: "unit", cls: "grand-row", get: (r) => r?.unitPrice, grand: true, cellStyle: { fontSize: 16 },
      labelStyle: { fontWeight: 800, fontSize: 13, color: "#C0392B" },
      label: () => <>UNIT PRICE <span style={{ fontSize: 10, fontWeight: 400, color: "#999" }}>per copy{parseInt(job.overs) > 0 ? ` · incl. ${parseInt(job.overs).toLocaleString()} overs` : ""}</span></> },
    { key: "deposit", trStyle: { borderTop: "2px solid #E0D9CF" }, get: (r) => (r?.grandTotal ?? 0) * 0.6,
      cellStyle: { fontWeight: 700, color: "#1C1C1E", paddingTop: 10 },
      labelStyle: { fontWeight: 700, color: "#1C1C1E", paddingTop: 10 },
      label: () => <>Deposit required (60%) <span style={{ fontSize: 9, fontWeight: 400, color: "#AAA", marginLeft: 6 }}>payable before production</span></> },
    { key: "balance", get: (r) => (r?.grandTotal ?? 0) * 0.4, cellStyle: { color: "#666" }, labelStyle: { color: "#666" },
      label: () => <>Balance on delivery</> },
  );
  return rows;
}

export function OffsetQuoteBreakdown({ job, rates, results, resultQtys, descRow = null, autosum = false, invoicedQty = null }) {
  const rows = moneyRows(job, rates);

  const getValue = useCallback(
    (r, c) => rows[r]?.get(results[resultQtys[c]]) ?? null,
    [rows, results, resultQtys],
  );
  const selection = useCellSelection({ rowCount: rows.length, colCount: resultQtys.length, getValue });
  const sel = autosum ? selection : null;

  return (
    <>
      <CostBar r={results[resultQtys[0]]} qty={resultQtys[0]} />

      <div style={{ overflowX: "auto" }}>
        <table ref={sel ? sel.containerRef : undefined} className="quote-table" style={S.tbl}>
          <thead>
            <tr>
              <th style={{ ...S.th, ...S.thF }}>Item</th>
              {resultQtys.map(q => (
                <th key={q} style={S.th}>
                  {q.toLocaleString()} copies
                  {invoicedQty != null && Number(q) === Number(invoicedQty) && (
                    <span style={{ display: "block", fontSize: 9, fontWeight: 400, color: "#C9B99A", letterSpacing: 1 }}>INVOICED</span>
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {descRow}
            {rows.map((row, ri) => {
              const base = { ...S.td, ...(row.sub ? S.tdSub : {}), ...(row.grand ? S.tdGrand : {}), ...(row.cellStyle || {}) };
              return (
                <tr key={row.key} className={row.cls} style={row.trStyle}>
                  <td style={{ ...S.tdF, ...(row.sub ? S.tdSub : {}), ...(row.labelStyle || {}) }}>{row.label(results, resultQtys)}</td>
                  {resultQtys.map((q, ci) => {
                    const value = GHS(row.get(results[q]));
                    if (!sel) return <td key={q} style={base}>{value}</td>;
                    const on = sel.isSelected(ri, ci);
                    return (
                      <td key={q} {...sel.cellProps(ri, ci)}
                        className="outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]/50"
                        style={{ ...base, cursor: "cell", userSelect: "none", ...(on ? SEL_STYLE : {}) }}>
                        {value}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sel && <CellSumBar stats={sel.stats} onCopy={sel.copySelection} onClear={sel.clear} />}
    </>
  );
}
