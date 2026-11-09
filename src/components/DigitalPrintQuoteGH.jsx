/**
 * DigitalPrintQuoteGH.jsx
 * Digital printing quotation — Ghana
 * A3 Extra / A3 / A4 sheet pricing, imposition calc, banners & stickers per
 * area, fold/binding costs and markup. Quotes save to localStorage and import
 * into InvoiceBuilder the same way the offset quoter does.
 */

import { useState, useMemo, useEffect } from "react";
import { getSettings } from "../lib/settings.js";
import {
  DEFAULT_DIGITAL_RATES, DIGITAL_STOCK_NAMES,
  LAMINATION_NONE, laminationOptions,
  DIGITAL_SIZES, digitalSizeLabel,
  UNIT_JOB_LABELS, isUnitJob, mergeDigitalRates,
} from "../lib/digitalPrintSpecs.js";
import { UNIT_KEYS, convertLength, fmtDims } from "../lib/units.js";
import { computeDigitalQuote } from "../lib/digitalQuoteCalc.js";
import { DigitalQuoteResults } from "./quote/DigitalQuoteResults.jsx";
import { DimensionInput, UnitSelect } from "./DimensionInput.jsx";
import { saveDigitalQuoteToStorage } from "../lib/quoteStorage.js";
import { CustomerPicker } from "./CustomerPicker.jsx";

// ── Constants ──────────────────────────────────────────────────────────────────
const SIZES = DIGITAL_SIZES;   // finished-size presets (mm)

const JOB_PRESETS = {
  flyer:   { size: 'A5 (148×210)',          duplex: false, qty: 500  },
  card:    { size: 'Business card (90×55)', duplex: false, qty: 1000 },
  brochure:{ size: 'A3 flat (420×297)',     duplex: true,  qty: 500  },
  trifold: { size: 'A4 flat (297×210)',     duplex: true,  qty: 500  },
  book:    { size: 'A5 (148×210)',          duplex: true,  qty: 100  },
  banner:  { size: 'A4 (210×297)',          duplex: false, qty: 1    },
  sticker: { size: 'A4 (210×297)',          duplex: false, qty: 100  },
  rollup:  { size: 'A4 (210×297)',          duplex: false, qty: 1    },
  tshirt:  { size: 'A4 (210×297)',          duplex: false, qty: 20   },
  souvenir:{ size: 'A4 (210×297)',          duplex: false, qty: 50   },
  custom:  { size: 'A4 (210×297)',          duplex: false, qty: 500  },
};

const JOB_TYPES = [
  { value: 'flyer',    label: 'Flyer / Leaflet / Poster' },
  { value: 'card',     label: 'Business Card' },
  { value: 'trifold',  label: 'Trifold Brochure' },
  { value: 'book',     label: 'Booklet / Book with cover' },
  { value: 'banner',   label: 'Banner (price per area)' },
  { value: 'sticker',  label: 'Sticker (price per area)' },
  { value: 'rollup',   label: 'Roll-up banner (price per piece)' },
  { value: 'tshirt',   label: 'T-shirt printing (price per piece)' },
  { value: 'souvenir', label: 'Souvenir branding: mugs, cups, pens… (price per piece)' },
  { value: 'custom',   label: 'Other / Custom' },
];
// Bi-fold brochures are no longer offered, but old saved quotes still open.
const LEGACY_JOB_TYPES = [{ value: 'brochure', label: 'Brochure (bi-fold, discontinued)' }];


function genDigitalRef() {
  const d  = new Date();
  const ts = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `DQ-${ts}-${rnd}`;
}

