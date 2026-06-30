// Draws the parent sheet as a rectangle tiled with the trim-size grid that
// fits inside it, so staff can see — not just read — how many times the
// print size enters the parent sheet.
export function PaperLayoutInfographic({ parentW, parentH, cols, rows, rotated }) {
  const boxW = 110;
  const boxH = Math.round((boxW * parentH) / parentW);
  const cellW = boxW / cols;
  const cellH = boxH / rows;

  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(
        <rect
          key={`${r}-${c}`}
          x={c * cellW + 1}
          y={r * cellH + 1}
          width={Math.max(cellW - 2, 0)}
          height={Math.max(cellH - 2, 0)}
          fill="#FDEAEA"
          stroke="#C0392B"
          strokeWidth="1"
          rx="2"
        />
      );
    }
  }

  return (
    <svg
      width={boxW}
      height={boxH}
      viewBox={`0 0 ${boxW} ${boxH}`}
      style={{ display: "block", flexShrink: 0 }}
      role="img"
      aria-label={`${cols} by ${rows} grid of the print size on the parent sheet${rotated ? ", rotated" : ""}`}
    >
      <rect x="0" y="0" width={boxW} height={boxH} fill="#fff" stroke="#2471A3" strokeWidth="1.5" rx="3" />
      {cells}
    </svg>
  );
}
