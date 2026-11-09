/**
 * InstantQuoter.jsx
 * "Live Quote": customer-facing digital print price calculator.
 * Shows total price and per-unit price. No profit breakdown, no save button.
 * Used on the Landing Page and Customer Portal.
 */

import { useState, useMemo, useEffect } from "react";
import { getSettings } from "../lib/settings.js";
import {
  DEFAULT_DIGITAL_RATES, DIGITAL_STOCK_NAMES, DIGITAL_SHEET_NAMES,
  LAMINATION_NONE, laminationOptions, laminationCost,
  DIGITAL_SIZES, digitalSizeLabel,
  isUnitJob, unitItems, unitThumbKey, mergeDigitalRates,
} from "../lib/digitalPrintSpecs.js";
import { UNIT_TO_M, UNIT_KEYS, convertLength, fmtDims } from "../lib/units.js";
import { DimensionInput, UnitSelect } from "./DimensionInput.jsx";
import { Info, ChevronDown, ChevronRight } from "lucide-react";

// ── Constants ──────────────────────────────────────────────────────────────────
const SIZES = DIGITAL_SIZES;   // finished-size presets (mm)

const JOB_PRESETS = {
  flyer:   { size: 'A5 (148×210)',          duplex: false, qty: 500  },
  card:    { size: 'Business card (90×55)', duplex: false, qty: 1000 },
  brochure:{ size: 'A3 flat (420×297)',     duplex: true,  qty: 500  },
  trifold: { size: 'A4 flat (297×210)',     duplex: true,  qty: 500  },
  book:    { size: 'A5 (148×210)',          duplex: true,  qty: 100  },
  banner:  { size: 'Custom',                duplex: false, qty: 1    },
  sticker: { size: 'Custom',                duplex: false, qty: 100  },
  rollup:  { size: 'Custom',                duplex: false, qty: 1    },
  tshirt:  { size: 'Custom',                duplex: false, qty: 20   },
  souvenir:{ size: 'Custom',                duplex: false, qty: 50   },
  custom:  { size: 'A4 (210×297)',          duplex: false, qty: 500  },
};

const JOB_TYPES = [
  { value: 'flyer',    label: 'Flyer / Leaflet / Poster' },
  { value: 'card',     label: 'Business Card' },
  { value: 'trifold',  label: 'Trifold Brochure' },
  { value: 'book',     label: 'Booklet / Book with cover' },
  { value: 'banner',   label: 'Banner' },
  { value: 'rollup',   label: 'Roll-up Banner' },
  { value: 'sticker',  label: 'Sticker / Label' },
  { value: 'tshirt',   label: 'T-shirt Printing' },
  { value: 'souvenir', label: 'Souvenirs: mugs, cups, pens & more' },
  { value: 'custom',   label: 'Other / Custom size' },
];


