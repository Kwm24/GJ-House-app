/**
 * imposition.js
 * Book Imposition Advisor
 *
 * Works backward: given a finished book's trim size + page count + binding
 * type, works out how many book pages fit per parent-sheet side, then ranks
 * candidate parent sheet sizes by the resulting plate + paper cost — so the
 * PARENT SHEET becomes the output of the calculation, not an input the user
 * has to guess.
 *
 * Flow: trim size + page count + binding →
 *       pages-per-signature → forms needed → cost per candidate sheet → best pick
 */

// ─── DEFAULT PARENT SHEET CATALOG (inches) ───────────────────────────────────
// Standard offset "parent" sheet sizes used by presses in Ghana / West Africa.
export const DEFAULT_PARENT_SHEET_CATALOG = {
  standard: { w: 30,   h: 40,   label: 'Standard (30×40")' },
  nigeria:  { w: 24,   h: 30,   label: 'Nigeria (24×30")' },
  sra1:     { w: 25.2, h: 35.4, label: 'SRA1 (25.2×35.4")' },
  quarto:   { w: 25,   h: 38,   label: 'Quarto (25×38")' },
  demy:     { w: 22.5, h: 35,   label: 'Demy (22.5×35")' },
};

// ─── BINDING ADVISORY RULES ──────────────────────────────────────────────────
// Rough practical guidance surfaced as a warning — not a hard limit.
export const BINDING_ADVICE = {
  saddle_stitch: {
    maxRecommendedForms: 3,
    note: "Saddle stitch nests sections inside each other — best for booklets that resolve to a small number of forms.",
  },
  perfect: { maxRecommendedForms: null, note: "Perfect binding glues separate sections at the spine — handles higher page counts well." },
  spiral:  { maxRecommendedForms: null, note: null },
  case:    { maxRecommendedForms: null, note: null },
  thermal: { maxRecommendedForms: null, note: null },
  sewn:    { maxRecommendedForms: null, note: null },
};

// ─── LAYOUT SETTINGS ─────────────────────────────────────────────────────────
// sheetMargin = edge/gripper margin around the printable area.
// pairGutter  = gap between booklet PAIRS (trim/cut allowance + bleed).
//               There is deliberately NO gap between the two pages within
//               a pair, since they sit together as one spread/leaf.
export const DEFAULT_LAYOUT_SETTINGS = {
  sheetMargin: 0.5,
  pairGutter:  0.25,
};

// ─── PRINT ORIENTATIONS ──────────────────────────────────────────────────────
// Two INDEPENDENT orientation choices:
//   "orientation"      — how the book PAGE sits when fitted onto the sheet
//   "sheetOrientation" — how the PARENT SHEET itself is fed (its own w×h)
export const PRINT_ORIENTATIONS = {
  portrait:  { label: "Portrait" },
  landscape: { label: "Landscape (rotated 90°)" },
};

// Swaps a sheet's own w/h when sheetOrientation === "landscape".
export function resolveSheetDims(sheet, sheetOrientation = "portrait") {
  if (!sheet) return null;
  if (sheetOrientation === "landscape") {
    return { w: sheet.h, h: sheet.w, label: sheet.label };
  }
  return { w: sheet.w, h: sheet.h, label: sheet.label };
}

