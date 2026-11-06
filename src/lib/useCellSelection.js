/**
 * useCellSelection.js
 * Spreadsheet-style cell selection for a table of numbers (Excel "Autosum"
 * status bar behaviour). Rows and columns are indexes; the table supplies the
 * value of each cell.
 *
 *   click            → select one cell
 *   click + drag     → select a block
 *   Shift + click    → block from the last clicked cell
 *   Ctrl/Cmd + click → add / remove one cell (drag adds a block)
 *   touch tap        → add / remove one cell (no modifier keys on phones;
 *                      a finished tap, so scrolling never selects)
 *   column header    → whole column (Shift/Ctrl add to the selection)
 *   keyboard         → arrows move, Shift+arrows extend, Space toggles,
 *                      Ctrl/Cmd+A selects all, Ctrl/Cmd+C copies, Esc clears
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const keyOf = (r, c) => `${r}:${c}`;
const parse = (k) => k.split(":").map(Number);

function toggled(set, k) {
  const n = new Set(set);
  if (n.has(k)) n.delete(k); else n.add(k);
  return n;
}

function rangeKeys(a, b) {
  const out = [];
  for (let r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) {
    for (let c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++) out.push(keyOf(r, c));
  }
  return out;
}

export function useCellSelection({ rowCount, colCount, getValue, resetKey }) {
  const [selected, setSelected] = useState(() => new Set());
  const anchor    = useRef(null);   // last clicked cell — start of Shift ranges
  const drag      = useRef(null);   // { from, base } while the pointer is held down
  const container = useRef(null);   // the table wrapper (for focus + outside clicks)
  const lastPointer = useRef("mouse");

  const clear = useCallback(() => { setSelected(new Set()); anchor.current = null; }, []);

  // New data (e.g. another month) → start fresh
  useEffect(() => { clear(); }, [resetKey, rowCount, clear]);

  // End a drag wherever the pointer is released
  useEffect(() => {
    const up = () => { drag.current = null; };
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
    return () => { window.removeEventListener("pointerup", up); window.removeEventListener("pointercancel", up); };
  }, []);

  // Clicking anywhere outside the table (or the summary bar) clears the selection
  useEffect(() => {
    if (!selected.size) return;
    const down = (e) => {
      if (container.current?.contains(e.target)) return;
      if (e.target.closest?.("[data-cell-summary]")) return;
      clear();
    };
    document.addEventListener("pointerdown", down);
    return () => document.removeEventListener("pointerdown", down);
  }, [selected.size, clear]);

  const focusCell = (r, c) => {
    container.current?.querySelector(`[data-cell="${keyOf(r, c)}"]`)?.focus();
  };

  function onPointerDown(e, r, c) {
    if (e.button !== 0) return;
    const cell = { r, c };
    const k = keyOf(r, c);
    const additive = e.ctrlKey || e.metaKey;

    // Phones: handled on click (a finished tap) so scrolling the table doesn't select
    lastPointer.current = e.pointerType;
    if (e.pointerType === "touch") return;

    e.preventDefault();               // no text highlighting while dragging
    e.currentTarget.focus();

    if (e.shiftKey && anchor.current) {
      const base = additive ? new Set(selected) : new Set();
      const next = new Set([...base, ...rangeKeys(anchor.current, cell)]);
      setSelected(next);
      drag.current = { from: anchor.current, base };
      return;
    }

    if (additive) {
      const next = new Set(selected);
      if (next.has(k)) { next.delete(k); setSelected(next); drag.current = null; anchor.current = cell; return; }
      next.add(k);
      setSelected(next);
      drag.current = { from: cell, base: new Set(selected) };
    } else {
      setSelected(new Set([k]));
      drag.current = { from: cell, base: new Set() };
    }
    anchor.current = cell;
  }

  function onClick(r, c) {
    if (lastPointer.current !== "touch") return;
    const k = keyOf(r, c);
    setSelected((prev) => toggled(prev, k));
    anchor.current = { r, c };
  }

  function onPointerEnter(r, c) {
    const d = drag.current;
    if (!d) return;
    setSelected(new Set([...d.base, ...rangeKeys(d.from, { r, c })]));
  }

  function allKeys() {
    const out = [];
    for (let r = 0; r < rowCount; r++) for (let c = 0; c < colCount; c++) out.push(keyOf(r, c));
    return out;
  }

  // Tab-separated, like copying cells out of Excel; unselected cells stay blank
  function copySelection() {
    if (!selected.size) return;
    const cells = [...selected].map(parse);
    const rows = [...new Set(cells.map(([r]) => r))].sort((a, b) => a - b);
    const cols = [...new Set(cells.map(([, c]) => c))].sort((a, b) => a - b);
    const tsv = rows
      .map((r) => cols.map((c) => (selected.has(keyOf(r, c)) && getValue(r, c) != null ? Number(getValue(r, c)).toFixed(2) : "")).join("\t"))
      .join("\n");
    navigator.clipboard?.writeText(tsv).catch(() => {});
  }

  function onKeyDown(e, r, c) {
    const mod = e.ctrlKey || e.metaKey;
    const moves = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] };

    if (moves[e.key]) {
      e.preventDefault();
      const [dr, dc] = moves[e.key];
      const nr = Math.min(rowCount - 1, Math.max(0, r + dr));
      const nc = Math.min(colCount - 1, Math.max(0, c + dc));
      if (e.shiftKey) {
        if (!anchor.current) anchor.current = { r, c };
        setSelected(new Set(rangeKeys(anchor.current, { r: nr, c: nc })));
      } else {
        anchor.current = { r: nr, c: nc };
        setSelected(new Set([keyOf(nr, nc)]));
      }
      focusCell(nr, nc);
      return;
    }
    if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      const k = keyOf(r, c);
      setSelected((prev) => toggled(prev, k));
      anchor.current = { r, c };
      return;
    }
    if (e.key === "Escape") { clear(); return; }
    if (mod && e.key.toLowerCase() === "a") { e.preventDefault(); setSelected(new Set(allKeys())); return; }
    if (mod && e.key.toLowerCase() === "c") { e.preventDefault(); copySelection(); }
  }

  // Header click: whole column. Shift/Ctrl adds it to what's already selected.
  function selectColumn(e, c) {
    const keys = Array.from({ length: rowCount }, (_, r) => keyOf(r, c));
    const additive = e.shiftKey || e.ctrlKey || e.metaKey;
    setSelected((prev) => (additive ? new Set([...prev, ...keys]) : new Set(keys)));
    anchor.current = { r: 0, c };
  }

  const isSelected = (r, c) => selected.has(keyOf(r, c));

  // Props to spread on each selectable <td>
  const cellProps = (r, c) => ({
    "data-cell": keyOf(r, c),
    tabIndex: 0,
    role: "gridcell",
    "aria-selected": selected.has(keyOf(r, c)),
    onPointerDown: (e) => onPointerDown(e, r, c),
    onPointerEnter: () => onPointerEnter(r, c),
    onClick: () => onClick(r, c),
    onKeyDown: (e) => onKeyDown(e, r, c),
  });

  const stats = useMemo(() => {
    // Blank cells (null / "") are selectable but, like Excel, don't count
    const values = [];
    for (const k of selected) {
      const [r, c] = parse(k);
      const v = getValue(r, c);
      if (v == null || v === "" || Number.isNaN(Number(v))) continue;
      values.push(Number(v));
    }
    const sum = values.reduce((s, v) => s + v, 0);
    return {
      count: values.length,
      sum,
      average: values.length ? sum / values.length : 0,
      min: values.length ? Math.min(...values) : 0,
      max: values.length ? Math.max(...values) : 0,
    };
  }, [selected, getValue]);

  return { containerRef: container, cellProps, isSelected, selectColumn, stats, clear, copySelection };
}
