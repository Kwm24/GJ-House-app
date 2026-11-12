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
import { fitOnSheet, fitFlatOnSheet, resolveSheetDims } from "../lib/imposition.js";
import { OffsetQuoteBreakdown } from "./quote/OffsetQuoteBreakdown.jsx";
import ImpositionAdvisor from "./ImpositionAdvisor.jsx";
import { DimensionInput, UnitSelect } from "./DimensionInput.jsx";
import { presetLabel } from "../lib/units.js";
import {
  PARENT_SHEETS,
  BOOK_SIZES,
  LAM_TYPES,
  BINDING_TYPES,
  DEFAULT_RATES,
  RATE_GROUPS,
  offsetSheetLabel,
  SHEET_PRODUCTS, isSheetWork, offsetJobSummary,
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
  { value: "kord64",     label: "Heidelberg KORD 64", w: 18.1, h: 25.2 },   // label + size shown in the chosen unit
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
    ? { w: job.customSheetW, h: job.customSheetH, label: "Custom" }
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

// ─── SHEETWORK (flyers, posters, calendars…) ─────────────────────────────────
// Each copy is `leaves` flat leaves. Every leaf is its own design, imposed
// n-up: sheets per leaf = print run ÷ copies per sheet.
function calcFlatPaper(itemW, itemH, ps, printRun, leaves = 1, plate = null, sheetsPerBase = 1) {
  if (!ps || !itemW || !itemH) return null;
  const fitArea = plate || ps;
  const fit = fitFlatOnSheet(itemW, itemH, fitArea.w, fitArea.h);
  if (!fit) return null;
  const platesPerSheetSide = plate ? Math.max(
    1,
    Math.floor(ps.w / fitArea.w) * Math.floor(ps.h / fitArea.h),
    Math.floor(ps.w / fitArea.h) * Math.floor(ps.h / fitArea.w),
  ) : 1;
  const up            = fit.up * platesPerSheetSide;              // copies of one leaf per sheet
  const sheetsPerLeaf = Math.ceil(printRun / up);
  const totalSheets   = sheetsPerLeaf * leaves;
  const reamsNeeded   = Math.ceil(totalSheets / (SHEETS_PER_REAM * Math.max(1, sheetsPerBase)));
  return {
    ...fit, flat: true, up, platesPerSheetSide, leaves, sheetsPerLeaf, totalSheets, reamsNeeded, sheetsPerBase,
    // Same field names the book layout uses, so shared displays keep working
    pagesPerSide: fit.up, pagesPerSheet: up, pagesPerSheetEffective: up, sheetsPerCopy: leaves / up,
  };
}

function sheetPlates(job) {
  const leaves = Math.max(1, parseInt(job.leaves) || 1);
  const sides  = job.printSides === "double" ? 2 : 1;
  return leaves * sides * Number(job.colours);
}

function calcSheetQuote(job, rates, qty) {
  const orderedQty = qty;
  const overs      = Math.max(0, parseInt(job.overs) || 0);
  const printRun   = orderedQty + overs;
  const leaves     = Math.max(1, parseInt(job.leaves) || 1);
  const sheetsPerBase = job.parentSheet === "custom" ? Math.max(1, job.customSheetsPerBase || 1) : 1;

  const paper = calcFlatPaper(job.bookW, job.bookH, resolveSheet(job), printRun, leaves, resolvePlate(job), sheetsPerBase);
  if (!paper) return null;

  const numPlates = job.useManualPlates ? Math.max(1, parseInt(job.seposPlates) || 0) : sheetPlates(job);
  const plateCost      = numPlates * rates.plateRate;
  const paperCost      = paper.reamsNeeded * rates.paperRate;
  const impressions    = numPlates;
  const impressionCost = impressions * rates.impressionRate;
  const lamCost        = job.laminationType && job.laminationType !== "none" ? printRun * leaves * getLamRate(job.laminationType, rates) : 0;
  const foldCost       = job.folded ? printRun * rates.foldCollateRate : 0;
  const trimCost       = printRun * (rates.trimRate || 0);
  const bindingCost    = job.sheetBinding && job.sheetBinding !== "none" ? printRun * getBindingRate(job.sheetBinding, rates) : 0;

  const subtotal   = plateCost + paperCost + impressionCost + lamCost + foldCost + trimCost + bindingCost;
  const margin     = subtotal * (rates.profitMargin / 100);
  const beforeVAT  = subtotal + margin;
  const vatAmt     = job.applyVAT ? beforeVAT * VAT_RATE : 0;
  const grandTotal = beforeVAT + vatAmt;

  return {
    sheetWork: true,
    numPlates, plateCost, paper, paperCost, impressions, impressionCost,
    lamCost, trimCost, foldCost, bindingCost,
    coverPlateCost: 0, coverPaperCost: 0, coverLamCost: 0, coverPaper: null, coverImpressionCost: 0,
    subtotal, margin, beforeVAT, vatAmt, grandTotal, unitPrice: grandTotal / orderedQty,
    overs, printRun, orderedQty,
  };
}

// ─── QUOTE CALCULATOR ─────────────────────────────────────────────────────────
function calcQuote(job, rates, qty) {
  if (isSheetWork(job)) return calcSheetQuote(job, rates, qty);
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
    workType: "book",            // "book" | "sheet" (flyers, posters, calendars…)
    sheetProduct: "flyer", printSides: "double", leaves: 1, folded: false, sheetBinding: "none",
    numPages: 136, colours: "1",
    bookSize: "A5", bookW: BOOK_SIZES.A5.w, bookH: BOOK_SIZES.A5.h,
    dimUnit: "in",   // unit sizes are shown/typed in; sizes are still stored + priced in inches
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
  // Older saved quotes have no dimUnit — they were always in inches
  const dimUnit = job.dimUnit || "in";
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

  const sheetMode = isSheetWork(job);
  const paperPreview = useMemo(() => {
    const spb = job.parentSheet === "custom" ? Math.max(1, job.customSheetsPerBase || 1) : 1;
    if (isSheetWork(job)) {
      return calcFlatPaper(job.bookW, job.bookH, resolveSheet(job), (allQtys[0] || 1000) + (parseInt(job.overs) || 0),
        Math.max(1, parseInt(job.leaves) || 1), resolvePlate(job), spb);
    }
    return calcPaper(job.bookW, job.bookH, resolveSheet(job), job.numPages, allQtys[0] || 1000, job.printOrientation, resolvePlate(job), spb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [job.bookW, job.bookH, job.parentSheet, job.customSheetW, job.customSheetH,
     job.parentSheetOrientation, job.printOrientation, job.numPages,
     job.plateSize, job.customPlateW, job.customPlateH,
     job.customSheetsPerBase, allQtys, job.workType, job.leaves, job.overs]);

  const autoPlates = useMemo(() => {
    if (!paperPreview) return null;
    if (isSheetWork(job)) return sheetPlates(job);
    return Math.ceil(job.numPages / paperPreview.pagesPerSide) * Number(job.colours);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paperPreview, job.numPages, job.colours, job.workType, job.leaves, job.printSides]);

  // Switching to a sheet product fills in its usual size, sides, leaves, folding, binding
  function pickSheetProduct(value) {
    const p = SHEET_PRODUCTS.find((x) => x.value === value) || SHEET_PRODUCTS[0];
    const sz = BOOK_SIZES[p.size];
    setJob(j => ({
      ...j, workType: "sheet", sheetProduct: p.value, printSides: p.sides, leaves: p.leaves,
      folded: p.folded, sheetBinding: p.binding, hasCover: false,
      bookSize: p.size, bookW: sz.w, bookH: sz.h,
      colours: j.workType === "sheet" ? j.colours : "4",
    }));
  }

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
    saveQuoteToStorage(snapshot)
      .then(() => alert(`Quote ${ref} saved!`))
      .catch(() => alert("Could not save — please try again."));
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
                  <label className={LBL}>{sheetMode ? "Job title" : "Job title / book name"}</label>
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

              {/* Type of work */}
              <div className="mb-4">
                <label className={LBL}>Type of work</label>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={chip(!sheetMode)} onClick={() => setJob(j => ({ ...j, workType: "book" }))}>
                    Books &amp; booklets
                  </button>
                  <button type="button" className={chip(sheetMode)} onClick={() => pickSheetProduct(job.sheetProduct || "flyer")}>
                    Single sheets: flyers, brochures, posters, calendars…
                  </button>
                </div>
              </div>

              {sheetMode && (
                <div className="mb-4">
                  <label className={LBL}>Product</label>
                  <div className="flex flex-wrap gap-2">
                    {SHEET_PRODUCTS.map(p => (
                      <button key={p.value} type="button" className={chip(job.sheetProduct === p.value)} onClick={() => pickSheetProduct(p.value)}>
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {sheetMode ? (
                <div>
                  <label className={LBL}>Printed sides</label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={chip(job.printSides !== "double")} onClick={() => setJ("printSides", "single")}>Single-sided</button>
                    <button type="button" className={chip(job.printSides === "double")} onClick={() => setJ("printSides", "double")}>Double-sided</button>
                  </div>
                </div>
                ) : (
                <div>
                  <label className={LBL}>Number of pages</label>
                  <input className={INP} type="number" min={4} step={4} value={job.numPages} onChange={e => setJ("numPages", Number(e.target.value))} />
                </div>
                )}
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
                  <div className="flex items-end justify-between gap-2">
                    <label className={LBL}>{sheetMode ? "Finished size (flat)" : "Book / print size"}</label>
                    <UnitSelect value={dimUnit} onChange={(u) => setJ("dimUnit", u)} ariaLabel="Size unit"
                      className="mb-1 rounded-md border border-[var(--t-border)] bg-[var(--t-surface)] px-2 py-1 text-xs text-[var(--t-text1)]" />
                  </div>
                  <select className={INP} value={job.bookSize} onChange={e => {
                    const sz = BOOK_SIZES[e.target.value];
                    setJob(j => ({ ...j, bookSize: e.target.value, bookW: sz.w, bookH: sz.h }));
                  }}>
                    {Object.entries(BOOK_SIZES).map(([k, v]) => (
                      <option key={k} value={k}>{k === "Custom" ? "Custom size" : presetLabel(k, v.w, v.h, "in", dimUnit)}</option>
                    ))}
                  </select>
                </div>
                {job.bookSize === "Custom" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={LBL}>Width ({dimUnit})</label>
                      <DimensionInput className={INP} value={job.bookW} baseUnit="in" displayUnit={dimUnit} onChange={v => setJ("bookW", v)} />
                    </div>
                    <div>
                      <label className={LBL}>Height ({dimUnit})</label>
                      <DimensionInput className={INP} value={job.bookH} baseUnit="in" displayUnit={dimUnit} onChange={v => setJ("bookH", v)} />
                    </div>
                  </div>
                ) : paperPreview ? (
                  <div className={INFO_BOX + " flex items-start gap-2 self-end"}>
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                      {paperPreview.flat ? <>
                        <b>Layout:</b> {paperPreview.across}x{paperPreview.down} = {paperPreview.up} per sheet{paperPreview.rotated ? " (rotated)" : ""}
                        {" · "}{paperPreview.totalSheets.toLocaleString()} sheets &middot; {paperPreview.reamsNeeded} reams per {(allQtys[0] || 1000).toLocaleString()} copies
                      </> : <>
                      <b>Layout:</b> {paperPreview.pairsAcross}x{paperPreview.rowsDown} = {paperPreview.pagesPerSide} pages/side{paperPreview.rotated ? " (rotated)" : ""}
                      {" · "}{paperPreview.sheetsPerCopy} sheets/copy &middot; {paperPreview.reamsNeeded} reams per {(allQtys[0] || 1000).toLocaleString()} copies
                      </>}
                    </span>
                  </div>
                ) : null}
              </div>
              {job.bookSize === "Custom" && paperPreview && (
                <div className={INFO_BOX + " flex items-start gap-2 mt-3"}>
                  <Info size={13} className="shrink-0 mt-0.5" />
                  {paperPreview.flat ? (
                    <span>Layout: {paperPreview.across}x{paperPreview.down} = {paperPreview.up} per sheet{paperPreview.rotated ? " (rotated)" : ""}
                      {" · "}{paperPreview.totalSheets.toLocaleString()} sheets &middot; {paperPreview.reamsNeeded} reams
                    </span>
                  ) : (
                  <span>Layout: {paperPreview.pairsAcross}x{paperPreview.rowsDown} = {paperPreview.pagesPerSide} pages/side
                    {paperPreview.rotated ? " (rotated)" : ""}{" · "}{paperPreview.sheetsPerCopy} sheets/copy &middot; {paperPreview.reamsNeeded} reams
                  </span>
                  )}
                </div>
              )}
              {sheetMode && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div>
                    <label className={LBL}>Leaves per copy</label>
                    <input className={INP} type="number" min={1} value={job.leaves}
                      onChange={e => setJ("leaves", Math.max(1, parseInt(e.target.value) || 1))} />
                    <p className={HINT}>Different designs in one copy, e.g. 13 for a wall calendar (12 months + cover). Flyers and posters: 1.</p>
                  </div>
                </div>
              )}
              {sheetMode ? (
                <div className="mt-4 border-t border-[var(--t-border)] pt-4">
                  <SheetworkSheetPicker job={job} rates={rates} qty={(allQtys[0] || 1000) + (parseInt(job.overs) || 0)} unit={dimUnit}
                    onSelect={(key) => setJ("parentSheet", key)} />
                </div>
              ) : (
              <div className="mt-4 border-t border-[var(--t-border)] pt-4">
                <ImpositionAdvisor
                  bookW={job.bookW} bookH={job.bookH} numPages={job.numPages} colours={job.colours}
                  bindingType={job.bindingType} qty={allQtys[0] || 1000} rates={rates}
                  value={job.parentSheet} orientation={job.printOrientation}
                  unit={dimUnit}
                  customSheet={job.parentSheet === "custom" ? {
                    w: job.customSheetW, h: job.customSheetH,
                    baseSheet: job.customBaseSheet, sheetsPerBase: job.customSheetsPerBase,
                  } : null}
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
              )}
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
                      {ps.w ? presetLabel(ps.label, ps.w, ps.h, "in", dimUnit) : ps.label}
                    </button>
                  ))}
                </div>
                {job.plateSize === "custom" && (
                  <div className="grid grid-cols-2 gap-3 mt-3 max-w-sm">
                    <div>
                      <label className={LBL}>Plate width ({dimUnit})</label>
                      <DimensionInput className={INP} value={job.customPlateW} baseUnit="in" displayUnit={dimUnit} onChange={v => setJ("customPlateW", v)} />
                    </div>
                    <div>
                      <label className={LBL}>Plate height ({dimUnit})</label>
                      <DimensionInput className={INP} value={job.customPlateH} baseUnit="in" displayUnit={dimUnit} onChange={v => setJ("customPlateH", v)} />
                    </div>
                  </div>
                )}
                {resolvePlate(job) && paperPreview && (
                  <div className={INFO_BOX + " flex items-start gap-2 mt-2"}>
                    <Info size={13} className="shrink-0 mt-0.5" />
                    <span>
                      {paperPreview.pagesPerSide} {sheetMode ? "copies" : "pages"}/plate side &middot; {paperPreview.platesPerSheetSide} plate{paperPreview.platesPerSheetSide !== 1 ? "s" : ""}/sheet side
                      {paperPreview.platesPerSheetSide > 1
                        ? ` → ${paperPreview.pagesPerSheetEffective} ${sheetMode ? "copies" : "pages"}/sheet (${paperPreview.platesPerSheetSide}-up)`
                        : ` → ${paperPreview.pagesPerSheetEffective} ${sheetMode ? "copies" : "pages"}/sheet`}
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
                  {autoPlates && paperPreview && sheetMode && (() => {
                    const leaves = Math.max(1, parseInt(job.leaves) || 1);
                    return ` (${leaves > 1 ? `${leaves} leaves × ` : ""}${job.printSides === "double" ? 2 : 1} side${job.printSides === "double" ? "s" : ""} × ${job.colours} colour${Number(job.colours) > 1 ? "s" : ""})`;
                  })()}
                  {autoPlates && paperPreview && !sheetMode && (() => {
                    const sides = Math.ceil(job.numPages / paperPreview.pagesPerSide);
                    return ` (${sides} sides × ${job.colours} colour${Number(job.colours) > 1 ? "s" : ""})`;
                  })()}
                </p>
              )}
              <hr className="border-[var(--t-border)] my-4" />
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={LBL}>Binding type</label>
                  {sheetMode ? (
                    <select className={INP} value={job.sheetBinding || "none"} onChange={e => setJ("sheetBinding", e.target.value)}>
                      <option value="none">None</option>
                      {BINDING_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                    </select>
                  ) : (
                  <select className={INP} value={job.bindingType} onChange={e => setJ("bindingType", e.target.value)}>
                    {BINDING_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  )}
                </div>
                <div className={INFO_BOX + " flex flex-col justify-center"}>
                  <span className="font-medium">{(sheetMode && (job.sheetBinding || "none") === "none") ? "No binding" : BINDING_TYPES.find(b => b.value === (sheetMode ? job.sheetBinding : job.bindingType))?.label}</span>
                  <span className="text-sm font-bold mt-0.5">GH&#8373; {(sheetMode ? ((job.sheetBinding || "none") === "none" ? 0 : getBindingRate(job.sheetBinding, rates)) : getBindingRate(job.bindingType, rates)).toFixed(2)}<span className="text-xs font-normal ml-1">/ copy</span></span>
                  {!csMode && <p className={HINT + " text-indigo-500 dark:text-indigo-400 not-italic mt-1"}>Edit rate in Rate Settings below</p>}
                </div>
              </div>
              <hr className="border-[var(--t-border)] my-4" />
              {sheetMode ? (
                <div className="space-y-4">
                  <Toggle on={!!job.folded} onToggle={() => setJ("folded", !job.folded)} label="Folded"
                    sublabel={`— folding at GH₵ ${Number(rates.foldCollateRate || 0).toFixed(2)} per copy`} />
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={LBL}>Lamination</label>
                      <select className={INP} value={job.laminationType} onChange={e => setJ("laminationType", e.target.value)}>
                        {LAM_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                    {job.laminationType !== "none" && (
                      <div className={INFO_BOX + " flex flex-col justify-center"}>
                        <span className="text-sm font-bold">GH&#8373; {getLamRate(job.laminationType, rates).toFixed(2)}<span className="text-xs font-normal ml-1">/ leaf</span></span>
                        <span className="mt-0.5">× {Math.max(1, parseInt(job.leaves) || 1)} lea{Math.max(1, parseInt(job.leaves) || 1) > 1 ? "ves" : "f"} per copy</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (<>
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
              </>)}
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
                  {offsetJobSummary(job, dimUnit, offsetSheetLabel(resolveSheet(job), dimUnit))}
                </div>
              </div>

              <OffsetQuoteBreakdown job={job} rates={rates} results={results} resultQtys={resultQtys}
                descRow={
                  <tr className="desc-row">
                    <td colSpan={resultQtys.length + 1} style={{ textAlign: "left", fontFamily: "inherit", fontSize: 11, color: "#666", paddingBottom: 14, borderBottom: "1px solid #E0D9CF" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1C1C1E", marginBottom: 4 }}>{job.jobTitle || "Printing Services"}</div>
                      <div style={{ fontSize: 11, color: "#555", lineHeight: "1.7" }}>
                        {offsetJobSummary(job, dimUnit, offsetSheetLabel(resolveSheet(job), dimUnit))}
                      </div>
                    </td>
                  </tr>
                } />

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

// ─── SHEETWORK: compare parent sheets ─────────────────────────────────────────
// For flat work the best sheet is simply the one with the lowest paper cost
// for this run (plates and impressions don't depend on the sheet size).
function SheetworkSheetPicker({ job, rates, qty, unit, onSelect }) {
  const leaves = Math.max(1, parseInt(job.leaves) || 1);
  const plate  = resolvePlate(job);
  const rows = Object.entries(PARENT_SHEETS).map(([key, sheet]) => {
    const ps = resolveSheetDims(sheet, job.parentSheetOrientation);
    const p  = calcFlatPaper(job.bookW, job.bookH, ps, qty, leaves, plate, 1);
    return { key, sheet, p, cost: p ? p.reamsNeeded * (rates.paperRate || 0) : Infinity };
  });
  const best = rows.filter(r => r.p).reduce((a, b) => (b.cost < a.cost || (b.cost === a.cost && b.p.up > a.p.up) ? b : a), { cost: Infinity });
  return (
    <div>
      <p className={LBL}>Parent sheet <span className="font-normal text-[var(--t-muted)]">for {qty.toLocaleString()} copies (incl. overs)</span></p>
      <div className="overflow-hidden rounded-lg border border-[var(--t-border)] divide-y divide-[var(--t-border)]">
        {rows.map(({ key, sheet, p, cost }) => {
          const on = job.parentSheet === key;
          return (
            <button key={key} type="button" disabled={!p} onClick={() => onSelect(key)} aria-pressed={on}
              className={`flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs transition-colors disabled:opacity-50 ${on ? "bg-[#6366F1]/10" : "hover:bg-[var(--t-bg)]"}`}>
              <span className="min-w-0">
                <span className="font-semibold text-[var(--t-text1)]">{offsetSheetLabel(sheet, unit)}</span>
                {best.key === key && <span className="ml-2 text-[10px] font-semibold text-green-600">★ cheapest paper</span>}
                <span className="block text-[var(--t-muted)]">
                  {p ? `${p.across}×${p.down} = ${p.up} per sheet${p.rotated ? " (rotated)" : ""} · ${p.totalSheets.toLocaleString()} sheets · ${p.reamsNeeded} reams` : "Doesn't fit"}
                </span>
              </span>
              {p && <span className="shrink-0 font-semibold tabular-nums text-[var(--t-text1)]">GH&#8373; {cost.toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
            </button>
          );
        })}
      </div>
      {job.parentSheet === "custom" && (
        <p className={HINT}>A custom sheet is selected. Pick one above to switch.</p>
      )}
    </div>
  );
}