// ─── CORE FIT CALCULATION ────────────────────────────────────────────────────
// How many book pages fit on one side of a parent sheet, arranged as pairs
// (2 pages side by side, no internal gap) with a gutter between pairs and a
// margin around the sheet edge.
// pagesPerSheet = pagesPerSide × 2 (front + back).
export function fitOnSheet(bookW, bookH, parentW, parentH, layoutSettings = DEFAULT_LAYOUT_SETTINGS, orientation = "portrait") {
  if (!bookW || !bookH || bookW <= 0 || bookH <= 0 || !parentW || !parentH) return null;

  const { sheetMargin, pairGutter } = layoutSettings || DEFAULT_LAYOUT_SETTINGS;
  const usableW = parentW - 2 * sheetMargin;
  const usableH = parentH - 2 * sheetMargin;
  if (usableW <= 0 || usableH <= 0) return null;

  // "Portrait" uses the print size exactly as entered (bookW × bookH).
  // "Landscape" rotates it 90° for fitting purposes only.
  const pageW = orientation === "landscape" ? bookH : bookW;
  const pageH = orientation === "landscape" ? bookW : bookH;

  const pairW = pageW * 2; // two pages side by side, no gap between them
  const pairsAcross = Math.max(0, Math.floor((usableW + pairGutter) / (pairW + pairGutter)));
  const rowsDown    = Math.max(0, Math.floor((usableH + pairGutter) / (pageH + pairGutter)));
  const pagesPerSide = pairsAcross * 2 * rowsDown;

  if (pagesPerSide < 2) return null; // needs at least one full pair

  return {
    pagesPerSide,
    pagesPerSheet: pagesPerSide * 2,
    orientation,
    rotated: orientation === "landscape",
    pairsAcross,
    rowsDown,
    cellW: pageW,
    cellH: pageH,
    sheetMargin,
    pairGutter,
  };
}

// ─── EVALUATE ONE CANDIDATE PARENT SHEET ─────────────────────────────────────
// Mirrors PrintQuoteGH's calcPaper/calcQuote math exactly, so numbers line up
// once a sheet is chosen and fed back into the main quote.
export function evaluateSheetOption({
  key, sheet, bookW, bookH, numPages, colours, qty, rates, bindingType,
  orientation = "portrait", sheetOrientation = "portrait",
}) {
  const effSheet = resolveSheetDims(sheet, sheetOrientation);
  const fit = fitOnSheet(bookW, bookH, effSheet.w, effSheet.h, DEFAULT_LAYOUT_SETTINGS, orientation);
  if (!fit) return null;

  const forms       = Math.ceil(numPages / fit.pagesPerSheet);
  const numPlates   = forms * 2 * Number(colours);

  const totalSheets = forms * qty;
  const withWastage = Math.ceil(totalSheets * 1.05);
  const reamsNeeded = Math.ceil(withWastage / 500);

  const plateCost      = numPlates  * (rates.plateRate      || 0);
  const paperCost      = reamsNeeded * (rates.paperRate      || 0);
  const impressionCost = numPlates  * (rates.impressionRate || 0);
  const totalCost      = plateCost + paperCost + impressionCost;

  const usedArea   = fit.pagesPerSide * bookW * bookH;
  const sheetArea  = effSheet.w * effSheet.h;
  const wastagePct = sheetArea > 0 ? Math.max(0, 1 - usedArea / sheetArea) * 100 : 0;

  const advice = BINDING_ADVICE[bindingType];
  const warning =
    advice?.maxRecommendedForms && forms > advice.maxRecommendedForms
      ? `${forms} forms may be a lot for ${bindingType.replace("_", " ")} — consider perfect binding, or a larger parent sheet.`
      : null;

  return {
    key,
    sheet: effSheet,
    sheetOrientation,
    ...fit,
    forms,
    numPlates,
    totalSheets,
    withWastage,
    reamsNeeded,
    plateCost,
    paperCost,
    impressionCost,
    totalCost,
    costPerCopy: qty > 0 ? totalCost / qty : 0,
    wastagePct,
    warning,
  };
}

// ─── RANK ALL CANDIDATE PARENT SHEETS ────────────────────────────────────────
// Cheapest total (plates + paper + impressions) first, wastage% as tiebreaker.
export function suggestBestParentSheet({
  bookW, bookH, numPages, colours, qty, rates, bindingType,
  orientation = "portrait", sheetOrientation = "portrait",
  catalog = DEFAULT_PARENT_SHEET_CATALOG,
}) {
  if (!bookW || !bookH || !numPages || bookW <= 0 || bookH <= 0 || numPages <= 0) return [];

  const options = Object.entries(catalog)
    .map(([key, sheet]) => evaluateSheetOption({
      key, sheet, bookW, bookH, numPages, colours, qty, rates, bindingType, orientation, sheetOrientation,
    }))
    .filter(Boolean);

  options.sort((a, b) => a.totalCost - b.totalCost || a.wastagePct - b.wastagePct);
  return options;
}
