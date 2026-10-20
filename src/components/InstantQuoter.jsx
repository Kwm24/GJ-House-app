/**
 * InstantQuoter.jsx
 * Customer-facing digital print price calculator.
 * Shows total price and per-unit price. No profit breakdown, no save button.
 * Used on the Landing Page and Customer Portal.
 */

import { useState, useMemo, useEffect } from "react";
import { getSettings } from "../lib/settings.js";
import { DEFAULT_DIGITAL_RATES, DIGITAL_STOCK_NAMES, DIGITAL_SHEET_NAMES } from "../lib/digitalPrintSpecs.js";

// ── Constants ──────────────────────────────────────────────────────────────────
const SIZES = {
  'A6 (105×148)':          [105, 148],
  'DL (99×210)':           [99,  210],
  'A5 (148×210)':          [148, 210],
  'A4 (210×297)':          [210, 297],
  'A3 (297×420)':          [297, 420],
  'Business card (90×55)': [90,   55],
  'A4 flat (297×210)':     [297, 210],
  'A3 flat (420×297)':     [420, 297],
  'Custom':                null,
};

const JOB_PRESETS = {
  flyer:   { size: 'A5 (148×210)',          duplex: false, qty: 500  },
  card:    { size: 'Business card (90×55)', duplex: false, qty: 1000 },
  brochure:{ size: 'A3 flat (420×297)',     duplex: true,  qty: 500  },
  trifold: { size: 'A4 flat (297×210)',     duplex: true,  qty: 500  },
  book:    { size: 'A5 (148×210)',          duplex: true,  qty: 100  },
  banner:  { size: 'Custom',                duplex: false, qty: 1    },
  sticker: { size: 'Custom',                duplex: false, qty: 100  },
  custom:  { size: 'A4 (210×297)',          duplex: false, qty: 500  },
};

const JOB_TYPES = [
  { value: 'flyer',    label: 'Flyer / Leaflet / Poster' },
  { value: 'card',     label: 'Business Card' },
  { value: 'brochure', label: 'Brochure (bi-fold)' },
  { value: 'trifold',  label: 'Trifold Brochure' },
  { value: 'book',     label: 'Booklet / Book with cover' },
  { value: 'banner',   label: 'Banner' },
  { value: 'sticker',  label: 'Sticker / Label' },
  { value: 'custom',   label: 'Other / Custom size' },
];

const UNIT_TO_M = { ft: 0.3048, m: 1, cm: 0.01, in: 0.0254 };

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

function calcSheet(W, H, w, h, pieces, duplex, stock, rates) {
  const f = fitOnSheet(W - 2 * rates.margin, H - 2 * rates.margin, w, h, rates.gutter);
  if (!f.up) return null;
  const base   = Math.ceil(pieces / f.up);
  const sheets = base + Math.ceil(base * rates.wastePct / 100) + rates.wasteFixed;
  const print  = duplex ? rates.sheets[DIGITAL_SHEET_NAMES.find((n) => rates.sheets[n]?.w === W && rates.sheets[n]?.h === H)]?.p2 : null;
  return { f, sheets, up: f.up };
}

function cheapestSheet(w, h, pieces, duplex, stock, rates) {
  let best = null;
  for (const name of DIGITAL_SHEET_NAMES) {
    const S = rates.sheets[name];
    if (!S) continue;
    const f = fitOnSheet(S.w - 2 * rates.margin, S.h - 2 * rates.margin, w, h, rates.gutter);
    if (!f.up) continue;
    const base     = Math.ceil(pieces / f.up);
    const sheets   = base + Math.ceil(base * rates.wastePct / 100) + rates.wasteFixed;
    const printCost = duplex ? S.p2 : S.p1;
    const paperCost = (rates.stocks[stock] || {})[name] || 0;
    const cost = sheets * (printCost + paperCost);
    if (!best || cost < best.cost) best = { name, f, sheets, cost };
  }
  return best;
}

// ── Build a WhatsApp-ready order summary from a result snapshot ───────────────
export function buildInstantQuoteSummary({ jobType, jobLabel, size, qty, paper, duplex, pages, bindType, area, areaUnit, mat, total, perUnit }) {
  const GHSfmt = (n) => "GH₵ " + Number(n).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
  if (area) lines.push(`Area: ${area} ${areaUnit} · Material: ${mat}`);
  lines.push("", `Estimated total: ${GHSfmt(total)}`, `Per ${isLarge ? "piece" : "copy"}: ${GHSfmt(perUnit)}`, "", "Please confirm and help me finalise my order. Thank you!");
  return lines.join("\n");
}

