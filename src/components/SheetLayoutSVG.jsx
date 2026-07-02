/**
 * SheetLayoutSVG.jsx
 * Shows how the book's page-pairs physically occupy the parent sheet:
 * two pages sit together with NO gap (they're one spread/leaf), a gutter
 * sits between adjacent pairs (trim/cut + bleed allowance), and a margin
 * runs around the sheet edge (gripper/edge allowance). Only one side is
 * drawn — front and back carry the same footprint.
 */
export default function SheetLayoutSVG({ option, bookW: _bookW, bookH: _bookH, maxWidth = 460 }) {
  if (!option) return null;

  const { sheet, cellW, cellH, pairsAcross, rowsDown, rotated, pagesPerSide, pagesPerSheet, sheetMargin, pairGutter, wastagePct } = option;

  if (!pairsAcross || !rowsDown) {
    return (
      <p style={{ fontSize: 11, color: "#888" }}>
        The book page doesn&apos;t fit on this parent sheet once margins and gutters are applied — try a larger sheet.
      </p>
    );
  }

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
          {/* faint spine line between the two pages of the pair */}
          <line x1={x + cellPxW} y1={y} x2={x + cellPxW} y2={y + cellPxH} stroke="#E0A8A0" strokeWidth="1" />
          <text x={x + cellPxW / 2}           y={y + cellPxH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontFamily="monospace" fill="#C0392B">{a}</text>
          <text x={x + cellPxW + cellPxW / 2} y={y + cellPxH / 2} textAnchor="middle" dominantBaseline="middle" fontSize="10" fontFamily="monospace" fill="#C0392B">{b}</text>
        </g>
      );
      pageNum += 2;
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
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
