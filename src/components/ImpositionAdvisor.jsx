/**
 * ImpositionAdvisor.jsx
 * Ranks candidate parent sheet sizes for a given book (trim size + page
 * count + binding type) and lets the user pick one — or override with a
 * custom size. Drop-in replacement for the old static "Parent sheet"
 * <select> in PrintQuoteGH.jsx.
 */
import { useMemo, useState } from "react";
import {
  DEFAULT_PARENT_SHEET_CATALOG,
  PRINT_ORIENTATIONS,
  suggestBestParentSheet,
  evaluateSheetOption,
} from "../lib/imposition.js";
import SheetLayoutSVG from "./SheetLayoutSVG.jsx";

const GHS = (n) =>
  "GH₵ " +
  (isNaN(n) || n === null
    ? "0.00"
    : Math.abs(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));

export default function ImpositionAdvisor({
  bookW,
  bookH,
  numPages,
  colours,
  bindingType,
  qty,
  rates,
  value,                // currently selected key, or "custom"
  onSelect,             // (key) => void  |  ("custom", { w, h }) => void
  orientation = "portrait",       // "portrait" | "landscape" — book PAGE orientation on sheet
  onOrientationChange,            // (orientation) => void
  sheetOrientation = "portrait",  // "portrait" | "landscape" — the PARENT SHEET's own orientation
  onSheetOrientationChange,       // (sheetOrientation) => void
  catalog = DEFAULT_PARENT_SHEET_CATALOG,
}) {
  const [customOpen, setCustomOpen] = useState(value === "custom");
  const [customW, setCustomW] = useState(25);
  const [customH, setCustomH] = useState(38);
  const [customBaseKey, setCustomBaseKey] = useState("standard");

  const options = useMemo(
    () => suggestBestParentSheet({ bookW, bookH, numPages, colours, qty, rates, bindingType, orientation, sheetOrientation, catalog }),
    [bookW, bookH, numPages, colours, qty, rates, bindingType, orientation, sheetOrientation, catalog]
  );

  const customResult = useMemo(() => {
    if (!customOpen || !customW || !customH) return null;
    const cW = Number(customW), cH = Number(customH);
    const base = catalog[customBaseKey] || catalog.standard;
    let sheetsPerBase = 1;
    if (base && cW > 0 && cH > 0) {
      const { w: bW, h: bH } = base;
      sheetsPerBase = Math.max(1,
        Math.floor(bW / cW) * Math.floor(bH / cH),
        Math.floor(bW / cH) * Math.floor(bH / cW),
      );
    }
    const result = evaluateSheetOption({
      key: "custom",
      sheet: { w: cW, h: cH, label: `Custom (${cW}×${cH}")` },
      bookW, bookH, numPages, colours, qty, rates, bindingType, orientation, sheetOrientation,
    });
    if (!result) return null;
    // Correct ream count for base-sheet multiplier (more parent sheets per ream)
    const correctedReams    = Math.ceil(result.withWastage / (500 * sheetsPerBase));
    const correctedPaperCost = correctedReams * (rates.paperRate || 0);
    const correctedTotal    = result.plateCost + correctedPaperCost + result.impressionCost;
    return {
      ...result,
      reamsNeeded: correctedReams,
      paperCost:   correctedPaperCost,
      totalCost:   correctedTotal,
      costPerCopy: qty > 0 ? correctedTotal / qty : 0,
      baseSheet:   base,
      parentSheetsPerBaseSheet: sheetsPerBase,
    };
  }, [customOpen, customW, customH, customBaseKey, bookW, bookH, numPages, colours, qty, rates, bindingType, orientation, sheetOrientation, catalog]);

  if (!bookW || !bookH || !numPages) {
    return <p style={S.hint}>Enter book size and page count to see parent sheet suggestions.</p>;
  }

  const diagramOption =
    value === "custom" ? customResult : options.find((o) => o.key === value) || options[0];

  return (
    <div>
      {/* Orientation toggles */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <label style={S.lbl}>Print orientation</label>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(PRINT_ORIENTATIONS).map(([key, o]) => (
            <button key={key} type="button" onClick={() => onOrientationChange && onOrientationChange(key)} style={S.orientBtn(orientation === key)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <label style={S.lbl}>Parent sheet orientation</label>
        <div style={{ display: "flex", gap: 6 }}>
          {Object.entries(PRINT_ORIENTATIONS).map(([key, o]) => (
            <button key={key} type="button" onClick={() => onSheetOrientationChange && onSheetOrientationChange(key)} style={S.orientBtn(sheetOrientation === key)}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ranked sheet list */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <label style={S.lbl}>Parent sheet</label>
        <span style={{ fontSize: 10, color: "#999" }}>Ranked by cost for {qty?.toLocaleString()} copies</span>
      </div>
      <div style={{ fontSize: 10, color: "#AAA", marginBottom: 8 }}>
        Using current rate settings: plate {GHS(rates.plateRate)} · paper {GHS(rates.paperRate)}/ream · impression{" "}
        {GHS(rates.impressionRate)} — edit these in Rate Settings below, this list updates automatically.
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {options.map((opt, i) => {
          const isSelected = value === opt.key;
          const isBest = i === 0;
          return (
            <div
              key={opt.key}
              onClick={() => onSelect(opt.key)}
              style={{
                border: "1.5px solid " + (isSelected ? "#C0392B" : "#D4CFC8"),
                background: isSelected ? "#FAE8E6" : "#fff",
                borderRadius: 8,
                padding: "10px 14px",
                cursor: "pointer",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 10,
              }}
            >
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1E" }}>
                  {opt.sheet.label}
                  {isBest && <span style={S.pill("#27AE60")}>Recommended</span>}
                  {opt.rotated && <span style={S.pill("#888")}>page: landscape</span>}
                  {opt.sheetOrientation === "landscape" && <span style={S.pill("#5A6B8C")}>sheet: landscape</span>}
                </div>
                <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  {opt.pagesPerSide} pages/side · {opt.pagesPerSheet} pages/sheet · {opt.forms} forms · {opt.numPlates} plates ·{" "}
                  {opt.reamsNeeded} reams · {opt.wastagePct.toFixed(0)}% trim waste
                </div>
                {opt.warning && <div style={{ fontSize: 11, color: "#C0392B", marginTop: 2 }}>⚠ {opt.warning}</div>}
              </div>
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#1C1C1E" }}>{GHS(opt.totalCost)}</div>
                <div style={{ fontSize: 10, color: "#999" }}>{GHS(opt.costPerCopy)}/copy</div>
              </div>
            </div>
          );
        })}

        {/* Custom sheet size */}
        <div style={{ border: "1.5px dashed #D4CFC8", borderRadius: 8, padding: "10px 14px" }}>
          <div
            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
            onClick={() => setCustomOpen((o) => !o)}
          >
            <span style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>+ Try a custom sheet size</span>
            <span style={{ fontSize: 11, color: "#999" }}>{customOpen ? "▲" : "▼"}</span>
          </div>
          {customOpen && (
            <div style={{ marginTop: 10 }}>
              <div style={{ display: "flex", gap: 10 }}>
                <input type="number" step="0.1" value={customW} onChange={(e) => setCustomW(e.target.value)} placeholder='Width (in)' style={S.inp} />
                <input type="number" step="0.1" value={customH} onChange={(e) => setCustomH(e.target.value)} placeholder='Height (in)' style={S.inp} />
              </div>
              <div style={{ marginTop: 8 }}>
                <label style={{ ...S.lbl, marginBottom: 4 }}>Base ream sheet (custom sheet is cut from this)</label>
                <select
                  value={customBaseKey}
                  onChange={(e) => setCustomBaseKey(e.target.value)}
                  style={{ ...S.inp, padding: "6px 10px", fontSize: 12 }}
                >
                  {Object.entries(catalog).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
                {customResult?.parentSheetsPerBaseSheet > 1 && (
                  <p style={{ ...S.hint, marginTop: 4 }}>
                    {customResult.parentSheetsPerBaseSheet} custom sheets cut per{" "}
                    {catalog[customBaseKey]?.w}×{catalog[customBaseKey]?.h}" ream sheet
                    → 1 ream = {(500 * customResult.parentSheetsPerBaseSheet).toLocaleString()} usable parent sheets
                  </p>
                )}
              </div>
              {customResult && (
                <div
                  onClick={() => onSelect("custom", {
                    w: Number(customW),
                    h: Number(customH),
                    baseSheet: customBaseKey,
                    sheetsPerBase: customResult.parentSheetsPerBaseSheet,
                  })}
                  style={{
                    marginTop: 10,
                    cursor: "pointer",
                    border: "1.5px solid " + (value === "custom" ? "#C0392B" : "#D4CFC8"),
                    background: value === "custom" ? "#FAE8E6" : "#fff",
                    borderRadius: 8,
                    padding: "10px 14px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div style={{ fontSize: 11, color: "#888" }}>
                    {customResult.pagesPerSide} pages/side · {customResult.forms} forms · {customResult.numPlates} plates ·{" "}
                    {customResult.wastagePct.toFixed(0)}% waste
                    {customResult.parentSheetsPerBaseSheet > 1 && (
                      <span style={{ marginLeft: 6, color: "#27AE60" }}>
                        · {customResult.reamsNeeded} reams (×{customResult.parentSheetsPerBaseSheet})
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{GHS(customResult.totalCost)}</div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Visual layout diagram for the currently selected sheet */}
      {diagramOption && (
        <div style={{ marginTop: 14, background: "#fff", border: "1.5px solid #E5DFD5", borderRadius: 8, padding: 16 }}>
          <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#888", marginBottom: 10, textAlign: "center" }}>
            Paper layout — how pages sit on the sheet
          </div>
          <SheetLayoutSVG option={diagramOption} bookW={bookW} bookH={bookH} />
        </div>
      )}
    </div>
  );
}

const S = {
  lbl: { fontSize: 11, color: "#666", fontWeight: 500 },
  hint: { fontSize: 11, color: "#888", fontStyle: "italic" },
  inp: {
    flex: 1,
    padding: "8px 10px",
    borderRadius: 7,
    border: "1.5px solid #D4CFC8",
    background: "#fff",
    fontSize: 13,
    color: "#1C1C1E",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  pill: (bg) => ({
    display: "inline-block",
    background: bg || "#555",
    color: "#fff",
    borderRadius: 10,
    padding: "1px 7px",
    fontSize: 9,
    marginLeft: 6,
    verticalAlign: "middle",
  }),
  orientBtn: (active) => ({
    fontSize: 11,
    padding: "5px 12px",
    borderRadius: 6,
    border: "1.5px solid " + (active ? "#C0392B" : "#D4CFC8"),
    background: active ? "#C0392B" : "#fff",
    color: active ? "#fff" : "#1C1C1E",
    cursor: "pointer",
    fontFamily: "inherit",
    fontWeight: active ? 600 : 400,
  }),
};
