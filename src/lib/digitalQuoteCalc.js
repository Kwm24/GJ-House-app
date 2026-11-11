/**
 * digitalQuoteCalc.js
 * The Digital quoter's pricing maths, shared by the quoter itself and by the
 * Accounts cost breakdown (which re-runs it on a saved quote's job + rates so
 * it shows exactly what the quoter showed).
 */
import { DIGITAL_SHEET_NAMES, DIGITAL_SIZES, LAMINATION_NONE, laminationCost, isUnitJob, unitItems, hasPrintSides, printSidesLabel, unitItemCost } from "./digitalPrintSpecs.js";
import { UNIT_TO_M } from "./units.js";
import { formatGHS as GHS } from "./currency.js";

function fitOnSheet(W, H, w, h, g) {
  const attempt = (a, b, rotated) => {
    const c = Math.floor((W + g) / (a + g));
    const n = Math.floor((H + g) / (b + g));
    return (c > 0 && n > 0) ? { c, n, rotated, up: c * n, a, b } : { up: 0 };
  };
  const normal  = attempt(w, h, false);
  const rotated = attempt(h, w, true);
  return rotated.up > normal.up ? rotated : normal;
}

export function calcComparison(w, h, pieces, duplex, stock, rates) {
  const results = {};
  for (const name of DIGITAL_SHEET_NAMES) {
    const S = rates.sheets[name];
    if (!S) { results[name] = { name, up: 0 }; continue; }
    const f = fitOnSheet(S.w - 2 * rates.margin, S.h - 2 * rates.margin, w, h, rates.gutter);
    if (!f.up) { results[name] = { name, up: 0 }; continue; }
    const base      = Math.ceil(pieces / f.up);
    // Cap wasteFixed at base so small-run jobs aren't inflated (e.g. 1 cover → 7 sheets)
    const sheets    = base + Math.ceil(base * rates.wastePct / 100) + Math.min(rates.wasteFixed, base);
    const printCost = duplex ? S.p2 : S.p1;
    const paperCost = (rates.stocks[stock] || {})[name] || 0;
    const perSheet  = printCost + paperCost;
    results[name] = { name, f, up: f.up, sheets, perSheet, cost: sheets * perSheet };
  }
  return results;
}

export function cheapest(results) {
  const valid = Object.values(results).filter((r) => r.up > 0);
  return valid.length ? valid.reduce((a, b) => b.cost < a.cost ? b : a) : null;
}

/**
 * Everything the Digital quoter derives from the job form.
 * `pickedSheet` is the sheet the user tapped (null = cheapest).
 */
