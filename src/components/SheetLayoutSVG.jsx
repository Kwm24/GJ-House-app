/**
 * SheetLayoutSVG.jsx
 * Shows how book pages physically occupy the parent sheet (one side).
 * When a custom sheet has a baseSheet set, also renders a base-sheet
 * nesting diagram showing how many parent sheets are cut from one ream sheet.
 */
export default function SheetLayoutSVG({ option, bookW: _bookW, bookH: _bookH, maxWidth = 460 }) {
  if (!option) return null;

  const {
    sheet, cellW, cellH, pairsAcross, rowsDown,
    rotated, pagesPerSide, pagesPerSheet,
    sheetMargin, pairGutter, wastagePct,
  } = option;

  const baseSheet = option.baseSheet || null;
  const parentSheetsPerBaseSheet = option.parentSheetsPerBaseSheet || 1;

  if (!pairsAcross || !rowsDown) {
    return (
      <p style={{ fontSize: 11, color: "#888" }}>
        The book page doesn&apos;t fit on this parent sheet once margins and gutters are applied — try a larger sheet.
      </p>
    );
  }

  // ── Parent sheet imposition diagram ──────────────────────────────────────────
  const pad    = 30;
  const scale  = (maxWidth - pad * 2) / sheet.w;
  const svgW   = sheet.w * scale + pad * 2;
  const svgH   = sheet.h * scale + pad * 2;

  const marginPx  = sheetMargin * scale;
  const gutterPx  = pairGutter  * scale;
  const cellPxW   = cellW * scale;
  const cellPxH   = cellH * scale;
  const pairPxW   = cellPxW * 2;

  const gridW  = pairsAcross * pairPxW   + (pairsAcross - 1) * gutterPx;
  const gridH  = rowsDown    * cellPxH   + (rowsDown    - 1) * gutterPx;

  const startX = pad + marginPx + (sheet.w * scale - 2 * marginPx - gridW) / 2;
  const startY = pad + marginPx + (sheet.h * scale - 2 * marginPx - gridH) / 2;

  const pairs = [];
  let pageNum = 1;
  for (let r = 0; r < rowsDown; r++) {
    for (let p = 0; p < pairsAcross; p++) {
      const x = startX + p * (pairPxW + gutterPx);
      const y = startY + r * (cellPxH + gutterPx);
      const a = pageNum, b = pageNum + 1;
      pairs.push(
        <g key={`${r}-${p}`}>
          <rect x={x} y={y} width={pairPxW} height={cellPxH} fill="#FFF8EF" stroke="#C0392B" strokeWidth="1.2" />
          <line x1={x + cellPxW} y1={y} x2={x + cellPxW} y2={y + cellPxH} stroke="#E0A8A0" strokeWidth="1" />
          <text x={x + cellPxW / 2}           y={y + cellPxH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontFamily="monospace" fill="#C0392B">{a}</text>
          <text x={x + cellPxW + cellPxW / 2} y={y + cellPxH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontFamily="monospace" fill="#C0392B">{b}</text>
        </g>
      );
      pageNum += 2;
    }
  }

  // ── Base sheet nesting diagram (custom sheets only) ──────────────────────────
  let baseDiagram = null;
  if (baseSheet && parentSheetsPerBaseSheet > 1) {
    const bPad   = 28;
    const bScale = (maxWidth - bPad * 2) / baseSheet.w;
    const bSvgW  = baseSheet.w * bScale + bPad * 2;
    const bSvgH  = baseSheet.h * bScale + bPad * 2;

    // Best tiling orientation: portrait vs landscape cut
    const portAcross = Math.floor(baseSheet.w / sheet.w);
    const portDown   = Math.floor(baseSheet.h / sheet.h);
    const landAcross = Math.floor(baseSheet.w / sheet.h);
    const landDown   = Math.floor(baseSheet.h / sheet.w);
    const useRot     = landAcross * landDown > portAcross * portDown;

    const tAcross = useRot ? landAcross : portAcross;
    const tDown   = useRot ? landDown   : portDown;
    const tW      = (useRot ? sheet.h   : sheet.w) * bScale;
    const tH      = (useRot ? sheet.w   : sheet.h) * bScale;

    const totalTilesW = tAcross * tW;
    const totalTilesH = tDown   * tH;
    const tStartX = bPad + (baseSheet.w * bScale - totalTilesW) / 2;
    const tStartY = bPad + (baseSheet.h * bScale - totalTilesH) / 2;

    const tiles = [];
    for (let r = 0; r < tDown; r++) {
      for (let c = 0; c < tAcross; c++) {
        const tx  = tStartX + c * tW;
        const ty  = tStartY + r * tH;
        const idx = r * tAcross + c;
        tiles.push(
          <g key={idx}>
            <rect
              x={tx} y={ty} width={tW} height={tH}
              fill={idx === 0 ? "#FFF8EF" : "#EDE7D9"}
              stroke="#C0392B" strokeWidth={idx === 0 ? 1.5 : 0.8}
            />
            <text
              x={tx + tW / 2} y={ty + tH / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize="9" fontFamily="monospace"
              fill={idx === 0 ? "#C0392B" : "#999"}
            >
              {idx + 1}
            </text>
          </g>
        );
      }
    }

    baseDiagram = (
      <div style={{ marginBottom: 16, borderBottom: "1px dashed #D4CFC8", paddingBottom: 12 }}>
        <div style={{ fontSize: 10, color: "#AAA", textAlign: "center", marginBottom: 8, letterSpacing: 0.5, textTransform: "uppercase" }}>
          Ream sheet — {parentSheetsPerBaseSheet} parent sheet{parentSheetsPerBaseSheet !== 1 ? "s" : ""} per ream sheet
        </div>
        <svg width={bSvgW} height={bSvgH} viewBox={`0 0 ${bSvgW} ${bSvgH}`} style={{ maxWidth: "100%" }}>
          <rect x={bPad} y={bPad} width={baseSheet.w * bScale} height={baseSheet.h * bScale} fill="#F5F0E8" stroke="#1C1C1E" strokeWidth="2" />
          {tiles}
          <text x={bPad + (baseSheet.w * bScale) / 2} y={bPad - 8} textAnchor="middle" fontSize="11" fontFamily="monospace" fill="#F5F0E8">
            {baseSheet.w}&quot;
          </text>
          <text
            x={bPad - 10} y={bPad + (baseSheet.h * bScale) / 2}
            textAnchor="middle" fontSize="11" fontFamily="monospace" fill="#F5F0E8"
            transform={`rotate(-90 ${bPad - 10} ${bPad + (baseSheet.h * bScale) / 2})`}
          >
            {baseSheet.h}&quot;
          </text>
        </svg>
        <div style={{ fontSize: 10, color: "#888", textAlign: "center", lineHeight: 1.6 }}>
          {tAcross}×{tDown} = {parentSheetsPerBaseSheet} cuts of {sheet.w}&quot;×{sheet.h}&quot; from one {baseSheet.w}&quot;×{baseSheet.h}&quot; sheet
          <br />
          1 ream (500 sheets) yields <b style={{ color: "#1C1C1E" }}>{(500 * parentSheetsPerBaseSheet).toLocaleString()} usable parent sheets</b>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
      {baseDiagram}
      <div style={{ fontSize: 10, color: "#AAA", textAlign: "center", letterSpacing: 0.5, textTransform: "uppercase", marginBottom: 4 }}>
        Parent sheet — page imposition (one side)
      </div>
      <svg width={svgW} height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} style={{ maxWidth: "100%" }}>
        {/* Parent sheet outline */}
        <rect x={pad} y={pad} width={sheet.w * scale} height={sheet.h * scale} fill="#F5F0E8" stroke="#1C1C1E" strokeWidth="2" />
        {/* Sheet margin guide */}
        <rect
          x={pad + marginPx} y={pad + marginPx}
          width={sheet.w * scale - 2 * marginPx} height={sheet.h * scale - 2 * marginPx}
          fill="none" stroke="#D4CFC8" strokeDasharray="4,3" strokeWidth="1"
        />
        {pairs}
        {/* Dimension labels */}
        <text x={pad + (sheet.w * scale) / 2} y={pad - 8} textAnchor="middle" fontSize="11" fontFamily="monospace" fill="#F5F0E8">{sheet.w}&quot;</text>
        <text
          x={pad - 10} y={pad + (sheet.h * scale) / 2}
          textAnchor="middle" fontSize="11" fontFamily="monospace" fill="#F5F0E8"
          transform={`rotate(-90 ${pad - 10} ${pad + (sheet.h * scale) / 2})`}
        >
          {sheet.h}&quot;
        </text>
      </svg>
      <div style={{ fontSize: 11, color: "#888", textAlign: "center", lineHeight: 1.7 }}>
        {pairsAcross} pair{pairsAcross > 1 ? "s" : ""} × {rowsDown} row{rowsDown > 1 ? "s" : ""} ={" "}
        <b style={{ color: "#1C1C1E" }}>{pagesPerSide} pages</b> this side{rotated ? " (rotated)" : ""}
        <br />
        Same layout prints on the back — <b style={{ color: "#1C1C1E" }}>{pagesPerSheet} pages per sheet</b>
        <br />
        {sheetMargin}&quot; sheet margin · {pairGutter}&quot; gutter between pairs · {wastagePct.toFixed(1)}% unused area
      </div>
    </div>
  );
}