// Standard paper sizes for sticker presets (width × height in mm)
const STICKER_SIZE_PRESETS = [
  { label: 'A4',  w: 210, h: 297 },
  { label: 'A3',  w: 297, h: 420 },
  { label: 'A2',  w: 420, h: 594 },
  { label: 'A1',  w: 594, h: 841 },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function InstantQuoter({ accentHex = "#C0392B", onResult }) {
  const accent = accentHex;

  const [rates,             setRates]             = useState(DEFAULT_DIGITAL_RATES);
  const [quoterThumbnails,  setQuoterThumbnails]  = useState({});

  const [jobType, setJobTypeRaw] = useState('flyer');
  const [sizeKey, setSizeKey]    = useState(JOB_PRESETS.flyer.size);
  const [customW, setCustomW]    = useState(100);
  const [customH, setCustomH]    = useState(150);
  const [qty,     setQty]        = useState(500);
  const [stock,   setStock]      = useState('130gsm Gloss');
  const [duplex,  setDuplex]     = useState(false);

  // Book extras
  const [pages,    setPages]    = useState(24);
  const [bindType, setBindType] = useState('Saddle stitch');
  const [spine,    setSpine]    = useState(3);

  // LF
  const [lfWidth,  setLfWidth]  = useState(6);
  const [lfHeight, setLfHeight] = useState(3);
  const [lfUnit,   setLfUnit]   = useState('ft');
  const [lfMat,    setLfMat]    = useState('');

  useEffect(() => {
    getSettings()
      .then((s) => {
        if (s?.digital_quote_rates)       setRates((r) => deepMerge(r, s.digital_quote_rates));
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
    if (type === 'banner') { setLfWidth(6); setLfUnit('ft'); }
    if (type === 'sticker') { setLfWidth(10); setLfHeight(10); setLfUnit('cm'); }
  }

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

  const result = useMemo(() => {
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
      const covBest = cheapestSheet(2 * w + spineW, h, qty, false, '250gsm Card', rates);
      if (covBest) cost += covBest.cost;
      const bindRate = rates.bind[bindType] || 0;
      if (bindRate) cost += bindRate * qty;
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
  }, [isLF, jobType, dims, qty, leavesPerCopy, duplex, stock, isBook, isFold, bindType, spine, activeMat, lfWidth, lfHeight, lfUnit, rates]);

  // Notify parent whenever the result or key config changes
  useEffect(() => {
    if (!onResult) return;
    if (!result) { onResult(null); return; }
    const jobLabel = JOB_TYPES.find((t) => t.value === jobType)?.label || jobType;
    const size = isLF
      ? `${lfWidth}×${lfHeight} ${lfUnit}`
      : sizeKey === "Custom" ? `${customW}×${customH} mm` : sizeKey;
    onResult({
      jobType, jobLabel, size, qty,
      paper:    isLF ? activeMat : stock,
      duplex:   isLF ? false : duplex,
      pages:    isBook ? normPages : null,
      bindType: isBook ? bindType : null,
      area:     result.area  || null,
      areaUnit: result.areaUnit || null,
      mat:      result.mat   || null,
      total:    result.total,
      perUnit:  result.perUnit,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // ── Shared style ─────────────────────────────────────────────────────────────
  const inp =
    "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 text-sm " +
    "text-[var(--t-text1)] focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-colors";
  const lbl = "block text-xs font-medium text-[var(--t-text2)] mb-1.5";

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 space-y-5">

      {/* Job type — horizontal scroll row with thumbnails */}
      <div>
        <label className={lbl}>What do you need printed?</label>
        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
          {JOB_TYPES.map((t) => {
            const thumb = quoterThumbnails[t.value];
            const active = jobType === t.value;
            return (
              <button
                key={t.value}
                type="button"
                onClick={() => setJobType(t.value)}
                className={[
                  "flex-shrink-0 flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 w-[88px] transition-all",
                  active
                    ? "border-transparent text-white"
                    : "border-[var(--t-border)] text-[var(--t-text2)] bg-[var(--t-surface)] hover:border-brand-red/40",
                ].join(" ")}
                style={active ? { background: accent, borderColor: accent } : {}}
              >
                <div className={[
                  "w-14 h-14 rounded-lg overflow-hidden flex items-center justify-center shrink-0",
                  active ? "bg-white/20" : "bg-[var(--t-bg)]",
                ].join(" ")}>
                  {thumb ? (
                    <img src={thumb} alt={t.label} className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-2xl">{
                      { flyer: '🗞️', card: '💳', brochure: '📖', trifold: '📋',
                        book: '📚', banner: '🖼️', sticker: '🏷️', custom: '✏️' }[t.value] || '🖨️'
                    }</span>
                  )}
                </div>
                <span className="text-[10px] font-semibold text-center leading-tight line-clamp-2">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Size + quantity */}
      {!isLF && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>{isBook ? 'Page size' : isFold ? 'Flat (open) size' : 'Finished size'}</label>
            <select className={inp} value={sizeKey} onChange={(e) => setSizeKey(e.target.value)}>
              {Object.keys(SIZES).map((k) => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Quantity (copies)</label>
            <input type="number" min="1" className={inp} value={qty}
              onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
          </div>
          {sizeKey === 'Custom' && (
            <>
              <div>
                <label className={lbl}>Width (mm)</label>
                <input type="number" className={inp} value={customW} onChange={(e) => setCustomW(parseFloat(e.target.value) || 0)} />
              </div>
              <div>
                <label className={lbl}>Height (mm)</label>
                <input type="number" className={inp} value={customH} onChange={(e) => setCustomH(parseFloat(e.target.value) || 0)} />
              </div>
            </>
          )}
          <div>
            <label className={lbl}>Paper</label>
            <select className={inp} value={stock} onChange={(e) => setStock(e.target.value)}>
              {DIGITAL_STOCK_NAMES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={lbl}>Printing sides</label>
            <div className="flex gap-2">
              {[false, true].map((d) => (
                <button key={String(d)} type="button"
                  onClick={() => setDuplex(d)}
                  className={[
                    "flex-1 rounded-lg border px-3 py-2.5 text-xs font-medium transition-all",
                    duplex === d ? "text-white border-transparent" : "border-[var(--t-border)] text-[var(--t-text2)] bg-[var(--t-surface)]",
                  ].join(" ")}
                  style={duplex === d ? { background: accent, borderColor: accent } : {}}
                >
                  {d ? 'Double-sided' : 'Single-sided'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Book extras */}
      {isBook && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={lbl}>Number of pages</label>
            <input type="number" min="1" className={inp} value={pages}
              onChange={(e) => setPages(Math.max(1, parseInt(e.target.value) || 1))} />
            <p className="text-[10px] text-[var(--t-muted)] mt-1">Rounded to nearest {bindType === 'Saddle stitch' ? '4' : '2'}.</p>
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
        </div>
      )}

      {/* Large format */}
      {isLF && (
        <div className="space-y-4">
          {/* Standard size presets for sticker */}
          {jobType === 'sticker' && (
            <div>
              <label className={lbl}>Standard size presets</label>
              <div className="flex flex-wrap gap-2">
                {STICKER_SIZE_PRESETS.map(({ label, w, h }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { setLfWidth(w); setLfHeight(h); setLfUnit('mm'); }}
                    className={[
                      "rounded-lg border px-3 py-1.5 text-xs font-medium transition-all",
                      lfUnit === 'mm' && lfWidth === w && lfHeight === h
                        ? "text-white border-transparent"
                        : "border-[var(--t-border)] text-[var(--t-text2)] bg-[var(--t-surface)] hover:border-brand-red/40",
                    ].join(" ")}
                    style={lfUnit === 'mm' && lfWidth === w && lfHeight === h ? { background: accent } : {}}
                  >
                    {label} ({w}×{h})
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <label className={lbl}>Width</label>
              <input type="number" step="0.01" className={inp} value={lfWidth}
                onChange={(e) => setLfWidth(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={lbl}>Height</label>
              <input type="number" step="0.01" className={inp} value={lfHeight}
                onChange={(e) => setLfHeight(parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <label className={lbl}>Unit</label>
              <select className={inp} value={lfUnit} onChange={(e) => setLfUnit(e.target.value)}>
                {Object.keys(UNIT_TO_M).map((u) => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className={lbl}>Quantity</label>
              <input type="number" min="1" className={inp} value={qty}
                onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
            </div>
            <div className="col-span-2">
              <label className={lbl}>Material</label>
              <select className={inp} value={activeMat} onChange={(e) => setLfMat(e.target.value)}>
                {lfMaterials.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ── Price result ── */}
      {result ? (
        <div className="rounded-2xl overflow-hidden">
          <div className="p-5 sm:p-6 text-white" style={{ background: accent }}>
            <p className="text-xs font-semibold uppercase tracking-widest opacity-80 mb-3">
              Estimated price
            </p>
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <p className="text-xs opacity-75 mb-0.5">Total for {qty.toLocaleString()} {isLF ? 'piece' + (qty !== 1 ? 's' : '') : 'copies'}</p>
                <p className="text-4xl font-black tracking-tight">{GHS(result.total)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs opacity-75 mb-0.5">Per {isLF ? 'piece' : 'copy'}</p>
                <p className="text-2xl font-bold">{GHS(result.perUnit)}</p>
              </div>
            </div>
            {result.sheet && (
              <p className="text-xs opacity-70 mt-3">Printed on {result.sheet} parent sheet</p>
            )}
            {result.area && (
              <p className="text-xs opacity-70 mt-3">{result.area} {result.areaUnit} · {result.mat}</p>
            )}
          </div>
          <div className="bg-[var(--t-surface)] border-l border-r border-b border-[var(--t-border)] rounded-b-2xl px-5 py-3">
            <p className="text-xs text-[var(--t-muted)]">
              This is an instant estimate. Final price confirmed when your order is placed.
              {" "}<strong className="text-[var(--t-text2)]">Contact us to get started.</strong>
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--t-border)] bg-[var(--t-surface)] p-6 text-center">
          <p className="text-sm text-[var(--t-muted)]">
            {!isLF && (!dims[0] || !dims[1])
              ? "Enter a valid size to see the price."
              : "This size doesn't fit on any standard sheet — try a smaller size or contact us."}
          </p>
        </div>
      )}
    </div>
  );
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const k of Object.keys(source)) {
    if (source[k] !== null && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      out[k] = deepMerge(target[k] || {}, source[k]);
    } else { out[k] = source[k]; }
  }
  return out;
}
