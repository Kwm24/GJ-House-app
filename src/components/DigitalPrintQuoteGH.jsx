/**
 * DigitalPrintQuoteGH.jsx
 * Digital printing quotation — Ghana
 * A3 Extra / A3 / A4 sheet pricing, imposition calc, banners & stickers per
 * area, fold/binding costs and markup. Quotes save to localStorage and import
 * into InvoiceBuilder the same way the offset quoter does.
 */

import { useState, useMemo, useEffect } from "react";
import { getSettings } from "../lib/settings.js";
import { DEFAULT_DIGITAL_RATES, DIGITAL_STOCK_NAMES, DIGITAL_SHEET_NAMES } from "../lib/digitalPrintSpecs.js";
import { saveDigitalQuoteToStorage } from "../lib/quoteStorage.js";
import { formatGHS as GHS } from "../lib/currency.js";
import { CustomerPicker } from "./CustomerPicker.jsx";

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
  banner:  { size: 'A4 (210×297)',          duplex: false, qty: 1    },
  sticker: { size: 'A4 (210×297)',          duplex: false, qty: 100  },
  custom:  { size: 'A4 (210×297)',          duplex: false, qty: 500  },
};

const JOB_TYPES = [
  { value: 'flyer',    label: 'Flyer / Leaflet / Poster' },
  { value: 'card',     label: 'Business Card' },
  { value: 'brochure', label: 'Brochure (bi-fold)' },
  { value: 'trifold',  label: 'Trifold Brochure' },
  { value: 'book',     label: 'Booklet / Book with cover' },
  { value: 'banner',   label: 'Banner (price per area)' },
  { value: 'sticker',  label: 'Sticker (price per area)' },
  { value: 'custom',   label: 'Other / Custom' },
];

const UNIT_TO_M = { ft: 0.3048, m: 1, cm: 0.01, in: 0.0254 };