const GHS = (n) =>
  "GH₵ " + Number(n || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ── Imposition helpers (same logic as DigitalPrintQuoteGH) ────────────────────
function fitOnSheet(W, H, w, h, g) {
  const attempt = (a, b) => {
    const c = Math.floor((W + g) / (a + g));
    const n = Math.floor((H + g) / (b + g));
    return (c > 0 && n > 0) ? { c, n, up: c * n } : { up: 0 };
  };
  const normal  = attempt(w, h);
  const rotated = attempt(h, w);
  return rotated.up > normal.up ? rotated : normal;
}

function cheapestSheet(w, h, pieces, duplex, stock, rates) {
  let best = null;
  for (const name of DIGITAL_SHEET_NAMES) {
    const S = rates.sheets[name];
    if (!S) continue;
    const f = fitOnSheet(S.w - 2 * rates.margin, S.h - 2 * rates.margin, w, h, rates.gutter);
    if (!f.up) continue;
    const base      = Math.ceil(pieces / f.up);
    // Cap wasteFixed at base so small-run jobs aren't inflated (e.g. 1 cover → 7 sheets)
    const sheets    = base + Math.ceil(base * rates.wastePct / 100) + Math.min(rates.wasteFixed, base);
    const printCost = duplex ? S.p2 : S.p1;
    const paperCost = (rates.stocks[stock] || {})[name] || 0;
    const cost = sheets * (printCost + paperCost);
    if (!best || cost < best.cost) best = { name, f, sheets, cost };
  }
  return best;
}

// ── Build a WhatsApp-ready order summary from a result snapshot ───────────────
export function buildInstantQuoteSummary({ jobType, jobLabel, size, qty, paper, duplex, pages, bindType, coverStock, covDuplex, lamination, area, areaUnit, mat, unitItem, total, perUnit }) {
  const GHSfmt = (n) => "GH₵ " + Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (unitItem) {
    return [
      "Hi, I'd like to place an order:",
      "",
      `Product: ${jobLabel}`,
      `Item: ${unitItem}`,
      `Quantity: ${qty.toLocaleString()} piece(s)`,
      "",
      `Estimated total: ${GHSfmt(total)}`,
      `Per piece: ${GHSfmt(perUnit)}`,
      "",
      "I'll send my logo / design. Please confirm and help me finalise my order. Thank you!",
    ].join("\n");
  }
  const isLarge = !!area;
  const lines = [
    "Hi, I'd like to place an order for a digital print job:",
    "",
    `Job type: ${jobLabel}`,
    `Size: ${size}`,
    `Quantity: ${qty.toLocaleString()} ${isLarge ? "piece(s)" : "copies"}`,
  ];
  if (!isLarge) {
    lines.push(`Paper: ${paper}`);
    lines.push(`Printing: ${duplex ? "Double-sided" : "Single-sided"}`);
  }
  if (pages) lines.push(`Pages: ${pages}`);
  if (bindType) lines.push(`Binding: ${bindType}`);
  if (coverStock) lines.push(`Cover: ${coverStock}, ${covDuplex ? "printed inside and outside" : "printed outside only"}`);
  if (lamination && lamination !== LAMINATION_NONE) {
    lines.push(`Lamination: ${lamination}${jobType === "book" ? " (cover)" : ""}`);
  }
  if (area) lines.push(`Area: ${area} ${areaUnit} · Material: ${mat}`);
  lines.push("", `Estimated total: ${GHSfmt(total)}`, `Per ${isLarge ? "piece" : "copy"}: ${GHSfmt(perUnit)}`, "", "Please confirm and help me finalise my order. Thank you!");
  return lines.join("\n");
}

// Plain-language feel for a paper / material weight, read from its gsm
// ("130gsm Gloss" → 130). Customers rarely know what grammage means.
function paperFeel(name) {
  const gsm = parseInt(String(name).match(/(\d+)\s*gsm/i)?.[1], 10);
  if (!gsm) return null;
  if (gsm < 100) return { short: 'thin',       feel: 'Like office paper.' };
  if (gsm < 150) return { short: 'medium',      feel: 'Like a magazine page.' };
  if (gsm < 200) return { short: 'thick',       feel: 'Like a quality brochure.' };
  if (gsm < 270) return { short: 'card',        feel: 'Like a postcard.' };
  if (gsm < 400) return { short: 'stiff card',  feel: 'Like a business card.' };
  return { short: 'heavy duty', feel: 'Heavy duty, lasts longer outdoors.' };
}

const paperOption = (s) => { const f = paperFeel(s); return f ? `${s} (${f.short})` : s; };

// Standard paper sizes for sticker presets (width × height in mm)
const STICKER_SIZE_PRESETS = [
  { label: 'A4',  w: 210, h: 297 },
  { label: 'A3',  w: 297, h: 420 },
  { label: 'A2',  w: 420, h: 594 },
  { label: 'A1',  w: 594, h: 841 },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function InstantQuoter({ accentHex = "#C0392B", onResult, whatsappNumber = "" }) {
  const accent = accentHex;
  const waDigits = String(whatsappNumber || "").replace(/[^0-9]/g, "");
  const waLink = waDigits
    ? `https://wa.me/${waDigits}?text=${encodeURIComponent("Hi, I'd like a quote for an offset / large-quantity print job.")}`
    : null;

  const [rates,             setRates]             = useState(DEFAULT_DIGITAL_RATES);
  const [quoterThumbnails,  setQuoterThumbnails]  = useState({});

  const [jobType, setJobTypeRaw] = useState('flyer');
  const [sizeKey, setSizeKey]    = useState(JOB_PRESETS.flyer.size);
  const [customW, setCustomW]    = useState(100);
  const [customH, setCustomH]    = useState(150);
  // Unit sizes are shown/typed in (sizes are still stored + priced in mm)
  const [dimUnit, setDimUnit]    = useState('mm');
  const [qty,     setQty]        = useState(500);
  const [stock,   setStock]      = useState('130gsm Gloss');
  const [duplex,  setDuplex]     = useState(false);

  // Book extras
  const [pages,    setPages]    = useState(24);
  const [bindType, setBindType] = useState('Saddle stitch');
  const [spine,    setSpine]    = useState(3);
  const [coverStock, setCoverStock] = useState('250gsm Card');
  const [covDuplex,  setCovDuplex]  = useState(false);

  // Lamination (not offered for banners / stickers)
  const [lamination, setLamination] = useState(LAMINATION_NONE);

  // LF
  const [lfWidth,  setLfWidth]  = useState(6);
  const [lfHeight, setLfHeight] = useState(3);
  const [lfUnit,   setLfUnit]   = useState('ft');
  const [lfMat,    setLfMat]    = useState('');

  // Per-piece products (roll-up banners, T-shirts, souvenirs)
  const [unitItem, setUnitItem] = useState('');

  // Changing the banner/sticker unit converts the typed size (20cm → 0.2m)
  function changeLfUnit(next) {
    setLfWidth((w) => convertLength(w, lfUnit, next));
    setLfHeight((h) => convertLength(h, lfUnit, next));
    setLfUnit(next);
  }

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s?.digital_quote_rates)       setRates((r) => mergeDigitalRates(s.digital_quote_rates, r));
        if (s?.instant_quoter_thumbnails) setQuoterThumbnails(s.instant_quoter_thumbnails);
      })
      .catch(() => {});
  }, []);

  function setJobType(type) {
    const pre = JOB_PRESETS[type];
    setJobTypeRaw(type);
    setSizeKey(pre.size);
    setDuplex(pre.duplex);
    setQty(pre.qty);
    setUnitItem('');
    if (type === 'banner') { setLfWidth(6); setLfUnit('ft'); }
    if (type === 'sticker') { setLfWidth(10); setLfHeight(10); setLfUnit('cm'); }
  }

  const isUnit = isUnitJob(jobType);
  const isLF   = jobType === 'banner' || jobType === 'sticker';
  const isBook = jobType === 'book';
  const isFold = jobType === 'brochure' || jobType === 'trifold';

  const dims = useMemo(() => {
    if (sizeKey === 'Custom') return [customW || 0, customH || 0];
    return SIZES[sizeKey] || [210, 297];
  }, [sizeKey, customW, customH]);

  const normPages = useMemo(() => {
    if (!isBook) return 1;
    if (bindType === 'Saddle stitch') return Math.ceil(pages / 4) * 4;
    return Math.ceil(pages / 2) * 2;
  }, [isBook, pages, bindType]);

  const leavesPerCopy = duplex ? Math.ceil(normPages / 2) : normPages;

  const lfMaterials = Object.keys(rates.lf[jobType] || {});
  const activeMat   = lfMat || lfMaterials[0] || '';

  const itemList   = isUnit ? unitItems(rates, jobType) : [];
  const activeItem = itemList.find((i) => i.name === unitItem) || itemList[0] || null;
  const unitMarkup = rates.unitMarkup ?? rates.markup ?? 0;
  const unitSell   = (item) => (Number(item?.cost) || 0) * (1 + unitMarkup / 100);

  const result = useMemo(() => {
    if (isUnit) {
      const sell = unitSell(activeItem) * qty;
      if (!sell) return null;
      return { total: sell, perUnit: qty > 0 ? sell / qty : sell, qty, item: activeItem.name };
    }
    if (isLF) {
      const matRates = rates.lf[jobType] || {};
      const rate     = matRates[activeMat] || 0;
      const sq       = rates.areaUnit === 'sqft';
      const toM      = UNIT_TO_M[lfUnit] || 1;
      const areaSqM  = (lfWidth * toM) * (lfHeight * toM);
      const area     = sq ? areaSqM * 10.7639 : areaSqM;
      const rawCost  = area * rate;
      const perPiece = Math.max(rates.lfMin, rawCost);
      const fin      = jobType === 'banner' ? rates.bannerFin : rates.stickerCut;
      const baseCost = perPiece * qty + (fin || 0) * qty;
      const sell     = baseCost * (1 + rates.lfMarkup / 100);
      if (!sell) return null;
      return {
        total:   sell,
        perUnit: qty > 0 ? sell / qty : sell,
        qty,
        area:    area.toFixed(2),
        areaUnit: sq ? 'sq ft' : 'm²',
        mat: activeMat,
      };
    }

    const [w, h] = dims;
    if (!w || !h) return null;
    const best = cheapestSheet(w, h, qty * leavesPerCopy, duplex, stock, rates);
    if (!best) return null;

    let cost = best.cost;
    if (isBook) {
      const spineW = bindType === 'Perfect bound' ? (spine || 0) : 0;
      const covBest = cheapestSheet(2 * w + spineW, h, qty, covDuplex, coverStock, rates);
      if (covBest) {
        cost += covBest.cost;
        // Booklets: only the cover is laminated, outside face
        cost += laminationCost(lamination, covBest.name, covBest.sheets, 1, rates);
      }
      const bindRate = rates.bind[bindType] || 0;
      if (bindRate) cost += bindRate * qty;
    } else {
      cost += laminationCost(lamination, best.name, best.sheets, duplex ? 2 : 1, rates);
    }
    if (isFold) cost += rates.fold * qty;

    const sell = cost * (1 + rates.markup / 100);
    if (!sell) return null;
    return {
      total:   sell,
      perUnit: qty > 0 ? sell / qty : sell,
      qty,
      sheet:   best.name,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnit, activeItem, unitMarkup, isLF, jobType, dims, qty, leavesPerCopy, duplex, stock, isBook, isFold, bindType, spine, coverStock, covDuplex, lamination, activeMat, lfWidth, lfHeight, lfUnit, rates]);

  // Notify parent whenever the result or key config changes
  useEffect(() => {
    if (!onResult) return;
    if (!result) { onResult(null); return; }
    if (isUnit) {
      onResult({ jobType, jobLabel, unitItem: result.item, qty, size: result.item, total: result.total, perUnit: result.perUnit });
      return;
    }
    const size = isLF
      ? `${lfWidth}${lfUnit} × ${lfHeight}${lfUnit}`
      : sizeKey === "Custom" ? `Custom (${fmtDims(customW, customH, "mm", dimUnit)})` : digitalSizeLabel(sizeKey, dimUnit);
    onResult({
      jobType, jobLabel, size, qty,
      paper:    isLF ? activeMat : stock,
      duplex:   isLF ? false : duplex,
      pages:    isBook ? normPages : null,
      bindType: isBook ? bindType : null,
      coverStock: isBook ? coverStock : null,
      covDuplex:  isBook ? covDuplex  : null,
      lamination: isLF ? null : lamination,
      area:    result.area  || null,
      areaUnit: result.areaUnit || null,
      mat:      result.mat   || null,
      total:    result.total,
      perUnit:  result.perUnit,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // ── Accordion: only "What do you need printed?" starts open ────────────────
  const [openSteps, setOpenSteps] = useState(() => new Set([1]));
  function toggleStep(n) {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      if (next.has(n)) next.delete(n); else next.add(n);
      return next;
    });
  }
  // "Next": close this step, open the following one
  function nextStep(n) {
    setOpenSteps((prev) => {
      const next = new Set(prev);
      next.delete(n);
      next.add(n + 1);
      return next;
    });
  }

  // One-line answers shown on each step's header
  const jobLabel = JOB_TYPES.find((t) => t.value === jobType)?.label || jobType;
  const pieces = (n) => `${n.toLocaleString()} piece${n !== 1 ? 's' : ''}`;
  const sizeSummary = isUnit
    ? [activeItem?.name, pieces(qty)].filter(Boolean).join(' · ')
    : isLF
    ? `${lfWidth}${lfUnit} × ${lfHeight}${lfUnit} · ${qty.toLocaleString()} piece${qty !== 1 ? 's' : ''}`
    : [
        sizeKey === 'Custom' ? `Custom ${fmtDims(customW, customH, 'mm', dimUnit)}` : digitalSizeLabel(sizeKey, dimUnit),
        isBook ? `${normPages} pages` : null,
        `${qty.toLocaleString()} ${isBook ? 'books' : 'copies'}`,
      ].filter(Boolean).join(' · ');
  const materialSummary = isLF
    ? activeMat
    : isBook ? `Inside: ${stock} · Cover: ${coverStock}` : stock;
  const finishingSummary = isLF
    ? (jobType === 'banner' ? 'Hemming & eyelets included' : 'Cutting included')
    : [
        duplex ? 'Double-sided' : 'Single-sided',
        lamination !== LAMINATION_NONE ? `${lamination} lamination` : 'No lamination',
        isBook ? bindType : null,
      ].filter(Boolean).join(' · ');

  // ── Shared style ─────────────────────────────────────────────────────────────
  const inp =
    "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 text-sm " +
    "text-[var(--t-text1)] focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-colors";
  const lbl = "block text-xs font-medium text-[var(--t-text2)] mb-1.5";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-5">

      {/* Scope note: Live Quote prices digital work only */}
      <div className="flex items-start gap-3 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-4 py-3">
        <Info size={16} className="mt-0.5 shrink-0 text-[var(--t-text2)]" aria-hidden="true" />
        <p className="text-xs leading-relaxed text-[var(--t-text2)]">
          <strong className="font-semibold text-[var(--t-text1)]">Live Quote is for digital prints.</strong>{" "}
          For offset printing and other large-quantity jobs,{" "}
          {waLink ? (
            <a href={waLink} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2" style={{ color: accent }}>
              contact us on WhatsApp
            </a>
          ) : "contact us on WhatsApp"}{" "}
          for a tailored quote.
        </p>
      </div>

      {/* ── Step-by-step questions ── */}
      <div className="space-y-3">

        {/* 1 · What do you need printed? */}
        <QuoteStep step={1} title="What do you need printed?" summary={jobLabel}
          open={openSteps.has(1)} onToggle={() => toggleStep(1)} onNext={() => nextStep(1)} accent={accent}>
          <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {JOB_TYPES.map((t) => {
              const thumb = quoterThumbnails[t.value];
              const active = jobType === t.value;
              return (
                <button
                  key={t.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setJobType(t.value)}
                  className={[
                    "flex-shrink-0 flex flex-col items-center gap-2 rounded-xl border-2 p-2 w-[170px] transition-all",
                    active
                      ? "border-transparent text-white"
                      : "border-[var(--t-border)] text-[var(--t-text2)] bg-[var(--t-surface)] hover:border-brand-red/40",
                  ].join(" ")}
                  style={active ? { background: accent, borderColor: accent } : {}}
                >
                  <div className={[
                    "w-[150px] h-[150px] rounded-lg overflow-hidden flex items-center justify-center shrink-0",
                    active ? "bg-white/20" : "bg-[var(--t-bg)]",
                  ].join(" ")}>
                    {thumb ? (
                      <img src={thumb} alt={t.label} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-6xl">{
                        { flyer: '🗞️', card: '💳', brochure: '📖', trifold: '📋',
                          book: '📚', banner: '🖼️', sticker: '🏷️', custom: '✏️',
                          rollup: '🪧', tshirt: '👕', souvenir: '☕' }[t.value] || '🖨️'
                      }</span>
                    )}
                  </div>
                  <span className="text-xs font-semibold text-center leading-tight line-clamp-2">{t.label}</span>
                </button>
              );
            })}
          </div>
        </QuoteStep>

        {/* 2 · Size and quantity */}
        <QuoteStep step={2}
          title={isUnit ? (jobType === 'rollup' ? 'Which material and how many?' : 'Which item and how many?') : 'What is the size and quantity?'}
          summary={sizeSummary}
          open={openSteps.has(2)} onToggle={() => toggleStep(2)} onNext={isUnit ? undefined : () => nextStep(2)} accent={accent}>
          {isUnit ? (
            <div className="space-y-4">
              {itemList.length ? (
                <div>
                  <p className={lbl}>{jobType === 'rollup' ? 'Material (all roll-ups are 80 × 200 cm with stand)' : jobType === 'tshirt' ? 'Shirt & print' : 'Item'}</p>
                  {/* Same scrolling picture cards as "What do you need printed?" */}
                  <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
                    {itemList.map((item) => {
                      const on    = activeItem?.name === item.name;
                      const thumb = quoterThumbnails[unitThumbKey(jobType, item.name)];
                      return (
                        <button key={item.name} type="button" aria-pressed={on} onClick={() => setUnitItem(item.name)}
                          className={[
                            "flex-shrink-0 flex flex-col items-center gap-2 rounded-xl border-2 p-2 w-[170px] transition-all",
                            on ? "border-transparent text-white" : "border-[var(--t-border)] text-[var(--t-text2)] bg-[var(--t-surface)] hover:border-brand-red/40",
                          ].join(" ")}
                          style={on ? { background: accent, borderColor: accent } : {}}>
                          <div className={[
                            "w-[150px] h-[150px] rounded-lg overflow-hidden flex items-center justify-center shrink-0",
                            on ? "bg-white/20" : "bg-[var(--t-bg)]",
                          ].join(" ")}>
                            {thumb ? (
                              <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                            ) : (
                              <span className="text-6xl" aria-hidden="true">{{ rollup: '🪧', tshirt: '👕', souvenir: '🎁' }[jobType] || '🖨️'}</span>
                            )}
                          </div>
                          <span className="text-xs font-semibold text-center leading-tight line-clamp-2 min-h-[2.5em]">{item.name}</span>
                          <span className={`text-xs font-bold tabular-nums ${on ? "" : "text-[var(--t-text1)]"}`}>{GHS(unitSell(item))}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1.5 text-[11px] text-[var(--t-muted)]">Price per piece, branding with your logo or design included.</p>
                </div>
              ) : (
                <p className="text-sm text-[var(--t-muted)]">Contact us for a price on this product.</p>
              )}
              <div className="sm:max-w-[200px]">
                <label className={lbl}>Quantity (pieces)</label>
                <input type="number" min="1" className={inp} value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
            </div>
          ) : !isLF ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>{isBook ? 'Page size' : isFold ? 'Flat (open) size' : 'Finished size'}</label>
                <div className="flex gap-2">
                  <select className={inp} value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
                    {Object.keys(SIZES).map((k) => <option key={k} value={k}>{digitalSizeLabel(k, dimUnit)}</option>)}
                  </select>
                  <UnitSelect value={dimUnit} onChange={setDimUnit} ariaLabel="Size unit"
                    className={inp + " !w-auto shrink-0"} />
                </div>
              </div>
              <div>
                <label className={lbl}>Quantity ({isBook ? 'books' : 'copies'})</label>
                <input type="number" min="1" className={inp} value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              {sizeKey === 'Custom' && (
                <>
                  <div>
                    <label className={lbl}>Width ({dimUnit})</label>
                    <DimensionInput className={inp} value={customW} baseUnit="mm" displayUnit={dimUnit} onChange={setCustomW} />
                  </div>
                  <div>
                    <label className={lbl}>Height ({dimUnit})</label>
                    <DimensionInput className={inp} value={customH} baseUnit="mm" displayUnit={dimUnit} onChange={setCustomH} />
                  </div>
                </>
              )}
              {isBook && (
                <div>
                  <label className={lbl}>Number of pages</label>
                  <input type="number" min="1" className={inp} value={pages}
                    onChange={(e) => setPages(Math.max(1, parseInt(e.target.value) || 1))} />
                  <p className="text-[10px] text-[var(--t-muted)] mt-1">
                    Rounded up to the nearest {bindType === 'Saddle stitch' ? '4' : '2'}{normPages !== pages ? ` (${normPages} pages)` : ''}.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {jobType === 'sticker' && (
                <div>
                  <label className={lbl}>Standard size presets</label>
                  <div className="flex flex-wrap gap-2">
                    {STICKER_SIZE_PRESETS.map(({ label, w, h }) => {
                      // Presets are in mm; fill them in using whatever unit is selected
                      const on = Math.abs(convertLength(lfWidth, lfUnit, 'mm') - w) < 0.5
                              && Math.abs(convertLength(lfHeight, lfUnit, 'mm') - h) < 0.5;
                      return (
                        <button
                          key={label}
                          type="button"
                          aria-pressed={on}
                          onClick={() => { setLfWidth(convertLength(w, 'mm', lfUnit)); setLfHeight(convertLength(h, 'mm', lfUnit)); }}
                          className={[
                            "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                            on
                              ? "text-white border-transparent"
                              : "border-[var(--t-border)] text-[var(--t-text2)] bg-[var(--t-surface)] hover:border-brand-red/40",
                          ].join(" ")}
                          style={on ? { background: accent } : {}}
                        >
                          {label} ({fmtDims(w, h, 'mm', lfUnit)})
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div>
                  <label className={lbl}>Width ({lfUnit})</label>
                  <input type="number" step="any" min="0" className={inp} value={lfWidth}
                    onChange={(e) => setLfWidth(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className={lbl}>Height ({lfUnit})</label>
                  <input type="number" step="any" min="0" className={inp} value={lfHeight}
                    onChange={(e) => setLfHeight(parseFloat(e.target.value) || 0)} />
                </div>
                <div>
                  <label className={lbl}>Unit</label>
                  <UnitSelect value={lfUnit} onChange={changeLfUnit} units={UNIT_KEYS} ariaLabel="Banner or sticker unit" className={inp} />
                </div>
                <div>
                  <label className={lbl}>Quantity</label>
                  <input type="number" min="1" className={inp} value={qty}
                    onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
              </div>
            </div>
          )}
        </QuoteStep>

        {/* 3 · Material (not asked for per-piece products) */}
        {!isUnit && <QuoteStep step={3} title="What material should be used for your job?" summary={materialSummary}
          open={openSteps.has(3)} onToggle={() => toggleStep(3)} onNext={() => nextStep(3)} accent={accent}>
          <GrammageNote isLF={isLF} />
          {!isLF ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>{isBook ? 'Inside pages paper' : 'Paper'}</label>
                <select className={inp} value={stock} onChange={(e) => setStock(e.target.value)}>
                  {DIGITAL_STOCK_NAMES.map((s) => <option key={s} value={s}>{paperOption(s)}</option>)}
                </select>
                <FeelHint name={stock} />
              </div>
              {isBook && (
                <div>
                  <label className={lbl}>Cover paper</label>
                  <select className={inp} value={coverStock} onChange={(e) => setCoverStock(e.target.value)}>
                    {DIGITAL_STOCK_NAMES.map((s) => <option key={s} value={s}>{paperOption(s)}</option>)}
                  </select>
                  <FeelHint name={coverStock} />
                </div>
              )}
            </div>
          ) : (
            <div className="sm:max-w-xs">
              <label className={lbl}>Material</label>
              <select className={inp} value={activeMat} onChange={(e) => setLfMat(e.target.value)}>
                {lfMaterials.map((m) => <option key={m}>{m}</option>)}
              </select>
              <FeelHint name={activeMat} />
            </div>
          )}
        </QuoteStep>}

        {/* 4 · Finishing (not asked for per-piece products) */}
        {!isUnit && <QuoteStep step={4} title="What finishing do you want?" summary={finishingSummary}
          open={openSteps.has(4)} onToggle={() => toggleStep(4)} accent={accent}>
          {!isLF ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={lbl}>{isBook ? 'Inside pages printing' : 'Printing sides'}</label>
                <ChoiceRow value={duplex} onChange={setDuplex} accent={accent}
                  options={[[false, 'Single-sided'], [true, 'Double-sided']]} />
              </div>
              <div>
                <label className={lbl}>{isBook ? 'Cover lamination' : 'Lamination'}</label>
                <select className={inp} value={lamination} onChange={(e) => setLamination(e.target.value)}>
                  {laminationOptions(rates).map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
              {isBook && (
                <>
                  <div className="sm:col-span-2">
                    <label className={lbl}>Cover printing</label>
                    <ChoiceRow value={covDuplex} onChange={setCovDuplex} accent={accent}
                      options={[[false, 'Single-sided (outside)'], [true, 'Double-sided (in + out)']]} />
                  </div>
                  <div>
                    <label className={lbl}>Binding type</label>
                    <select className={inp} value={bindType} onChange={(e) => setBindType(e.target.value)}>
                      {Object.keys(rates.bind).map((b) => <option key={b}>{b}</option>)}
                    </select>
                  </div>
                  {bindType === 'Perfect bound' && (
                    <div>
                      <label className={lbl}>Spine width (mm)</label>
                      <input type="number" min="0" className={inp} value={spine}
                        onChange={(e) => setSpine(parseFloat(e.target.value) || 0)} />
                    </div>
                  )}
                </>
              )}
              {isFold && (
                <p className="sm:col-span-2 text-xs text-[var(--t-muted)]">
                  Folding ({jobType === 'trifold' ? 'tri-fold' : 'bi-fold'}) is included in the price.
                </p>
              )}
            </div>
          ) : (
            <p className="text-sm text-[var(--t-text2)]">
              {jobType === 'banner'
                ? 'Hemming and eyelets are included with every banner.'
                : 'Cutting to size is included with every sticker.'}
            </p>
          )}
        </QuoteStep>}
      </div>

      {/* ── Price result ── */}
      {result ? (
        <div className="rounded-2xl overflow-hidden">
          <div className="p-5 sm:p-6 text-white" style={{ background: accent }}>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-3">
              Estimated price
            </p>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs opacity-75 mb-0.5">Total for {(isLF || isUnit) ? pieces(qty) : `${qty.toLocaleString()} copies`}</p>
                <p className="text-4xl font-black tracking-tight">{GHS(result.total)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-75 mb-0.5">Per {(isLF || isUnit) ? 'piece' : 'copy'}</p>
                <p className="text-2xl font-bold">{GHS(result.perUnit)}</p>
              </div>
            </div>
            {result.sheet && (
              <p className="text-xs opacity-70 mt-3">Printed on {result.sheet} parent sheet</p>
            )}
            {result.item && (
              <p className="text-xs opacity-70 mt-3">{result.item}</p>
            )}
            {result.area && (
              <p className="text-xs opacity-70 mt-3">{result.area} {result.areaUnit} · {result.mat}</p>
            )}
          </div>
          <div className="bg-[var(--t-surface)] border-l border-r border-b border-[var(--t-border)] rounded-b-2xl px-5 py-3">
            <p className="text-xs text-[var(--t-muted)]">
              This is a live estimate. Final price confirmed when your order is placed.
              {" "}<strong className="text-[var(--t-text2)]">Contact us to get started.</strong>
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-6 text-center">
          <p className="text-sm text-[var(--t-muted)]">
            {isUnit
              ? "Pick an item to see the price."
              : !isLF && (!dims[0] || !dims[1])
              ? "Enter a valid size to see the price."
              : "This size doesn't fit on any standard sheet — try a smaller size or contact us."}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Accordion step ───────────────────────────────────────────────────────────
function QuoteStep({ step, title, summary, open, onToggle, onNext, accent, children }) {
  const panelId  = `live-quote-step-${step}`;
  const headerId = `${panelId}-header`;
  return (
    <section className="overflow-hidden rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)]">
      <h3>
        <button type="button" id={headerId} aria-expanded={open} aria-controls={panelId} onClick={onToggle}
          className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[var(--t-bg)] sm:px-5">
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors"
            style={open ? { background: accent, color: "#fff" } : { background: "var(--t-bg)", color: "var(--t-text2)", boxShadow: "inset 0 0 0 1px var(--t-border)" }}>
            {step}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-[var(--t-text1)]">{title}</span>
            {!open && summary && <span className="mt-0.5 block truncate text-xs text-[var(--t-muted)]">{summary}</span>}
          </span>
          <ChevronDown size={18} aria-hidden="true"
            className={`shrink-0 text-[var(--t-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        </button>
      </h3>

      {/* Height animates via grid rows; collapsed content is inert (no focus / screen reader) */}
      <div id={panelId} role="region" aria-labelledby={headerId} inert={!open}
        className={`grid transition-[grid-template-rows] duration-200 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-[var(--t-border)] px-4 pb-4 pt-4 sm:px-5">
            {children}
            {onNext && (
              <div className="mt-4 flex justify-end">
                <button type="button" onClick={onNext}
                  className="inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: accent }}>
                  Next <ChevronRight size={14} aria-hidden="true" />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// "What does gsm mean?" — shown at the top of the Material step
function GrammageNote({ isLF }) {
  return (
    <div className="mb-4 flex items-start gap-3 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3.5 py-3">
      <Info size={16} className="mt-0.5 shrink-0 text-[var(--t-text2)]" aria-hidden="true" />
      <p className="text-xs leading-relaxed text-[var(--t-text2)]">
        <strong className="font-semibold text-[var(--t-text1)]">gsm = thickness.</strong>{" "}
        The higher the number, the thicker the {isLF ? 'material' : 'paper'} and the higher the cost.
      </p>
    </div>
  );
}

function FeelHint({ name }) {
  const f = paperFeel(name);
  if (!f) return null;
  return <p className="mt-1 text-[11px] text-[var(--t-muted)]">{f.feel}</p>;
}

// Two-option toggle (single / double-sided)
function ChoiceRow({ value, onChange, options, accent }) {
  return (
    <div className="flex gap-2">
      {options.map(([v, label]) => (
        <button key={String(v)} type="button" aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={[
            "flex-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all",
            value === v ? "text-white border-transparent" : "border-[var(--t-border)] text-[var(--t-text2)] bg-[var(--t-surface)]",
          ].join(" ")}
          style={value === v ? { background: accent, borderColor: accent } : {}}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