export function computeDigitalQuote(job, rates, pickedSheet = null) {
  const {
    jobType, sizeKey, customW, customH, qty, stock, duplex, extra = 0,
    pages, bindType, spine, coverStock, covDuplex,
    lamination = LAMINATION_NONE, lfWidth, lfHeight, lfUnit, lfMat,
    unitItem, unitCost: savedUnitCost, printSides = 'front',
  } = job;

  const isUnit = isUnitJob(jobType);
  const isLF   = jobType === 'banner' || jobType === 'sticker';
  const isBook = jobType === 'book';
  const isFold = jobType === 'brochure' || jobType === 'trifold';

  const dims = sizeKey === 'Custom' ? [customW || 0, customH || 0] : (DIGITAL_SIZES[sizeKey] || [210, 297]);

  let normPages = 1;
  if (isBook) normPages = bindType === 'Saddle stitch' ? Math.ceil(pages / 4) * 4 : Math.ceil(pages / 2) * 2;
  const leavesPerCopy = duplex ? Math.ceil(normPages / 2) : normPages;

  const comparison   = (isLF || isUnit) ? {} : calcComparison(dims[0], dims[1], qty * leavesPerCopy, duplex, stock, rates);
  const bestSheet    = cheapest(comparison);
  const pickedRaw    = pickedSheet ? comparison[pickedSheet] : null;
  const pickedResult = pickedRaw && pickedRaw.up > 0 ? pickedRaw : bestSheet;

  const spineW          = bindType === 'Perfect bound' ? (spine || 0) : 0;
  const coverComparison = isBook ? calcComparison(2 * dims[0] + spineW, dims[1], qty, covDuplex, coverStock, rates) : {};
  const bestCover       = cheapest(coverComparison);

  const lfMaterials = Object.keys(rates.lf?.[jobType] || {});
  const activeMat   = lfMat || lfMaterials[0] || '';

  let lfQuote = null;
  if (isLF) {
    const rate     = (rates.lf?.[jobType] || {})[activeMat] || 0;
    const sq       = rates.areaUnit === 'sqft';
    const toM      = UNIT_TO_M[lfUnit] || 1;
    const areaSqM  = (lfWidth * toM) * (lfHeight * toM);
    const area     = sq ? areaSqM * 10.7639 : areaSqM;
    const rawCost  = area * rate;
    const perPiece = Math.max(rates.lfMin, rawCost);
    const fin      = jobType === 'banner' ? rates.bannerFin : rates.stickerCut;
    const rows     = [{ label: `${activeMat}: ${lfWidth}${lfUnit} × ${lfHeight}${lfUnit} = ${area.toFixed(2)} ${sq ? 'sq ft' : 'm²'} × ${GHS(rate)}${rawCost < rates.lfMin ? ' (min charge)' : ''} × ${qty}`, amount: perPiece * qty }];
    if (fin) rows.push({ label: `${jobType === 'banner' ? 'Hem & eyelets' : 'Cutting'} (${qty} × ${GHS(fin)})`, amount: fin * qty });
    if (extra) rows.push({ label: `Extras (${qty} × ${GHS(extra)})`, amount: qty * extra });
    if (rates.setup) rows.push({ label: 'Setup fee', amount: rates.setup });
    const cost = rows.reduce((s, r) => s + r.amount, 0);
    const sell = cost * (1 + rates.lfMarkup / 100);
    lfQuote = { rows, cost, sell, area: area.toFixed(2), unit: sq ? 'sq ft' : 'm²', rate };
  }

  // Per-piece products (roll-ups, T-shirts, souvenirs): unit cost × quantity.
  // If the item has since been renamed/removed, use the cost saved with the job.
  const items      = isUnit ? unitItems(rates, jobType) : [];
  const activeItem = isUnit ? (items.find((i) => i.name === unitItem) || (unitItem ? null : items[0]) || null) : null;
  let unitQuote = null;
  if (isUnit) {
    const name  = activeItem?.name || unitItem || '';
    // Only quotes that recorded a print position show it (older ones named it in the item)
    const sides = hasPrintSides(jobType) && job.printSides ? printSides : null;
    // savedUnitCost already includes the back print (it's the per-piece cost quoted)
    const unitC = activeItem ? unitItemCost(activeItem, jobType, printSides) : (Number(savedUnitCost) || 0);
    if (name && unitC > 0) {
      const what = sides ? `${name}, ${printSidesLabel(sides)}` : name;
      const rows = [{ label: `${what} (${qty} × ${GHS(unitC)})`, amount: unitC * qty }];
      if (extra) rows.push({ label: `Extras (${qty} × ${GHS(extra)})`, amount: qty * extra });
      const cost   = rows.reduce((s, r) => s + r.amount, 0);
      const markup = rates.unitMarkup ?? rates.markup ?? 0;
      unitQuote = { rows, cost, sell: cost * (1 + markup / 100), markup, item: name, unitCost: unitC, printSides: sides };
    }
  }

  const quoteRows = [];
  if (!isLF && !isUnit && pickedResult) {
    quoteRows.push({ label: isBook ? `Inside pages (${normPages} pp, ${duplex ? 'double' : 'single'}-sided, ${pickedResult.name})` : `Printing (${duplex ? 'double' : 'single'}-sided, ${pickedResult.name})`, amount: pickedResult.cost });
    if (isBook && bestCover) quoteRows.push({ label: `Cover (${covDuplex ? 'double' : 'single'}-sided, ${bestCover.name})`, amount: bestCover.cost });
    if (lamination !== LAMINATION_NONE) {
      // Booklets: laminate the cover's outside face only; other jobs: every printed side
      const lamSheet = isBook ? bestCover : pickedResult;
      const lamSides = isBook ? 1 : (duplex ? 2 : 1);
      const lamAmt   = lamSheet ? laminationCost(lamination, lamSheet.name, lamSheet.sheets, lamSides, rates) : 0;
      if (lamAmt) quoteRows.push({
        label: `${isBook ? 'Cover lamination' : 'Lamination'}: ${lamination} (${lamSheet.sheets} sheets × ${lamSides} side${lamSides > 1 ? 's' : ''}, ${lamSheet.name})`,
        amount: lamAmt,
      });
    }
    if (isFold) quoteRows.push({ label: `Folding (${qty} × ${GHS(rates.fold)})`, amount: qty * rates.fold });
    const bindRate = rates.bind?.[bindType] || 0;
    if (isBook && bindRate) quoteRows.push({ label: `${bindType} (${qty} × ${GHS(bindRate)})`, amount: qty * bindRate });
    if (extra) quoteRows.push({ label: `Extras (${qty} × ${GHS(extra)})`, amount: qty * extra });
    if (rates.setup) quoteRows.push({ label: 'Setup fee', amount: rates.setup });
  }

  const totalCost = quoteRows.reduce((s, r) => s + r.amount, 0);
  const sellPrice = totalCost * (1 + rates.markup / 100);

  return {
    isUnit, unitItems: items, activeItem, unitQuote,
    isLF, isBook, isFold, dims, normPages, leavesPerCopy,
    comparison, bestSheet, pickedResult, coverComparison, bestCover,
    lfMaterials, activeMat, lfQuote, quoteRows, totalCost, sellPrice,
  };
}

/**
 * Autosum cell map for DigitalQuoteResults: every amount the quoter shows gets
 * a [row, col] — sheet comparison (Cost, Per copy), cover comparison (Cost),
 * then the total price. `values[r][c]` is what the selection adds up.
 */
export function digitalResultCells(calc, qty) {
  const values = [];
  const sheet = {}, cover = {};
  if (!calc.isLF && !calc.isUnit) {
    for (const name of DIGITAL_SHEET_NAMES) {
      const r = calc.comparison[name];
      if (!r || !r.up) continue;
      sheet[name] = values.length;
      values.push([r.cost, r.cost / qty]);
    }
  }
  if (calc.isBook) {
    for (const name of DIGITAL_SHEET_NAMES) {
      const r = calc.coverComparison[name];
      if (!r || !r.up) continue;
      cover[name] = values.length;
      values.push([r.cost, null]);
    }
  }
  let total = null;
  const price = calc.isUnit ? calc.unitQuote?.sell
    : calc.isLF ? calc.lfQuote?.sell : (calc.pickedResult ? calc.sellPrice : null);
  if (price != null) { total = values.length; values.push([price, null]); }
  return { values, sheet, cover, total };
}
