// Helpers for invoice lines that carry a saved print quote (offset or digital).

// The quote snapshot as Production should see it for this line. Offset spec
// sheets read the first entry of resultQtys, so put the quantity chosen on the
// invoice first.
export function snapshotForLine(li) {
  const snap = li?.quoteSnapshot;
  if (!snap) return null;
  if (li.quoteType !== "offset" || li.quoteQty == null || !Array.isArray(snap.resultQtys)) return snap;
  const chosen = Number(li.quoteQty);
  const rest   = snap.resultQtys.map(Number).filter((q) => q !== chosen);
  return { ...snap, resultQtys: [chosen, ...rest] };
}