function genDigitalRef() {
  const d  = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DQ-${ts}-${rnd}`;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
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

function calcComparison(w, h, pieces, duplex, stock, rates) {
  const results = {};
  for (const name of DIGITAL_SHEET_NAMES) {
    const S = rates.sheets[name];
    if (!S) { results[name] = { name, up: 0 }; continue; }
    const f = fitOnSheet(S.w - 2 * rates.margin, S.h - 2 * rates.margin, w, h, rates.gutter);
    if (!f.up) { results[name] = { name, up: 0 }; continue; }
    const base      = Math.ceil(pieces / f.up);
    const sheets    = base + Math.ceil(base * rates.wastePct / 100) + rates.wasteFixed;
    const printCost = duplex ? S.p2 : S.p1;
    const paperCost = (rates.stocks[stock] || {})[name] || 0;
    const perSheet  = printCost + paperCost;
    results[name] = { name, f, up: f.up, sheets, perSheet, cost: sheets * perSheet };
  }
  return results;
}

function cheapest(results) {
  const valid = Object.values(results).filter((r) => r.up > 0);
  return valid.length ? valid.reduce((a, b) => b.cost < a.cost ? b : a) : null;
}

export function buildDigitalSpecSummary(snap) {
  const j = snap.job || {};
  const isLF = j.jobType === 'banner' || j.jobType === 'sticker';
  if (isLF) {
    const label = j.jobType === 'banner' ? 'Banner' : 'Sticker';
    return `${label}: ${j.lfWidth}×${j.lfHeight} ${j.lfUnit} · ${j.lfMat}`;
  }
  const sizeLabel = j.sizeKey === 'Custom' ? `${j.customW}×${j.customH}mm` : j.sizeKey;
  const parts = [
    `Digital ${j.jobType}`,
    sizeLabel,
    `${j.qty} copies`,
    j.stock,
    j.duplex ? 'Double-sided' : 'Single-sided',
  ];
  if (j.jobType === 'book') {
    parts.push(`${j.pages}pp`);
    parts.push(j.bindType);
  }
  if (snap.result?.sheetName) parts.push(snap.result.sheetName);
  return parts.join(' · ');
}

// ── Layout preview ─────────────────────────────────────────────────────────────
function SheetPreview({ result, label, sheetDims }) {
  if (!result?.up || !result.f || !sheetDims) return null;
  const S  = sheetDims;
  const sc = Math.min(200 / S.w, 200 / S.h);
  const f  = result.f;
  const m  = 5;
  const ox = m + (S.w - 2 * m - (f.c * f.a + Math.max(0, f.c - 1) * 3)) / 2;
  const oy = m + (S.h - 2 * m - (f.n * f.b + Math.max(0, f.n - 1) * 3)) / 2;
  const pieces = [];
  for (let i = 0; i < f.c; i++) {
    for (let j = 0; j < f.n; j++) {
      pieces.push(
        <rect key={`${i}-${j}`}
          x={(ox + i * (f.a + 3)) * sc} y={(oy + j * (f.b + 3)) * sc}
          width={f.a * sc} height={f.b * sc}
          fill="#6366F1" fillOpacity="0.22" stroke="#6366F1" strokeWidth="1"
        />
      );
    }
  }
  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg viewBox={`0 0 ${S.w * sc} ${S.h * sc}`} width={S.w * sc} height={S.h * sc}
        className="rounded border border-[var(--t-border)]" style={{ background: 'var(--t-bg)' }}>
        <rect width={S.w * sc} height={S.h * sc} fill="var(--t-bg)" stroke="var(--t-border)" strokeWidth="1"/>
        {pieces}
      </svg>
      <p className="text-[10px] text-[var(--t-muted)] text-center">
        {label && <span className="font-medium">{label}: </span>}
        {result.name}, {f.c}×{f.n} = {f.up} up{f.rotated ? ', rotated' : ''}
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function DigitalPrintQuoteGH({ initialQuote = null, onBack = null }) {
  const initJob = initialQuote?.job || {};

  const [rates, setRates]   = useState(DEFAULT_DIGITAL_RATES);

  // Client info
  const [clientName,  setClientName]  = useState(initialQuote?.clientName  || "");
  const [clientPhone, setClientPhone] = useState(initialQuote?.clientPhone || "");
  const [clientEmail, setClientEmail] = useState(initialQuote?.clientEmail || "");
  const [jobTitle,    setJobTitle]    = useState(initialQuote?.jobTitle    || "");
  const [quoteRef]                    = useState(initialQuote?.ref || genDigitalRef());
  const [saveMsg,     setSaveMsg]     = useState("");

  // Job config — all seeded from initialQuote if present
  const [jobType,    setJobTypeRaw] = useState(initJob.jobType  || 'flyer');
  const [sizeKey,    setSizeKey]    = useState(initJob.sizeKey   || JOB_PRESETS[initJob.jobType || 'flyer'].size);
  const [customW,    setCustomW]    = useState(initJob.customW   || 100);
  const [customH,    setCustomH]    = useState(initJob.customH   || 150);
  const [qty,        setQty]        = useState(initJob.qty       || JOB_PRESETS[initJob.jobType || 'flyer'].qty);
  const [stock,      setStock]      = useState(initJob.stock     || '130gsm Gloss');
  const [duplex,     setDuplex]     = useState(initJob.duplex    ?? JOB_PRESETS[initJob.jobType || 'flyer'].duplex);
  const [extra,      setExtra]      = useState(initJob.extra     || 0);

  // Book extras
  const [pages,      setPages]      = useState(initJob.pages      || 24);
  const [bindType,   setBindType]   = useState(initJob.bindType   || 'Saddle stitch');
  const [spine,      setSpine]      = useState(initJob.spine      || 3);
  const [coverStock, setCoverStock] = useState(initJob.coverStock || '250gsm Card');
  const [covDuplex,  setCovDuplex]  = useState(initJob.covDuplex  || false);

  // Large format
  const [lfWidth,  setLfWidth]  = useState(initJob.lfWidth  || 6);
  const [lfHeight, setLfHeight] = useState(initJob.lfHeight || 3);
  const [lfUnit,   setLfUnit]   = useState(initJob.lfUnit   || 'ft');
  const [lfMat,    setLfMat]    = useState(initJob.lfMat    || '');

  // Selected sheet (null = auto-cheapest)
  const [pickedSheet, setPickedSheet] = useState(null);

  // Load rates from settings
  useEffect(() => {
    getSettings()
      .then((s) => { if (s?.digital_quote_rates) setRates((r) => deepMerge(r, s.digital_quote_rates)); })
      .catch(() => {});
  }, []);

  function setJobType(type) {
    const pre = JOB_PRESETS[type];
    setJobTypeRaw(type);
    setSizeKey(pre.size);
    setDuplex(pre.duplex);
    setQty(pre.qty);
    setPickedSheet(null);
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

  const comparison = useMemo(() => {
    if (isLF) return {};
    const [w, h] = dims;
    return calcComparison(w, h, qty * leavesPerCopy, duplex, stock, rates);
  }, [isLF, dims, qty, leavesPerCopy, duplex, stock, rates]);

  const bestSheet    = useMemo(() => cheapest(comparison), [comparison]);
  const pickedResult = useMemo(() => {
    if (!pickedSheet) return bestSheet;
    const r = comparison[pickedSheet];
    return (r && r.up > 0) ? r : bestSheet;
  }, [pickedSheet, comparison, bestSheet]);

  const coverComparison = useMemo(() => {
    if (!isBook) return {};
    const [w, h] = dims;
    const spineW = bindType === 'Perfect bound' ? (spine || 0) : 0;
    return calcComparison(2 * w + spineW, h, qty, covDuplex, coverStock, rates);
  }, [isBook, dims, bindType, spine, qty, covDuplex, coverStock, rates]);

  const bestCover = useMemo(() => cheapest(coverComparison), [coverComparison]);

  const lfMaterials = Object.keys(rates.lf[jobType] || {});
  const activeMat   = lfMat || lfMaterials[0] || '';

  const lfQuote = useMemo(() => {
    if (!isLF) return null;
    const matRates = rates.lf[jobType] || {};
    const rate     = matRates[activeMat] || 0;
    const sq       = rates.areaUnit === 'sqft';
    const toM      = UNIT_TO_M[lfUnit] || 1;
    const areaSqM  = (lfWidth * toM) * (lfHeight * toM);
    const area     = sq ? areaSqM * 10.7639 : areaSqM;
    const rawCost  = area * rate;
    const perPiece = Math.max(rates.lfMin, rawCost);
    const fin      = jobType === 'banner' ? rates.bannerFin : rates.stickerCut;
    const rows     = [{ label: `${activeMat}: ${lfWidth}×${lfHeight} ${lfUnit} = ${area.toFixed(2)} ${sq ? 'sq ft' : 'm²'} × ${GHS(rate)}${rawCost < rates.lfMin ? ' (min charge)' : ''} × ${qty}`, amount: perPiece * qty }];
    if (fin) rows.push({ label: `${jobType === 'banner' ? 'Hem & eyelets' : 'Cutting'} (${qty} × ${GHS(fin)})`, amount: fin * qty });
    if (extra) rows.push({ label: `Extras (${qty} × ${GHS(extra)})`, amount: qty * extra });
    if (rates.setup) rows.push({ label: 'Setup fee', amount: rates.setup });
    const cost = rows.reduce((s, r) => s + r.amount, 0);
    const sell = cost * (1 + rates.lfMarkup / 100);
    return { rows, cost, sell, area: area.toFixed(2), unit: sq ? 'sq ft' : 'm²', rate };
  }, [isLF, jobType, activeMat, lfWidth, lfHeight, lfUnit, qty, extra, rates]);

  const quoteRows = useMemo(() => {
    if (isLF || !pickedResult) return [];
    const rows = [];
    rows.push({ label: isBook ? `Inside pages (${normPages} pp, ${duplex ? 'double' : 'single'}-sided, ${pickedResult.name})` : `Printing (${duplex ? 'double' : 'single'}-sided, ${pickedResult.name})`, amount: pickedResult.cost });
    if (isBook && bestCover) rows.push({ label: `Cover (${covDuplex ? 'double' : 'single'}-sided, ${bestCover.name})`, amount: bestCover.cost });
    if (isFold) rows.push({ label: `Folding (${qty} × ${GHS(rates.fold)})`, amount: qty * rates.fold });
    const bindRate = rates.bind[bindType] || 0;
    if (isBook && bindRate) rows.push({ label: `${bindType} (${qty} × ${GHS(bindRate)})`, amount: qty * bindRate });
    if (extra) rows.push({ label: `Extras (${qty} × ${GHS(extra)})`, amount: qty * extra });
    if (rates.setup) rows.push({ label: 'Setup fee', amount: rates.setup });
    return rows;
  }, [isLF, pickedResult, isBook, isFold, normPages, duplex, qty, bestCover, covDuplex, rates, bindType, extra]);

  const totalCost = useMemo(() => quoteRows.reduce((s, r) => s + r.amount, 0), [quoteRows]);
  const sellPrice = useMemo(() => totalCost * (1 + rates.markup / 100), [totalCost, rates.markup]);

  // ── Save quote ──────────────────────────────────────────────────────────────
  function handleSave() {
    const isSellable = isLF ? (lfQuote && lfQuote.sell > 0) : (pickedResult && sellPrice > 0);
    if (!isSellable) { setSaveMsg("Generate a quote first before saving."); return; }

    const cost  = isLF ? lfQuote.cost : totalCost;
    const sell  = isLF ? lfQuote.sell : sellPrice;
    const mu    = isLF ? rates.lfMarkup : rates.markup;

    const description = buildDigitalSpecSummary({
      job: { jobType, sizeKey, customW, customH, qty, stock, duplex, pages, bindType, spine, coverStock, covDuplex, extra, lfWidth, lfHeight, lfUnit, lfMat: activeMat },
      result: { sheetName: pickedResult?.name },
    });

    const snapshot = {
      ref:        quoteRef,
      date:       new Date().toISOString().slice(0, 10),
      clientName, clientPhone, clientEmail, jobTitle,
      quoteType:  'digital',
      job: { jobType, sizeKey, customW, customH, qty, stock, duplex, pages, bindType, spine, coverStock, covDuplex, extra, lfWidth, lfHeight, lfUnit, lfMat: activeMat },
      result: {
        qty,
        totalCost: cost,
        sellPrice: sell,
        markup:    mu,
        profit:    sell - cost,
        perCopy:   Math.round(sell / qty * 100) / 100,
        isLF,
        sheetName: pickedResult?.name || null,
        description,
      },
      rates,
    };

    saveDigitalQuoteToStorage(snapshot).catch(console.error);
    setSaveMsg(`Saved as ${quoteRef}`);
    setTimeout(() => setSaveMsg(""), 4000);
  }

  // ── Shared style strings ────────────────────────────────────────────────────
  const cls = {
    card:   "rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4 sm:p-5",
    label:  "block text-xs font-medium text-[var(--t-muted)] mb-1.5",
    input:  "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-sm text-[var(--t-text1)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors",
    select: "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-sm text-[var(--t-text1)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors",
    th:     "py-2 px-3 text-right text-xs font-semibold text-[var(--t-muted)] border-b border-[var(--t-border)]",
    td:     "py-2 px-3 text-right text-sm text-[var(--t-text1)] border-b border-[var(--t-border)] tabular-nums whitespace-nowrap",
  };

  const sided = (d) => (
    <button type="button" onClick={() => setDuplex(d)}
      className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${duplex === d ? 'bg-[#6366F1] text-white border-[#6366F1]' : 'bg-[var(--t-bg)] text-[var(--t-text2)] border-[var(--t-border)] hover:border-[var(--t-text2)]'}`}>
      {d ? 'Double-sided' : 'Single-sided'}
    </button>
  );

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 space-y-5">

      {/* Back button */}
      {onBack && (
        <button type="button" onClick={onBack}
          className="text-sm font-medium text-[var(--t-muted)] hover:text-[var(--t-text1)] transition-colors">
          ← Back to quotes
        </button>
      )}

      {/* ── Client info + save ── */}
      <div className={cls.card}>
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--t-muted)]">Digital Print Quote</p>
            <p className="text-xs font-mono text-[var(--t-text2)] mt-0.5">{quoteRef}</p>
          </div>
          <div className="flex items-center gap-2">
            {saveMsg && <span className="text-xs font-medium text-green-600">{saveMsg}</span>}
            <button type="button" onClick={handleSave}
              className="rounded-lg bg-[#6366F1] text-white text-xs font-semibold px-4 py-2 hover:bg-[#4F46E5] transition-colors">
              💾 Save quote
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <label className={cls.label}>Job title</label>
            <input type="text" className={cls.input} value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="e.g. Flyer for Accra launch event" />
          </div>
          <div className="sm:col-span-2 flex justify-end -mb-1">
            <CustomerPicker
              onSelect={({ name, phone, email }) => {
                setClientName(name);
                setClientPhone(phone);
                if (email) setClientEmail(email);
              }}
            />
          </div>
          <div>
            <label className={cls.label}>Client name</label>
            <input type="text" className={cls.input} value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="Client or company name" />
          </div>
          <div>
            <label className={cls.label}>Phone</label>
            <input type="tel" className={cls.input} value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} placeholder="+233 XX XXX XXXX" />
          </div>
          <div className="sm:col-span-2">
            <label className={cls.label}>Email (optional)</label>
            <input type="email" className={cls.input} value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} placeholder="client@example.com" />
          </div>
        </div>
      </div>

      {/* ── Job config ── */}
      <div className={cls.card}>
        <h3 className="text-sm font-semibold text-[var(--t-text1)] mb-4">Job details</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          <div className="sm:col-span-2">
            <label className={cls.label}>Job type</label>
            <select className={cls.select} value={jobType} onChange={(e) => setJobType(e.target.value)}>
              {JOB_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {!isLF && (
            <>
              <div>
                <label className={cls.label}>{isBook ? 'Page size (trim)' : isFold ? 'Flat (open) size' : 'Finished size'}</label>
                <select className={cls.select} value={sizeKey} onChange={(e) => { setSizeKey(e.target.value); setPickedSheet(null); }}>
                  {Object.keys(SIZES).map((k) => <option key={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className={cls.label}>Copies (quantity)</label>
                <input type="number" min="1" className={cls.input} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              {sizeKey === 'Custom' && (
                <>
                  <div>
                    <label className={cls.label}>Width (mm)</label>
                    <input type="number" className={cls.input} value={customW} onChange={(e) => { setCustomW(parseFloat(e.target.value) || 0); setPickedSheet(null); }} />
                  </div>
                  <div>
                    <label className={cls.label}>Height (mm)</label>
                    <input type="number" className={cls.input} value={customH} onChange={(e) => { setCustomH(parseFloat(e.target.value) || 0); setPickedSheet(null); }} />
                  </div>
                </>
              )}
              <div>
                <label className={cls.label}>{isBook ? 'Inside paper' : 'Paper'}</label>
                <select className={cls.select} value={stock} onChange={(e) => setStock(e.target.value)}>
                  {DIGITAL_STOCK_NAMES.map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className={cls.label}>Other extras per copy (GH₵)</label>
                <input type="number" step="0.01" min="0" className={cls.input} value={extra} onChange={(e) => setExtra(parseFloat(e.target.value) || 0)} />
              </div>
              <div className="sm:col-span-2">
                <label className={cls.label}>{isBook ? 'Inside pages printing' : 'Printing'}</label>
                <div className="flex gap-2">{sided(false)}{sided(true)}</div>
              </div>
            </>
          )}

          {isLF && (
            <>
              <div><label className={cls.label}>Width</label><input type="number" step="0.01" className={cls.input} value={lfWidth} onChange={(e) => setLfWidth(parseFloat(e.target.value) || 0)} /></div>
              <div><label className={cls.label}>Height</label><input type="number" step="0.01" className={cls.input} value={lfHeight} onChange={(e) => setLfHeight(parseFloat(e.target.value) || 0)} /></div>
              <div>
                <label className={cls.label}>Unit</label>
                <select className={cls.select} value={lfUnit} onChange={(e) => setLfUnit(e.target.value)}>
                  {Object.keys(UNIT_TO_M).map((u) => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div><label className={cls.label}>Copies (quantity)</label><input type="number" min="1" className={cls.input} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} /></div>
              <div className="sm:col-span-2">
                <label className={cls.label}>Material</label>
                <select className={cls.select} value={activeMat} onChange={(e) => setLfMat(e.target.value)}>
                  {lfMaterials.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
            </>
          )}
        </div>

        {/* Book extras */}
        {isBook && (
          <div className="mt-4 pt-4 border-t border-[var(--t-border)] grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={cls.label}>Inside pages</label>
              <input type="number" min="1" className={cls.input} value={pages} onChange={(e) => setPages(Math.max(1, parseInt(e.target.value) || 1))} />
              <p className="mt-1 text-[10px] text-[var(--t-muted)]">Rounded to nearest {bindType === 'Saddle stitch' ? '4' : '2'}.</p>
            </div>
            <div>
              <label className={cls.label}>Binding</label>
              <select className={cls.select} value={bindType} onChange={(e) => setBindType(e.target.value)}>
                {Object.keys(rates.bind).map((b) => <option key={b}>{b}</option>)}
              </select>
            </div>
            {bindType === 'Perfect bound' && (
              <div>
                <label className={cls.label}>Spine width (mm)</label>
                <input type="number" min="0" className={cls.input} value={spine} onChange={(e) => setSpine(parseFloat(e.target.value) || 0)} />
              </div>
            )}
            <div>
              <label className={cls.label}>Cover paper</label>
              <select className={cls.select} value={coverStock} onChange={(e) => setCoverStock(e.target.value)}>
                {DIGITAL_STOCK_NAMES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={cls.label}>Cover printing</label>
              <div className="flex gap-2">
                {[false, true].map((d) => (
                  <button key={String(d)} type="button" onClick={() => setCovDuplex(d)}
                    className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium border transition-colors ${covDuplex === d ? 'bg-[#6366F1] text-white border-[#6366F1]' : 'bg-[var(--t-bg)] text-[var(--t-text2)] border-[var(--t-border)] hover:border-[var(--t-text2)]'}`}>
                    {d ? 'Double-sided (in + out)' : 'Single-sided (outside)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Sheet comparison ── */}
      {!isLF && (
        <div className={cls.card}>
          <h3 className="text-sm font-semibold text-[var(--t-text1)] mb-3">Parent sheet comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>
                <th className={cls.th + " text-left"}>Sheet</th>
                <th className={cls.th}>Up</th>
                <th className={cls.th}>Sheets</th>
                <th className={cls.th}>Cost</th>
                <th className={cls.th}>Per copy</th>
              </tr></thead>
              <tbody>
                {DIGITAL_SHEET_NAMES.map((name) => {
                  const r       = comparison[name];
                  const isBest  = bestSheet?.name === name;
                  const isPicked = (pickedSheet === name) || (!pickedSheet && isBest);
                  if (!r || r.up === 0) return (
                    <tr key={name}>
                      <td className={cls.td + " text-left"}>{name}</td>
                      <td className={cls.td + " text-[var(--t-muted)]"} colSpan={4}>Doesn't fit</td>
                    </tr>
                  );
                  return (
                    <tr key={name} onClick={() => setPickedSheet(name)}
                      className={`cursor-pointer transition-colors ${isPicked ? 'bg-[#6366F1]/10' : 'hover:bg-[var(--t-bg)]'}`}>
                      <td className={cls.td + " text-left font-medium"}>
                        {name}
                        {isBest && <span className="ml-2 text-[10px] font-semibold text-green-600">★ cheapest</span>}
                      </td>
                      <td className={cls.td}>{r.up}</td>
                      <td className={cls.td}>{r.sheets}</td>
                      <td className={cls.td}>{GHS(r.cost)}</td>
                      <td className={cls.td}>{GHS(r.cost / qty)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[10px] text-[var(--t-muted)]">Tap a row to select that sheet. Count includes waste.</p>
        </div>
      )}

      {/* ── Cover comparison (book) ── */}
      {isBook && (
        <div className={cls.card}>
          <h3 className="text-sm font-semibold text-[var(--t-text1)] mb-3">Cover: parent sheet comparison</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr>
                <th className={cls.th + " text-left"}>Sheet</th><th className={cls.th}>Up</th><th className={cls.th}>Sheets</th><th className={cls.th}>Cost</th>
              </tr></thead>
              <tbody>
                {DIGITAL_SHEET_NAMES.map((name) => {
                  const r = coverComparison[name];
                  if (!r || r.up === 0) return <tr key={name}><td className={cls.td + " text-left"}>{name}</td><td className={cls.td + " text-[var(--t-muted)]"} colSpan={3}>Doesn't fit</td></tr>;
                  return (
                    <tr key={name} className="hover:bg-[var(--t-bg)] transition-colors">
                      <td className={cls.td + " text-left font-medium"}>{name}{bestCover?.name === name && <span className="ml-2 text-[10px] font-semibold text-green-600">★</span>}</td>
                      <td className={cls.td}>{r.up}</td><td className={cls.td}>{r.sheets}</td><td className={cls.td}>{GHS(r.cost)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Quote summary ── */}
      <div className={cls.card}>
        <h3 className="text-sm font-semibold text-[var(--t-text1)] mb-3">Quote</h3>

        {isLF && lfQuote ? (
          <>
            <div className="text-center py-2">
              <p className="text-[10px] text-[var(--t-muted)] mb-1">Total price</p>
              <p className="text-3xl font-bold text-[var(--t-text1)] tabular-nums">{GHS(lfQuote.sell)}</p>
              <p className="text-xs text-[var(--t-muted)] mt-1">{qty} {qty === 1 ? 'piece' : 'pieces'} · {activeMat}</p>
            </div>
          </>
        ) : !isLF && pickedResult ? (
          <>
            <div className="text-center py-2">
              <p className="text-[10px] text-[var(--t-muted)] mb-1">Total price</p>
              <p className="text-3xl font-bold text-[var(--t-text1)] tabular-nums">{GHS(sellPrice)}</p>
              <p className="text-xs text-[var(--t-muted)] mt-1">
                {qty} copies · {GHS(sellPrice / qty)} per copy · {pickedResult.name}
              </p>
            </div>
            <p className="mt-3 text-[11px] text-[var(--t-muted)] text-center">
              {isBook
                ? `${normPages} pp · ${leavesPerCopy} leaf${leavesPerCopy !== 1 ? 'ves' : ''}/copy · ${pickedResult.up}-up${duplex ? ` (${pickedResult.up * 2} pages/sheet)` : ''} · ${qty * leavesPerCopy} pieces ÷ ${pickedResult.up} = ${Math.ceil(qty * leavesPerCopy / pickedResult.up)} sheets, +waste = `
                : `${qty} copies × ${leavesPerCopy} leaf${leavesPerCopy !== 1 ? 'ves' : ''} = ${qty * leavesPerCopy} pieces ÷ ${pickedResult.up} up = ${Math.ceil(qty * leavesPerCopy / pickedResult.up)} sheets, +waste = `}
              <strong>{pickedResult.sheets}</strong>.
            </p>
          </>
        ) : (
          <p className="text-sm text-[var(--t-muted)]">This size doesn't fit on any parent sheet. Try a smaller size.</p>
        )}
      </div>

      {/* ── Layout preview ── */}
      {!isLF && pickedResult?.f && (
        <div className={cls.card}>
          <h3 className="text-sm font-semibold text-[var(--t-text1)] mb-3">Layout preview</h3>
          <div className="flex flex-wrap gap-6">
            <SheetPreview result={pickedResult} sheetDims={rates.sheets[pickedResult.name]} />
            {isBook && bestCover?.f && <SheetPreview result={bestCover} label="Cover" sheetDims={rates.sheets[bestCover.name]} />}
          </div>
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
