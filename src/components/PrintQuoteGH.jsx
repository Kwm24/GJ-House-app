/**
 * PrintQuoteGH.jsx
 * Offset Printing Quotation System — Ghana
 *
 * Features:
 *  - Sepos & Plates calculation (manual plate entry + auto-calc)
 *  - Paper imposition calc (Standard 30x40 / Nigeria 24x30)
 *  - Multi-quantity columns (preset chips + custom qty input)
 *  - Binding types with individual rates (saddle stitch, perfect, spiral, case, thermal, sewn)
 *  - Lamination types with individual rates
 *  - Company header + logo on printed output
 *  - Auto-generated quote reference number
 *  - Save / Load quotes via localStorage
 *  - @media print CSS — form hidden, clean quote sheet printed
 *  - Ghana VAT 20% (VAT + NHIL + GETFund) toggle
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { User, BookOpen, Settings2, Hash, DollarSign, Zap, Save, Printer, ChevronDown, ChevronUp, ArrowLeft, Info } from "lucide-react";
import { CustomerPicker } from "./CustomerPicker.jsx";
import { saveQuoteToStorage } from "../lib/quoteStorage.js";
import { getSettings } from "../lib/settings.js";
import { fitOnSheet, resolveSheetDims } from "../lib/imposition.js";
import ImpositionAdvisor from "./ImpositionAdvisor.jsx";
import { formatGHS as GHS } from "../lib/currency.js";
import {
  PARENT_SHEETS,
  BOOK_SIZES,
  LAM_TYPES,
  BINDING_TYPES,
  DEFAULT_RATES,
  RATE_GROUPS,
} from "../lib/printSpecs.js";

// ─── PRINT STYLES (injected into <head>) ─────────────────────────────────────
const PRINT_CSS = `
/* Accent colour — overridden at runtime by AccentColorInjector */
:root { --br: #C0392B; }

@media print {
  body { background: #fff !important; margin: 0; }
  .no-print { display: none !important; }
  .print-only { display: block !important; }
  .result-card {
    box-shadow: none !important;
    border: none !important;
    border-radius: 0 !important;
    padding: 0 !important;
    max-width: 100% !important;
    margin: 0 !important;
    background: #fff !important;
  }
  .quote-table th { background: #1C1C1E !important; color: #fff !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .quote-table tr.subtotal-row td { background: #EDE7D9 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .quote-table tr.grand-row td { background: #FAE8E6 !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .cost-bar-wrap { display: none !important; }
  .btn-row { display: none !important; }
  /* Hide individual cost breakdown rows — client only needs the description + totals */
  tr.spec-row { display: none !important; }
  /* Show the client-friendly summary row only in print */
  tr.desc-row { display: table-row !important; }
  @page { margin: 15mm 12mm; size: A4; }
}
@media screen {
  .print-only { display: none !important; }
  /* Hide the print-only description row on screen */
  tr.desc-row { display: none !important; }
}
`;

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const PRESET_QTYS = [500, 1000, 2000, 3000, 4000, 5000];
const VAT_RATE = 0.20;

const PLATE_SIZES = [
  { value: "full_sheet", label: "Full sheet (plate = parent sheet)" },
  { value: "kord64",     label: "Heidelberg KORD 64 (18.1×25.2\")", w: 18.1, h: 25.2 },
  { value: "custom",     label: "Custom plate size" },
];

const DEFAULT_COMPANY = {
  name:    "YOUR PRESS NAME",
  address: "Street Address, City, Ghana",
  phone:   "+233 XX XXX XXXX",
  email:   "email@yourpress.com",
  vatNo:   "VAT REG: XXXXXXXXX",
};

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function genRefNo() {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `Q-${ymd}-${seq}`;
}

function getLamRate(lamType, rates) {
  const found = LAM_TYPES.find(l => l.value === lamType);
  if (!found || !found.rateKey) return 0;
  return rates[found.rateKey] || 0;
}

function getBindingRate(bindType, rates) {
  const found = BINDING_TYPES.find(b => b.value === bindType);
  if (!found) return 0;
  return rates[found.rateKey] || 0;
}

// ─── PAPER CALCULATOR ────────────────────────────────────────────────────────
const SHEETS_PER_REAM = 500;
const COVER_SHEETS_PER_REAM = 100;

function resolveSheet(job) {
  const base = job.parentSheet === "custom"
    ? { w: job.customSheetW, h: job.customSheetH, label: `Custom (${job.customSheetW}×${job.customSheetH}")` }
    : PARENT_SHEETS[job.parentSheet];
  return resolveSheetDims(base, job.parentSheetOrientation);
}

function resolvePlate(job) {
  if (!job.plateSize || job.plateSize === "full_sheet") return null;
  if (job.plateSize === "custom") {
    const w = Number(job.customPlateW), h = Number(job.customPlateH);
    return (w > 0 && h > 0) ? { w, h } : null;
  }
  const found = PLATE_SIZES.find(p => p.value === job.plateSize);
  return found?.w ? { w: found.w, h: found.h } : null;
}

function calcPaper(bookW, bookH, ps, numPages, qty, orientation = "portrait", plate = null, sheetsPerBase = 1) {
  if (!ps || !bookW || !bookH || bookW <= 0 || bookH <= 0) return null;
  const fitArea = plate || ps;
  const fit = fitOnSheet(bookW, bookH, fitArea.w, fitArea.h, undefined, orientation);
  if (!fit) return null;
  const platesPerSheetSide = plate ? Math.max(
    1,
    Math.floor(ps.w / fitArea.w) * Math.floor(ps.h / fitArea.h),
    Math.floor(ps.w / fitArea.h) * Math.floor(ps.h / fitArea.w),
  ) : 1;
  const pagesPerSheetEffective = fit.pagesPerSide * platesPerSheetSide * 2;
  const sheetsPerCopy = Math.ceil(numPages / pagesPerSheetEffective);
  const totalSheets   = sheetsPerCopy * qty;
  // Overs (extra copies for spoilage) are already baked into printRun — no additional wastage factor.
  const reamsNeeded   = Math.ceil(totalSheets / (SHEETS_PER_REAM * Math.max(1, sheetsPerBase)));
  return { ...fit, platesPerSheetSide, pagesPerSheetEffective, sheetsPerCopy, totalSheets, reamsNeeded, sheetsPerBase };
}

function calcCoverPaper(pagesPerSide, qty, reamsSize = COVER_SHEETS_PER_REAM, sheetsPerBase = 1) {
  // A cover occupies 2 page-positions (front + back), so covers per sheet = pagesPerSide ÷ 2.
  // Single vs double-sided only affects plates/impressions, not physical sheet count.
  const coversPerSheet = Math.max(Math.floor(pagesPerSide / 2), 1);
  const totalSheets    = Math.ceil(qty / coversPerSheet);
  const reamsNeeded    = Math.ceil(totalSheets / (Math.max(1, reamsSize) * Math.max(1, sheetsPerBase)));
  return { coversPerSheet, totalSheets, reamsNeeded };
}

// ─── QUOTE CALCULATOR ─────────────────────────────────────────────────────────
function calcQuote(job, rates, qty) {
  const {
    numPages, colours, bookW, bookH,
    hasCover, coverColours, coverSides, laminationType,
    bindingType, applyVAT, seposPlates, useManualPlates,
  } = job;

  const orderedQty = qty;
  const overs      = Math.max(0, parseInt(job.overs) || 0);
  const printRun   = orderedQty + overs;

  // How many custom parent sheets come from one full ream sheet (1 for standard sheets)
  const sheetsPerBase = job.parentSheet === "custom" ? Math.max(1, job.customSheetsPerBase || 1) : 1;
  const paper = calcPaper(bookW, bookH, resolveSheet(job), numPages, printRun, job.printOrientation, resolvePlate(job), sheetsPerBase);
  if (!paper) return null;

  let numPlates;
  if (useManualPlates) {
    numPlates = Math.max(1, parseInt(seposPlates) || 0);
  } else {
    // ceil(numPages / pagesPerSide) gives exact sides needed — avoids over-counting
    // the last form when numPages doesn't fill both sides of the final sheet.
    numPlates = Math.ceil(numPages / paper.pagesPerSide) * Number(colours);
  }
  const plateCost = numPlates * rates.plateRate;
  const paperCost = paper.reamsNeeded * rates.paperRate;
  const impressions    = numPlates;
  const impressionCost = impressions * rates.impressionRate;
  const foldCost = printRun * rates.foldCollateRate;
  const bindingCost = printRun * getBindingRate(bindingType, rates);

  let coverPlateCost = 0, coverPaperCost = 0, coverLamCost = 0,
      coverPaper = null, coverImpressionCost = 0;
  const trimCost = printRun * (rates.trimRate || 0);

  if (hasCover) {
    // double-sided multiplies plates+impressions (2 press runs), not the physical sheet count
    const sides           = coverSides === "double" ? 2 : 1;
    const covPlates       = Number(coverColours) * sides;
    coverPlateCost        = covPlates * rates.coverPlateRate;
    coverImpressionCost   = covPlates * rates.impressionRate;
    coverPaper            = calcCoverPaper(paper.pagesPerSide * paper.platesPerSheetSide, printRun, rates.coverReamSize || COVER_SHEETS_PER_REAM, sheetsPerBase);
    coverPaperCost        = coverPaper.reamsNeeded * rates.coverPaperRate;
    const lamRate         = getLamRate(laminationType, rates);
    coverLamCost          = printRun * lamRate;
  }

  const subtotal  = plateCost + paperCost + impressionCost + trimCost + foldCost + bindingCost
                  + coverPlateCost + coverPaperCost + coverLamCost + coverImpressionCost;
  const margin    = subtotal * (rates.profitMargin / 100);
  const beforeVAT = subtotal + margin;
  const vatAmt    = applyVAT ? beforeVAT * VAT_RATE : 0;
  const grandTotal = beforeVAT + vatAmt;
  const unitPrice  = grandTotal / orderedQty;

  return {
    numPlates, plateCost,
    paper, paperCost,
    impressions, impressionCost,
    trimCost, foldCost, bindingCost,
    coverPlateCost, coverPaperCost, coverLamCost, coverPaper, coverImpressionCost,
    subtotal, margin, beforeVAT, vatAmt, grandTotal, unitPrice,
    overs, printRun, orderedQty,
  };
}

// ─── TAILWIND CLASS CONSTANTS ─────────────────────────────────────────────────
const INP = "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-3.5 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors";
const LBL  = "block text-xs font-medium text-[var(--t-text2)] mb-1.5";
const HINT = "text-xs text-[var(--t-muted)] mt-1.5 italic leading-relaxed";
const CARD = "bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow";
const BTN_PRIMARY = "inline-flex items-center gap-2 rounded-lg bg-[#6366F1] text-white text-sm font-semibold px-5 py-2.5 hover:bg-[#4F46E5] active:translate-y-px focus:outline-none focus:ring-2 focus:ring-[#6366F1] focus:ring-offset-2 disabled:opacity-60 transition-all";
const BTN_SECONDARY = "inline-flex items-center gap-2 rounded-lg border border-[var(--t-border)] text-[var(--t-text2)] text-sm font-medium px-4 py-2 hover:bg-gray-100 dark:hover:bg-white/5 transition-colors";
const INFO_BOX = "rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-700/30 p-3 text-xs text-indigo-700 dark:text-indigo-300";
const chip = (on) => [
  "px-3.5 py-1.5 rounded-full text-xs font-semibold cursor-pointer border transition-all",
  on
    ? "bg-brand-red border-brand-red text-white shadow-sm"
    : "bg-[var(--t-surface)] border-[var(--t-border)] text-[var(--t-text2)] hover:border-brand-red hover:text-brand-red",
].join(" ");

// ─── SECTION HEADER ───────────────────────────────────────────────────────────
function SectionHeader({ icon: Icon, label }) {
  return (
    <div className="flex items-center gap-2.5 mb-4">
      <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-brand-red/10 text-brand-red shrink-0">
        <Icon size={14} />
      </span>
      <span className="text-[10px] font-bold tracking-[0.15em] uppercase text-brand-red">{label}</span>
    </div>
  );
}

// ─── TOGGLE ───────────────────────────────────────────────────────────────────
function Toggle({ on, onToggle, label, sublabel }) {
  return (
    <div className="flex items-center gap-3 cursor-pointer select-none" onClick={onToggle}>
      <button role="switch" aria-checked={on} type="button"
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none ${on ? "bg-[#6366F1]" : "bg-gray-300 dark:bg-gray-600"}`}>
        <span className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? "translate-x-[18px]" : "translate-x-0.5"}`} />
      </button>
      <span className="text-sm text-[var(--t-text1)] font-medium">{label}</span>
      {sublabel && <span className="text-xs text-[var(--t-muted)] hidden sm:inline">{sublabel}</span>}
    </div>
  );
}

// ─── COST BAR ────────────────────────────────────────────────────────────────
function CostBar({ r, qty }) {
  if (!r) return null;
  const items = [
    { label: "Plates",      val: r.plateCost,                              color: "#6366F1" },
    { label: "Paper",       val: r.paperCost,                              color: "#E67E22" },
    { label: "Impressions", val: r.impressionCost,                         color: "#2980B9" },
    { label: "Post-press",  val: (r.trimCost || 0) + r.foldCost + r.bindingCost, color: "#27AE60" },
    { label: "Cover",       val: r.coverPlateCost + r.coverPaperCost + r.coverLamCost + (r.coverImpressionCost || 0), color: "#8E44AD" },
    { label: "Margin",      val: r.margin,                                 color: "#7F8C8D" },
    { label: "VAT",         val: r.vatAmt,                                 color: "#BDC3C7" },
  ].filter(i => i.val > 0);
  const total = items.reduce((s, i) => s + i.val, 0);
  return (
    <div className="cost-bar-wrap mb-5">
      <p className="text-[10px] text-[var(--t-muted)] mb-1.5 tracking-widest uppercase">
        Cost breakdown &mdash; {qty?.toLocaleString()} copies
      </p>
      <div className="flex h-3 rounded-full overflow-hidden gap-px">
        {items.map(i => (
          <div key={i.label} title={`${i.label}: ${GHS(i.val)}`}
            style={{ width: `${(i.val / total) * 100}%`, background: i.color, transition: "width 0.4s" }} />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
        {items.map(i => (
          <span key={i.label} className="text-[10px] text-[var(--t-muted)] flex items-center gap-1">
            <span style={{ width: 7, height: 7, borderRadius: 2, background: i.color, display: "inline-block" }} />
            {i.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function PrintQuoteGH({ embedded = false, csMode = false, initialQuote = null }) {

  useEffect(() => {
    const tag = document.createElement("style");
    tag.textContent = PRINT_CSS;
    document.head.appendChild(tag);
    return () => document.head.removeChild(tag);
  }, []);

  const [job, setJob] = useState({
    clientName: "", clientPhone: "", clientEmail: "", jobTitle: "", invoiceNo: "", date: new Date().toISOString().slice(0, 10),
    numPages: 136, colours: "1",
    bookSize: "A5", bookW: 5.83, bookH: 8.27,
    parentSheet: "standard",
    printOrientation: "portrait",
    parentSheetOrientation: "portrait",
    customSheetW: 25, customSheetH: 38,
    customBaseSheet: "standard",
    customSheetsPerBase: 1,
    plateSize: "full_sheet",
    customPlateW: 18.1, customPlateH: 25.2,
    useManualPlates: false,
    seposPlates: "",
    hasCover: false, coverColours: "4", coverSides: "single",
    laminationType: "none",
    bindingType: "perfect",
    selectedQtys: [1000, 2000],
    customQty: "",
    overs: 0,
    applyVAT: false,
    needsDesign: false,
  });

  const [company, setCompany] = useState(DEFAULT_COMPANY);
  const [companyLogo, setCompanyLogo] = useState("");
  const [termsOfService, setTermsOfService] = useState("");
  const [rates, setRates]             = useState(DEFAULT_RATES);
  const [savedDefaultRates, setSavedDefaultRates] = useState(DEFAULT_RATES);
  const [ratesOpen, setRatesOpen]     = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [quoteRef, setQuoteRef]       = useState("");
  const printRef = useRef(null);

  useEffect(() => {
    if (initialQuote) {
      setJob(initialQuote.job);
      setRates(initialQuote.rates);
      setQuoteRef(initialQuote.ref);
    }
  }, [initialQuote]);

  useEffect(() => {
    getSettings()
      .then((data) => {
        if (!data) return;
        if (data.company_name || data.company_address) {
          setCompany({
            name:    data.company_name    || DEFAULT_COMPANY.name,
            address: data.company_address || DEFAULT_COMPANY.address,
            phone:   data.company_phone   || DEFAULT_COMPANY.phone,
            email:   data.company_email   || DEFAULT_COMPANY.email,
            vatNo:   data.company_vat_no  || DEFAULT_COMPANY.vatNo,
          });
        }
        if (data.company_logo_url) setCompanyLogo(data.company_logo_url);
        if (data.terms_of_service) setTermsOfService(data.terms_of_service);
        if (data.quote_rates) {
          const merged = { ...DEFAULT_RATES, ...data.quote_rates };
          setSavedDefaultRates(merged);
          if (!initialQuote) setRates(merged);
        }
      })
      .catch(() => {});
  }, [initialQuote]);

  const setJ = (k, v) => setJob(j => ({ ...j, [k]: v }));
  const setR = (k, v) => setRates(r => ({ ...r, [k]: Number(v) }));

  const allQtys = useMemo(() => {
    const cq = parseInt(job.customQty);
    const base = [...job.selectedQtys];
    if (cq > 0 && !base.includes(cq)) base.push(cq);
    return base.sort((a, b) => a - b);
  }, [job.selectedQtys, job.customQty]);

  const toggleQty = (q) => {
    setJ("selectedQtys", job.selectedQtys.includes(q)
      ? job.selectedQtys.filter(x => x !== q)
      : [...job.selectedQtys, q].sort((a, b) => a - b));
  };

  const results = useMemo(() => {
    const out = {};
    allQtys.forEach(q => { out[q] = calcQuote(job, rates, q); });
    return out;
  }, [job, rates, allQtys]);

  const paperPreview = useMemo(() => {
    const spb = job.parentSheet === "custom" ? Math.max(1, job.customSheetsPerBase || 1) : 1;
    return calcPaper(job.bookW, job.bookH, resolveSheet(job), job.numPages, allQtys[0] || 1000, job.printOrientation, resolvePlate(job), spb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.bookW, job.bookH, job.parentSheet, job.customSheetW, job.customSheetH,
     job.parentSheetOrientation, job.printOrientation, job.numPages,
     job.plateSize, job.customPlateW, job.customPlateH,
     job.customSheetsPerBase, allQtys]);

  const autoPlates = useMemo(() => {
    if (!paperPreview) return null;
    return Math.ceil(job.numPages / paperPreview.pagesPerSide) * Number(job.colours);
  }, [paperPreview, job.numPages, job.colours]);

  const resultQtys = allQtys.filter(q => results[q]);

  const buildQuoteSnapshot = () => ({
    ref: quoteRef || genRefNo(),
    date: job.date,
    clientName: job.clientName,
    needsDesign: job.needsDesign,
    clientPhone: job.clientPhone,
    clientEmail: job.clientEmail || "",
    jobTitle: job.jobTitle,
    invoiceNo: job.invoiceNo || "",
    job: { ...job },
    rates: { ...rates },
    results: { ...results },
    resultQtys: [...resultQtys],
  });

  const saveQuote = () => {
    if (!resultQtys.length) {
      alert("Please generate the quote first before saving.");
      return;
    }
    const ref = quoteRef || genRefNo();
    if (!quoteRef) setQuoteRef(ref);
    const snapshot = { ...buildQuoteSnapshot(), ref };
    try {
      saveQuoteToStorage(snapshot);
      alert(`Quote ${ref} saved!`);
    } catch { alert("Could not save — localStorage unavailable."); }
  };

  const generate = () => {
    if (!resultQtys.length) { alert("Please check your inputs."); return; }
    if (!quoteRef) setQuoteRef(genRefNo());
    setShowResults(true);
  };

  const downloadPDF = async () => {
    if (!printRef.current) return;
    const html2pdf = (await import("html2pdf.js")).default;
    const filename = `${job.jobTitle || "quote"}-${quoteRef || "draft"}.pdf`.replace(/\s+/g, "-");
    await html2pdf()
      .set({
        margin: 0.4,
        filename,
        image: { type: "jpeg", quality: 0.97 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
      })
      .from(printRef.current)
      .save();
  };

  // Print-critical inline styles only — everything else uses Tailwind classes above
  const S = {
    tbl:     { width: "100%", borderCollapse: "collapse", fontSize: 12 },
    th:      { padding: "8px 10px", background: "#1C1C1E", color: "#F5F0E8", textAlign: "right", fontFamily: "monospace", fontSize: 11, fontWeight: 600 },
    thF:     { textAlign: "left", width: 190 },
    td:      { padding: "6px 10px", borderBottom: "1px solid #E5DFD5", color: "#333", textAlign: "right", fontFamily: "monospace", fontSize: 12 },
    tdF:     { textAlign: "left", fontFamily: "inherit", fontSize: 11, color: "#666" },
    tdSub:   { fontWeight: 700, color: "#1C1C1E", background: "#EDE7D9" },
    tdGrand: { fontWeight: 700, color: "#C0392B", background: "#FAE8E6", fontSize: 14 },
    pill:    (bg) => ({ display: "inline-block", background: bg || "#555", color: "#fff", borderRadius: 10, padding: "1px 7px", fontSize: 10, marginLeft: 6 }),
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen" style={{ background: "var(--t-bg)" }}>
      <div className={`mx-auto px-4 py-6 sm:px-6 transition-all duration-300 ${showResults ? "max-w-6xl" : "max-w-2xl"}`}>

        {!embedded && (
          <div className="text-center mb-8 no-print">
            <p className="text-[10px] font-bold tracking-[0.3em] uppercase text-brand-red mb-2">Jage Press</p>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-[var(--t-text1)] tracking-tight">Offset Printing Quotation</h1>
            <p className="text-sm text-[var(--t-muted)] mt-1">Ghana &middot; Professional Print Cost Calculator</p>
          </div>
        )}

        <div className={showResults ? "lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-6 lg:items-start" : ""}>

          {/* ═══════ FORM ═══════ */}
          <div className="no-print space-y-4">

            {/* Reference bar */}
            <div className={`${CARD} flex items-center justify-between !px-4 !py-3`}>
              <div className="text-sm text-[var(--t-text2)]">
                {quoteRef
                  ? <span className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-widest text-[var(--t-muted)]">Ref</span>
                      <span className="font-mono font-semibold text-[var(--t-text1)]">{quoteRef}</span>
                    </span>
                  : <span className="text-xs italic text-[var(--t-muted)]">No reference yet &mdash; generate quote to assign one</span>
                }
              </div>
              <button onClick={saveQuote} className={BTN_SECONDARY + " !py-1.5 !px-3 text-xs"}>
                <Save size={13} /> Save
              </button>
            </div>

            {/* 01 Client & Job */}
            <div className={CARD}>
              <SectionHeader icon={User} label="01 — Client & Job" />
              {csMode && (
                <div className="flex justify-end -mt-2 mb-4">
                  <CustomerPicker
                    onSelect={({ name, phone, email }) => {
                      setJ("clientName",  name);
                      setJ("clientPhone", phone);
                      if (email) setJ("clientEmail", email);
                    }}
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>Client name</label>
                  <input className={INP} value={job.clientName} onChange={e => setJ("clientName", e.target.value)} placeholder="e.g. Mr. Oppong" />
                </div>
                <div>
                  <label className={LBL}>Phone (WhatsApp)</label>
                  <input className={INP} type="tel" value={job.clientPhone} onChange={e => setJ("clientPhone", e.target.value)} placeholder="0244 123 456" />
                </div>
              </div>
              <div className="mt-3">
                <label className={LBL}>Client email <span className="text-[var(--t-muted)] font-normal">(for sending quote)</span></label>
                <input className={INP} type="email" value={job.clientEmail} onChange={e => setJ("clientEmail", e.target.value)} placeholder="client@email.com" />
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={LBL}>Job title / book name</label>
                  <input className={INP} value={job.jobTitle} onChange={e => setJ("jobTitle", e.target.value)} placeholder="e.g. Elite Mathematics JHS" />
                </div>
                <div>
                  <label className={LBL}>Date</label>
                  <input className={INP} type="date" value={job.date} onChange={e => setJ("date", e.target.value)} />
                </div>
              </div>
              {csMode && (
                <div className="mt-3 max-w-xs">
                  <label className={LBL}>Invoice No. <span className="text-[var(--t-muted)] font-normal">(optional)</span></label>
                  <input className={INP} value={job.invoiceNo} onChange={e => setJ("invoiceNo", e.target.value)} placeholder="INV-2024-001" />
                </div>
              )}
            </div>

            {/* 02 Print Specifications */}
            <div className={CARD}>
              <SectionHeader icon={BookOpen} label="02 — Print Specifications" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>Number of pages</label>
                  <input className={INP} type="number" min={4} step={4} value={job.numPages} onChange={e => setJ("numPages", Number(e.target.value))} />
                </div>
                <div>
                  <label className={LBL}>Colours</label>
                  <select className={INP} value={job.colours} onChange={e => setJ("colours", e.target.value)}>
                    <option value="1">1 colour (black)</option>
                    <option value="2">2 colours</option>
                    <option value="4">4 colours (full colour)</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <div>
                  <label className={LBL}>Book / print size</label>
                  <select className={INP} value={job.bookSize} onChange={e => {
                    const sz = BOOK_SIZES[e.target.value];
                    setJob(j => ({ ...j, bookSize: e.target.value, bookW: sz.w, bookH: sz.h }));
                  }}>
                    {Object.entries(BOOK_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                  </select>
                </div>
                {job.bookSize === "Custom" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LBL}>Width (in)</label>
                      <input className={INP} type="number" step="0.1" value={job.bookW} onChange={e => setJ("bookW", Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LBL}>Height (in)</label>
                      <input className={INP} type="number" step="0.1" value={job.bookH} onChange={e => setJ("bookH", Number(e.target.value))} />
                    </div>
                  </div>
                ) : paperPreview ? (
                  <div className={INFO_BOX + " flex items-start gap-2 self-end"}>
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                      <b>Layout:</b> {paperPreview.pairsAcross}x{paperPreview.rowsDown} = {paperPreview.pagesPerSide} pages/side{paperPreview.rotated ? " (rotated)" : ""}
                      {" · "}{paperPreview.sheetsPerCopy} sheets/copy &middot; {paperPreview.reamsNeeded} reams per {(allQtys[0] || 1000).toLocaleString()} copies
                    </span>
                  </div>
                ) : null}
              </div>
              {job.bookSize === "Custom" && paperPreview && (
                <div className={INFO_BOX + " flex items-start gap-2 mt-3"}>
                  <Info size={13} className="shrink-0 mt-0.5" />
                  <span>Layout: {paperPreview.pairsAcross}x{paperPreview.rowsDown} = {paperPreview.pagesPerSide} pages/side
                    {paperPreview.rotated ? " (rotated)" : ""}{" · "}{paperPreview.sheetsPerCopy} sheets/copy &middot; {paperPreview.reamsNeeded} reams
                  </span>
                </div>
              )}
              <div className="mt-4 border-t border-[var(--t-border)] pt-4">
                <ImpositionAdvisor
                  bookW={job.bookW} bookH={job.bookH} numPages={job.numPages} colours={job.colours}
                  bindingType={job.bindingType} qty={allQtys[0] || 1000} rates={rates}
                  value={job.parentSheet} orientation={job.printOrientation}
                  onOrientationChange={(o) => setJ("printOrientation", o)}
                  sheetOrientation={job.parentSheetOrientation}
                  onSheetOrientationChange={(o) => setJ("parentSheetOrientation", o)}
                  onSelect={(key, custom) => {
                    if (key === "custom" && custom) {
                      setJob(j => ({
                        ...j,
                        parentSheet: "custom",
                        customSheetW: custom.w,
                        customSheetH: custom.h,
                        customBaseSheet: custom.baseSheet || "standard",
                        customSheetsPerBase: custom.sheetsPerBase || 1,
                      }));
                    } else {
                      setJ("parentSheet", key);
                    }
                  }}
                />
              </div>
            </div>

            {/* 03 Production Setup */}
            <div className={CARD}>
              <SectionHeader icon={Settings2} label="03 — Production Setup" />
              <div className="mb-4">
                <label className={LBL}>Press plate size</label>
                <div className="flex flex-wrap gap-2 mt-1.5">
                  {PLATE_SIZES.map(ps => (
                    <button key={ps.value} type="button"
                      className={chip(job.plateSize === ps.value || (!job.plateSize && ps.value === "full_sheet"))}
                      onClick={() => setJ("plateSize", ps.value)}>
                      {ps.label}
                    </button>
                  ))}
                </div>
                {job.plateSize === "custom" && (
                  <div className="grid grid-cols-2 gap-3 mt-3 max-w-sm">
                    <div>
                      <label className={LBL}>Plate width (in)</label>
                      <input className={INP} type="number" step="0.1" value={job.customPlateW} onChange={e => setJ("customPlateW", Number(e.target.value))} />
                    </div>
                    <div>
                      <label className={LBL}>Plate height (in)</label>
                      <input className={INP} type="number" step="0.1" value={job.customPlateH} onChange={e => setJ("customPlateH", Number(e.target.value))} />
                    </div>
                  </div>
                )}
                {resolvePlate(job) && paperPreview && (
                  <div className={INFO_BOX + " flex items-start gap-2 mt-2"}>
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                      {paperPreview.pagesPerSide} pages/plate side &middot; {paperPreview.platesPerSheetSide} plate{paperPreview.platesPerSheetSide !== 1 ? "s" : ""}/sheet side
                      {paperPreview.platesPerSheetSide > 1
                        ? ` → ${paperPreview.pagesPerSheetEffective} pages/sheet (${paperPreview.platesPerSheetSide}-up)`
                        : ` → ${paperPreview.pagesPerSheetEffective} pages/sheet`}
                    </span>
                  </div>
                )}
              </div>
              <hr className="border-[var(--t-border)] my-4" />
              <Toggle on={job.useManualPlates} onToggle={() => setJ("useManualPlates", !job.useManualPlates)} label="Enter plate count manually" />
              {job.useManualPlates ? (
                <div className="mt-3 max-w-xs">
                  <label className={LBL}>Number of plates (sepos)</label>
                  <input className={INP} type="number" min={1} value={job.seposPlates}
                    onChange={e => setJ("seposPlates", e.target.value)} placeholder="e.g. 34" />
                  <p className={HINT}>Enter the exact plate count from your CTP/film output.</p>
                </div>
              ) : (
                <p className={HINT + " mt-2"}>
                  Auto-calculated: <b className="text-[var(--t-text1)] not-italic">{autoPlates ?? "—"} plates</b>
                  {autoPlates && paperPreview && (() => {
                    const sides = Math.ceil(job.numPages / paperPreview.pagesPerSide);
                    return ` (${sides} sides × ${job.colours} colour${Number(job.colours) > 1 ? "s" : ""})`;
                  })()}
                </p>
              )}
              <hr className="border-[var(--t-border)] my-4" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>Binding type</label>
                  <select className={INP} value={job.bindingType} onChange={e => setJ("bindingType", e.target.value)}>
                    {BINDING_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                </div>
                <div className={INFO_BOX + " flex flex-col justify-center"}>
                  <span className="font-medium">{BINDING_TYPES.find(b => b.value === job.bindingType)?.label}</span>
                  <span className="text-sm font-bold mt-0.5">GH&#8373; {getBindingRate(job.bindingType, rates).toFixed(2)}<span className="text-xs font-normal ml-1">/ copy</span></span>
                  {!csMode && <p className={HINT + " text-indigo-500 dark:text-indigo-400 not-italic mt-1"}>Edit rate in Rate Settings below</p>}
                </div>
              </div>
              <hr className="border-[var(--t-border)] my-4" />
              <Toggle on={job.hasCover} onToggle={() => setJ("hasCover", !job.hasCover)} label="Job has a separate cover" />
              {job.hasCover && (
                <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={LBL}>Cover colours</label>
                    <select className={INP} value={job.coverColours} onChange={e => setJ("coverColours", e.target.value)}>
                      <option value="1">1 colour</option>
                      <option value="2">2 colours</option>
                      <option value="4">4 colours (full colour)</option>
                    </select>
                  </div>
                  <div>
                    <label className={LBL}>Cover sides printed</label>
                    <div className="flex gap-2">
                      <button type="button" className={chip(job.coverSides !== "double")} onClick={() => setJ("coverSides", "single")}>Single-sided</button>
                      <button type="button" className={chip(job.coverSides === "double")} onClick={() => setJ("coverSides", "double")}>Double-sided</button>
                    </div>
                  </div>
                  <div>
                    <label className={LBL}>Lamination type</label>
                    <select className={INP} value={job.laminationType} onChange={e => setJ("laminationType", e.target.value)}>
                      {LAM_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                  {job.laminationType !== "none" && (
                    <div>
                      <label className={LBL}>Lam. rate (GHS/copy)</label>
                      <input className={INP + " bg-gray-50 dark:bg-white/5 cursor-not-allowed"}
                        value={getLamRate(job.laminationType, rates).toFixed(2)} readOnly />
                      {!csMode && <p className={HINT}>Edit in Rate Settings below</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 04 Quantities */}
            <div className={CARD}>
              <SectionHeader icon={Hash} label="04 — Quantities to Quote" />
              <div className="flex flex-wrap gap-2 mb-4">
                {PRESET_QTYS.map(q => (
                  <button key={q} type="button" className={chip(job.selectedQtys.includes(q))} onClick={() => toggleQty(q)}>
                    {q.toLocaleString()}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>Custom quantity</label>
                  <input className={INP} type="number" min={1} step={50} value={job.customQty}
                    onChange={e => setJ("customQty", e.target.value)} placeholder="e.g. 750" />
                  {job.customQty && parseInt(job.customQty) > 0 && (
                    <p className="text-xs text-[#6366F1] font-semibold mt-1.5">
                      &#10003; {parseInt(job.customQty).toLocaleString()} copies added
                    </p>
                  )}
                </div>
                <div>
                  <label className={LBL}>Overs / spoilage</label>
                  <input className={INP} type="number" min={0} step={50} value={job.overs}
                    onChange={e => setJ("overs", e.target.value)} placeholder="e.g. 200" />
                  {parseInt(job.overs) > 0 && (
                    <p className={HINT}>Press run = ordered + {parseInt(job.overs).toLocaleString()} overs</p>
                  )}
                </div>
              </div>
              <p className={HINT + " mt-2"}>Extra copies absorb spoilage &mdash; running costs use the full print run; unit price divides by ordered quantity only.</p>
              <hr className="border-[var(--t-border)] my-4" />
              <div className="space-y-3">
                <Toggle on={job.applyVAT} onToggle={() => setJ("applyVAT", !job.applyVAT)}
                  label="Apply Ghana VAT (20%)"
                  sublabel="— VAT 15% + NHIL 2.5% + GETFund 2.5%" />
                <Toggle on={job.needsDesign} onToggle={() => setJ("needsDesign", !job.needsDesign)}
                  label="Job requires design work"
                  sublabel="— CS will send to Design team after approval" />
              </div>
            </div>

            {/* 05 Rate Settings */}
            <div className={CARD}>
              <button type="button" className="flex w-full items-center justify-between" onClick={() => setRatesOpen(o => !o)}>
                <SectionHeader icon={DollarSign} label="05 — Rate Settings (GHS)" />
                <span className="text-[var(--t-muted)] shrink-0 -mt-5">
                  {ratesOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </span>
              </button>
              {ratesOpen && (
                <div className="mt-2">
                  {RATE_GROUPS.map(grp => (
                    <div key={grp.group} className="mb-5">
                      <div className="text-[10px] font-bold tracking-[0.15em] uppercase text-brand-red border-b border-[var(--t-border)] pb-1.5 mb-3 mt-4">
                        {grp.group}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {grp.fields.map(({ key, label }) => (
                          <div key={key}>
                            <label className={LBL}>{label}</label>
                            <input className={INP} type="number" step="0.01" value={rates[key]}
                              onChange={e => setR(key, e.target.value)} />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3 items-end mt-2">
                    <div>
                      <label className={LBL}>Profit margin (%)</label>
                      <input className={INP} type="number" min={0} max={100} value={rates.profitMargin}
                        onChange={e => setR("profitMargin", e.target.value)} />
                    </div>
                    <button className={BTN_SECONDARY} onClick={() => setRates(savedDefaultRates)}>
                      Reset to defaults
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Generate */}
            <div className="text-center pb-6">
              <button onClick={generate} className={BTN_PRIMARY + " text-base px-10 py-3.5"}>
                <Zap size={17} /> Generate Quote
              </button>
            </div>

          </div>{/* end form */}

          {/* ═══════ RESULTS ═══════ */}
          {showResults && resultQtys.length > 0 && (
            <div className="result-card mt-6 lg:mt-0 lg:sticky lg:top-4 bg-brand-cream rounded-xl p-6 sm:p-8"
              style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.12)" }}
              ref={printRef}>

              {/* Company header */}
              <div className="flex justify-between items-start mb-5 pb-4" style={{ borderBottom: "2px solid #1C1C1E" }}>
                <div>
                  {companyLogo && (
                    <img src={companyLogo} alt={company.name}
                      style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain", display: "block", marginBottom: 6 }} />
                  )}
                  <div style={{ fontSize: 20, fontWeight: 800, color: "#1C1C1E", letterSpacing: -0.5 }}>{company.name}</div>
                  <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{company.address}</div>
                  <div style={{ fontSize: 11, color: "#666" }}>{company.phone} &middot; {company.email}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--br, #C0392B)", letterSpacing: 1 }}>PRINTING QUOTATION</div>
                  <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Ref: <b>{quoteRef}</b></div>
                  {job.invoiceNo && <div style={{ fontSize: 12, color: "#555" }}>Invoice: <b>{job.invoiceNo}</b></div>}
                  <div style={{ fontSize: 12, color: "#555" }}>Date: {job.date}</div>
                </div>
              </div>

              {/* Job summary */}
              <div style={{ marginBottom: 16, background: "#EDE7D9", borderRadius: 8, padding: "12px 16px" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "#1C1C1E" }}>{job.jobTitle || "—"}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 3 }}>
                  {job.clientName && <span>Client: <b>{job.clientName}</b> &middot; </span>}
                  {job.numPages} pages &middot; {job.colours === "1" ? "1 colour" : job.colours === "4" ? "Full colour" : "2 colours"} &middot;{" "}
                  {BOOK_SIZES[job.bookSize]?.label || `${job.bookW}"×${job.bookH}"`} &middot; {resolveSheet(job)?.label} &middot;{" "}
                  {BINDING_TYPES.find(b => b.value === job.bindingType)?.label}
                  {job.hasCover && ` · Cover: ${LAM_TYPES.find(l => l.value === job.laminationType)?.label || "No lam."}`}
                </div>
              </div>

              <CostBar r={results[resultQtys[0]]} qty={resultQtys[0]} />

              <div style={{ overflowX: "auto" }}>
                <table className="quote-table" style={S.tbl}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, ...S.thF }}>Item</th>
                      {resultQtys.map(q => <th key={q} style={S.th}>{q.toLocaleString()} copies</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="desc-row">
                      <td colSpan={resultQtys.length + 1} style={{ ...S.tdF, paddingBottom: 14, borderBottom: "1px solid #E0D9CF" }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "#1C1C1E", marginBottom: 4 }}>{job.jobTitle || "Printing Services"}</div>
                        <div style={{ fontSize: 11, color: "#555", lineHeight: "1.7" }}>
                          {job.numPages}-page &middot; {job.colours === "1" ? "1 colour" : job.colours === "4" ? "Full colour" : `${job.colours} colours`} &middot;{" "}
                          {BOOK_SIZES[job.bookSize]?.label || `${job.bookW}"×${job.bookH}"`} &middot; {resolveSheet(job)?.label} &middot;{" "}
                          {BINDING_TYPES.find(b => b.value === job.bindingType)?.label}
                          {job.hasCover && " · With separate cover"}
                          {job.hasCover && job.laminationType !== "none" && ` (${LAM_TYPES.find(l => l.value === job.laminationType)?.label} lamination)`}
                        </div>
                      </td>
                    </tr>
                    <tr className="spec-row">
                      <td style={S.tdF}>Sepos &amp; Plates <span style={S.pill("#555")}>{results[resultQtys[0]]?.numPlates} plates</span></td>
                      {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.plateCost)}</td>)}
                    </tr>
                    <tr className="spec-row">
                      <td style={S.tdF}>Paper {resultQtys.map(q => <span key={q} style={{ ...S.pill("#E67E22"), marginRight: 3 }}>{results[q]?.paper?.reamsNeeded} rms</span>)}</td>
                      {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.paperCost)}</td>)}
                    </tr>
                    <tr className="spec-row">
                      <td style={S.tdF}>Impressions <span style={S.pill("#2980B9")}>{results[resultQtys[0]]?.impressions} impr.</span></td>
                      {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.impressionCost)}</td>)}
                    </tr>
                    {job.hasCover && <>
                      <tr className="spec-row">
                        <td style={S.tdF}>Cover &mdash; Plates</td>
                        {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.coverPlateCost)}</td>)}
                      </tr>
                      <tr className="spec-row">
                        <td style={S.tdF}>Cover &mdash; Impressions <span style={S.pill("#2980B9")}>{job.coverColours} clrs</span></td>
                        {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.coverImpressionCost)}</td>)}
                      </tr>
                      <tr className="spec-row">
                        <td style={S.tdF}>Cover &mdash; Paper {resultQtys.map(q => <span key={q} style={{ ...S.pill("#8E44AD"), marginRight: 3 }}>{results[q]?.coverPaper?.reamsNeeded} rms</span>)}</td>
                        {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.coverPaperCost)}</td>)}
                      </tr>
                      {job.laminationType !== "none" && (
                        <tr className="spec-row">
                          <td style={S.tdF}>Lamination <span style={S.pill("#8E44AD")}>{LAM_TYPES.find(l => l.value === job.laminationType)?.label}</span></td>
                          {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.coverLamCost)}</td>)}
                        </tr>
                      )}
                    </>}
                    <tr className="spec-row"><td style={S.tdF}>Fold &amp; Collate</td>{resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.foldCost)}</td>)}</tr>
                    <tr className="spec-row"><td style={S.tdF}>Trimming</td>{resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.trimCost)}</td>)}</tr>
                    <tr className="spec-row">
                      <td style={S.tdF}>Binding <span style={S.pill("#27AE60")}>{BINDING_TYPES.find(b => b.value === job.bindingType)?.label}</span></td>
                      {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.bindingCost)}</td>)}
                    </tr>
                    <tr className="subtotal-row spec-row">
                      <td style={{ ...S.tdF, ...S.tdSub }}>Subtotal</td>
                      {resultQtys.map(q => <td key={q} style={{ ...S.td, ...S.tdSub }}>{GHS(results[q]?.subtotal)}</td>)}
                    </tr>
                    <tr className="spec-row">
                      <td style={S.tdF}>Profit margin ({rates.profitMargin}%)</td>
                      {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.margin)}</td>)}
                    </tr>
                    <tr className="subtotal-row spec-row">
                      <td style={{ ...S.tdF, ...S.tdSub }}>Total before VAT</td>
                      {resultQtys.map(q => <td key={q} style={{ ...S.td, ...S.tdSub }}>{GHS(results[q]?.beforeVAT)}</td>)}
                    </tr>
                    {job.applyVAT && (
                      <tr>
                        <td style={S.tdF}>VAT @ 20% (VAT + NHIL + GETFund)</td>
                        {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.vatAmt)}</td>)}
                      </tr>
                    )}
                    <tr className="grand-row">
                      <td style={{ ...S.tdF, fontWeight: 800, fontSize: 13, color: "#C0392B" }}>GRAND TOTAL</td>
                      {resultQtys.map(q => <td key={q} style={{ ...S.td, ...S.tdGrand }}>{GHS(results[q]?.grandTotal)}</td>)}
                    </tr>
                    <tr className="grand-row">
                      <td style={{ ...S.tdF, fontWeight: 800, fontSize: 13, color: "#C0392B" }}>
                        UNIT PRICE <span style={{ fontSize: 10, fontWeight: 400, color: "#999" }}>per copy{parseInt(job.overs) > 0 ? ` · incl. ${parseInt(job.overs).toLocaleString()} overs` : ""}</span>
                      </td>
                      {resultQtys.map(q => <td key={q} style={{ ...S.td, ...S.tdGrand, fontSize: 16 }}>{GHS(results[q]?.unitPrice)}</td>)}
                    </tr>
                    <tr style={{ borderTop: "2px solid #E0D9CF" }}>
                      <td style={{ ...S.tdF, fontWeight: 700, color: "#1C1C1E", paddingTop: 10 }}>
                        Deposit required (60%) <span style={{ fontSize: 9, fontWeight: 400, color: "#AAA", marginLeft: 6 }}>payable before production</span>
                      </td>
                      {resultQtys.map(q => <td key={q} style={{ ...S.td, fontWeight: 700, color: "#1C1C1E", paddingTop: 10 }}>{GHS((results[q]?.grandTotal ?? 0) * 0.6)}</td>)}
                    </tr>
                    <tr>
                      <td style={{ ...S.tdF, color: "#666" }}>Balance on delivery</td>
                      {resultQtys.map(q => <td key={q} style={{ ...S.td, color: "#666" }}>{GHS((results[q]?.grandTotal ?? 0) * 0.4)}</td>)}
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid #E0D9CF", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, fontSize: 10, color: "#999" }}>
                <span>This quotation is valid for 14 days from the date of issue.</span>
                {job.applyVAT && <span>{company.vatNo}</span>}
                <span>{company.name} &middot; Ref: {quoteRef}</span>
              </div>

              {termsOfService && (
                <div className="print-only" style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #E0D9CF" }}>
                  <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#999", marginBottom: 4 }}>Terms &amp; Conditions</div>
                  <div style={{ fontSize: 9, color: "#888", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>{termsOfService}</div>
                </div>
              )}

              <div className="btn-row flex flex-wrap gap-3 mt-5 pt-4 border-t border-[#E0D9CF]">
                <button className={BTN_SECONDARY + " bg-white"} onClick={() => setShowResults(false)}>
                  <ArrowLeft size={14} /> Edit quote
                </button>
                <button className={BTN_SECONDARY + " bg-white"} onClick={saveQuote}>
                  <Save size={14} /> Save quote
                </button>
                <button className={BTN_PRIMARY} onClick={downloadPDF}>
                  <Printer size={14} /> Download PDF
                </button>
              </div>

            </div>
          )}

        </div>
      </div>
    </div>
  );
}