export function buildDigitalSpecSummary(snap) {
  const j = snap.job || {};
  if (isUnitJob(j.jobType)) {
    return `${UNIT_JOB_LABELS[j.jobType]}: ${j.unitItem || '—'} · ${j.qty} piece${j.qty === 1 ? '' : 's'}`;
  }
  const isLF = j.jobType === 'banner' || j.jobType === 'sticker';
  if (isLF) {
    const label = j.jobType === 'banner' ? 'Banner' : 'Sticker';
    return `${label}: ${j.lfWidth}${j.lfUnit} × ${j.lfHeight}${j.lfUnit} · ${j.lfMat}`;
  }
  const sizeLabel = j.sizeKey === 'Custom'
    ? `Custom (${fmtDims(j.customW, j.customH, 'mm', j.dimUnit || 'mm')})`
    : digitalSizeLabel(j.sizeKey, j.dimUnit || 'mm');
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
    if (j.coverStock) parts.push(`Cover ${j.coverStock}${j.covDuplex ? ' (in + out)' : ''}`);
  }
  if (j.lamination && j.lamination !== LAMINATION_NONE) {
    parts.push(`${j.lamination} lamination${j.jobType === 'book' ? ' (cover)' : ''}`);
  }
  if (snap.result?.sheetName) parts.push(snap.result.sheetName);
  return parts.join(' · ');
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
  // Unit sizes are shown/typed in (still stored + priced in mm); saved with the quote
  const [dimUnit,    setDimUnit]    = useState(initJob.dimUnit   || 'mm');
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

  // Lamination (not offered for banners / stickers)
  const [lamination, setLamination] = useState(initJob.lamination || LAMINATION_NONE);

  // Large format
  const [lfWidth,  setLfWidth]  = useState(initJob.lfWidth  || 6);
  const [lfHeight, setLfHeight] = useState(initJob.lfHeight || 3);
  const [lfUnit,   setLfUnit]   = useState(initJob.lfUnit   || 'ft');

  // Changing the banner/sticker unit converts the typed size (20cm → 0.2m)
  function changeLfUnit(next) {
    setLfWidth((w) => convertLength(w, lfUnit, next));
    setLfHeight((h) => convertLength(h, lfUnit, next));
    setLfUnit(next);
  }
  const [lfMat,    setLfMat]    = useState(initJob.lfMat    || '');

  // Per-piece products (roll-up banners, T-shirts, souvenirs)
  const [unitItem, setUnitItem] = useState(initJob.unitItem || '');

  // Selected sheet (null = auto-cheapest)
  const [pickedSheet, setPickedSheet] = useState(null);

  // Load rates from settings
  useEffect(() => {
    getSettings()
      .then((s) => { if (s?.digital_quote_rates) setRates((r) => mergeDigitalRates(s.digital_quote_rates, r)); })
      .catch(() => {});
  }, []);

  function setJobType(type) {
    const pre = JOB_PRESETS[type];
    setJobTypeRaw(type);
    setSizeKey(pre.size);
    setDuplex(pre.duplex);
    setQty(pre.qty);
    setPickedSheet(null);
    setUnitItem('');
    if (type === 'banner') { setLfWidth(6); setLfUnit('ft'); }
    if (type === 'sticker') { setLfWidth(10); setLfHeight(10); setLfUnit('cm'); }
  }

  // Same maths the Accounts cost breakdown re-runs on saved quotes
  const calc = useMemo(() => computeDigitalQuote({
    jobType, sizeKey, customW, customH, qty, stock, duplex, extra,
    pages, bindType, spine, coverStock, covDuplex, lamination,
    lfWidth, lfHeight, lfUnit, lfMat, unitItem, unitCost: initJob.unitItem === unitItem ? initJob.unitCost : undefined,
  }, rates, pickedSheet), [jobType, sizeKey, customW, customH, qty, stock, duplex, extra,
    pages, bindType, spine, coverStock, covDuplex, lamination, lfWidth, lfHeight, lfUnit, lfMat, unitItem,
    initJob.unitItem, initJob.unitCost, rates, pickedSheet]);
  const {
    isUnit, unitItems: unitList, unitQuote,
    isLF, isBook, isFold, pickedResult, lfMaterials, activeMat, lfQuote, totalCost, sellPrice,
  } = calc;
  const flat = isUnit ? unitQuote : isLF ? lfQuote : null;   // quotes not priced per sheet

  // ── Save quote ──────────────────────────────────────────────────────────────
  function handleSave() {
    const isSellable = (isLF || isUnit) ? (flat && flat.sell > 0) : (pickedResult && sellPrice > 0);
    if (!isSellable) { setSaveMsg("Generate a quote first before saving."); return; }

    const cost  = flat ? flat.cost : totalCost;
    const sell  = flat ? flat.sell : sellPrice;
    const mu    = isUnit ? unitQuote.markup : isLF ? rates.lfMarkup : rates.markup;
    const unitFields = isUnit ? { unitItem: unitQuote.item, unitCost: unitQuote.unitCost } : {};

    const description = buildDigitalSpecSummary({
      job: { jobType, sizeKey, customW, customH, qty, stock, duplex, pages, bindType, spine, coverStock, covDuplex, lamination: (isLF || isUnit) ? LAMINATION_NONE : lamination, extra, lfWidth, lfHeight, lfUnit, lfMat: activeMat, dimUnit, ...unitFields },
      result: { sheetName: pickedResult?.name },
    });

    const snapshot = {
      ref:        quoteRef,
      date:       new Date().toISOString().slice(0, 10),
      clientName, clientPhone, clientEmail, jobTitle,
      quoteType:  'digital',
      job: { jobType, sizeKey, customW, customH, qty, stock, duplex, pages, bindType, spine, coverStock, covDuplex, lamination: (isLF || isUnit) ? LAMINATION_NONE : lamination, extra, lfWidth, lfHeight, lfUnit, lfMat: activeMat, dimUnit, ...unitFields },
      result: {
        qty,
        totalCost: cost,
        sellPrice: sell,
        markup:    mu,
        profit:    sell - cost,
        perCopy:   Math.round(sell / qty * 100) / 100,
        isLF,
        isUnit,
        sheetName: (isLF || isUnit) ? null : (pickedResult?.name || null),
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
              {LEGACY_JOB_TYPES.filter((t) => t.value === jobType).map((t) => <option key={t.value} value={t.value} disabled>{t.label}</option>)}
            </select>
          </div>

          {isUnit && (
            <>
              <div className="sm:col-span-2">
                <label className={cls.label}>{jobType === 'rollup' ? 'Material (80 × 200 cm)' : jobType === 'tshirt' ? 'Shirt & print' : 'Item'}</label>
                <select className={cls.select} value={calc.activeItem?.name || unitItem} onChange={(e) => setUnitItem(e.target.value)}>
                  {!calc.activeItem && unitItem && <option value={unitItem}>{unitItem} (no longer listed)</option>}
                  {unitList.map((i) => <option key={i.name} value={i.name}>{i.name} · cost GH₵ {Number(i.cost).toFixed(2)}</option>)}
                </select>
                {unitList.length === 0 && (
                  <p className="mt-1 text-[10px] text-[var(--t-muted)]">No items yet. Add them in Settings → Digital print rates → Priced per piece.</p>
                )}
              </div>
              <div>
                <label className={cls.label}>Quantity (pieces)</label>
                <input type="number" min="1" className={cls.input} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              <div>
                <label className={cls.label}>Other extras per piece (GH₵)</label>
                <input type="number" step="0.01" min="0" className={cls.input} value={extra} onChange={(e) => setExtra(parseFloat(e.target.value) || 0)} />
              </div>
            </>
          )}

          {!isLF && !isUnit && (
            <>
              <div>
                <label className={cls.label}>{isBook ? 'Page size (trim)' : isFold ? 'Flat (open) size' : 'Finished size'}</label>
                <div className="flex gap-2">
                  <select className={cls.select} value={sizeKey} onChange={(e) => { setSizeKey(e.target.value); setPickedSheet(null); }}>
                    {Object.keys(SIZES).map((k) => <option key={k} value={k}>{digitalSizeLabel(k, dimUnit)}</option>)}
                  </select>
                  <UnitSelect value={dimUnit} onChange={setDimUnit} ariaLabel="Size unit" className={cls.select + " !w-auto shrink-0"} />
                </div>
              </div>
              <div>
                <label className={cls.label}>Copies (quantity)</label>
                <input type="number" min="1" className={cls.input} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
              </div>
              {sizeKey === 'Custom' && (
                <>
                  <div>
                    <label className={cls.label}>Width ({dimUnit})</label>
                    <DimensionInput className={cls.input} value={customW} baseUnit="mm" displayUnit={dimUnit}
                      onChange={(v) => { setCustomW(v); setPickedSheet(null); }} />
                  </div>
                  <div>
                    <label className={cls.label}>Height ({dimUnit})</label>
                    <DimensionInput className={cls.input} value={customH} baseUnit="mm" displayUnit={dimUnit}
                      onChange={(v) => { setCustomH(v); setPickedSheet(null); }} />
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
              <div>
                <label className={cls.label}>{isBook ? 'Cover lamination' : 'Lamination'}</label>
                <select className={cls.select} value={lamination} onChange={(e) => setLamination(e.target.value)}>
                  {laminationOptions(rates).map((l) => <option key={l}>{l}</option>)}
                </select>
                {lamination !== LAMINATION_NONE && (
                  <p className="mt-1 text-[10px] text-[var(--t-muted)]">
                    {isBook ? 'Outside of the cover only.' : duplex ? 'Both printed sides.' : 'The printed side.'}
                  </p>
                )}
              </div>
            </>
          )}

          {isLF && (
            <>
              <div><label className={cls.label}>Width ({lfUnit})</label><input type="number" step="any" min="0" className={cls.input} value={lfWidth} onChange={(e) => setLfWidth(parseFloat(e.target.value) || 0)} /></div>
              <div><label className={cls.label}>Height ({lfUnit})</label><input type="number" step="any" min="0" className={cls.input} value={lfHeight} onChange={(e) => setLfHeight(parseFloat(e.target.value) || 0)} /></div>
              <div>
                <label className={cls.label}>Unit</label>
                <UnitSelect value={lfUnit} onChange={changeLfUnit} units={UNIT_KEYS} ariaLabel="Banner or sticker unit" className={cls.select} />
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

      <DigitalQuoteResults calc={calc} qty={qty} duplex={duplex} rates={rates}
        pickedSheet={pickedSheet} onPickSheet={setPickedSheet} />
    </div>
  );
}
