/**
 * PrintQuoteGH.jsx
 * Offset Printing Quotation System — Ghana
 *
 * Features:
 *  - Sepos & Plates calculation (manual plate entry + auto-calc)
 *  - Paper imposition calc (Standard 30×40 / Nigeria 24×30)
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
import { useAuth } from "./AuthProvider.jsx";
import { createJob, updateJobStatus, updateJobQuote, markJobSent } from "../lib/jobs.js";
import { buildMailtoUrl, buildWhatsAppUrl } from "../lib/quoteShare.js";
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

// Press plate sizes. "full_sheet" means the plate covers the whole parent sheet
// (current legacy behaviour). Named presses use a specific plate dimension, so
// imposition fits pages onto the plate, not the sheet, and the number of plate
// areas that tile onto one sheet side is calculated separately.
const PLATE_SIZES = [
  { value: "full_sheet", label: "Full sheet (plate = parent sheet)" },
  { value: "kord64",     label: 'Heidelberg KORD 64 (18.1×25.2")', w: 18.1, h: 25.2 },
  { value: "custom",     label: "Custom plate size" },
];

// Company info — edit these
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
const COVER_SHEETS_PER_REAM = 100; // Cover stock comes in 100-sheet reams
const WASTAGE_FACTOR = 1.05;

// Resolves a job's chosen parent sheet to {w, h, label}, handling both the
// built-in catalog keys and the "custom" option set via ImpositionAdvisor,
// then applies the parent sheet orientation (swaps the SHEET's own w/h).
function resolveSheet(job) {
  const base = job.parentSheet === "custom"
    ? { w: job.customSheetW, h: job.customSheetH, label: `Custom (${job.customSheetW}×${job.customSheetH}")` }
    : PARENT_SHEETS[job.parentSheet];
  return resolveSheetDims(base, job.parentSheetOrientation);
}

// Returns a plate object {w, h} when a named press plate is selected,
// or null when "full_sheet" is chosen (plate = parent sheet).
function resolvePlate(job) {
  if (!job.plateSize || job.plateSize === "full_sheet") return null;
  if (job.plateSize === "custom") {
    const w = Number(job.customPlateW), h = Number(job.customPlateH);
    return (w > 0 && h > 0) ? { w, h } : null;
  }
  const found = PLATE_SIZES.find(p => p.value === job.plateSize);
  return found?.w ? { w: found.w, h: found.h } : null;
}

function calcPaper(bookW, bookH, ps, numPages, qty, orientation = "portrait", plate = null) {
  if (!ps || !bookW || !bookH || bookW <= 0 || bookH <= 0) return null;

  // Pages are fitted onto the plate area (or the full sheet when no plate is set).
  const fitArea = plate || ps;
  const fit = fitOnSheet(bookW, bookH, fitArea.w, fitArea.h, undefined, orientation);
  if (!fit) return null;

  // How many plate areas tile onto one parent sheet side?
  // Try both plate orientations (portrait + landscape) and use whichever packs more.
  // When no plate is set this is always 1 (one plate = one sheet).
  const platesPerSheetSide = plate ? Math.max(
    1,
    Math.floor(ps.w / fitArea.w) * Math.floor(ps.h / fitArea.h),   // plate portrait
    Math.floor(ps.w / fitArea.h) * Math.floor(ps.h / fitArea.w),   // plate landscape
  ) : 1;

  // fit.pagesPerSheet = pages per PLATE (front + back) — used for forme/plate count.
  // pagesPerSheetEffective = pages per full PARENT SHEET — used for paper/ream cost.
  const pagesPerSheetEffective = fit.pagesPerSide * platesPerSheetSide * 2;

  const sheetsPerCopy = Math.ceil(numPages / pagesPerSheetEffective);
  const totalSheets   = sheetsPerCopy * qty;
  const withWastage   = Math.ceil(totalSheets * WASTAGE_FACTOR);
  const reamsNeeded   = Math.ceil(withWastage / SHEETS_PER_REAM);

  return { ...fit, platesPerSheetSide, pagesPerSheetEffective, sheetsPerCopy, totalSheets, withWastage, reamsNeeded };
}

// Cover stock imposition. Unlike body pages — where each page-position holds
// DIFFERENT content, so every copy needs its own pass of every forme — a
// cover's front/back artwork is IDENTICAL for every copy. So instead of
// "sheets per copy × qty" (which would massively overcount), this packs
// pagesPerSide identical cover panels per sheet FACE (covers are printed
// single-sided — the inside is left blank) and counts sheets across the
// whole batch: total panels needed ÷ panels that fit per sheet.
function calcCoverPaper(pagesPerSide, qty) {
  const panelsPerCopy = 2; // front cover + back cover
  const panelsPerSheet = Math.max(pagesPerSide, 1);
  const totalPanels   = panelsPerCopy * qty;
  const totalSheets   = Math.ceil(totalPanels / panelsPerSheet);
  const withWastage   = Math.ceil(totalSheets * WASTAGE_FACTOR);
  const reamsNeeded   = Math.ceil(withWastage / COVER_SHEETS_PER_REAM);

  return { panelsPerSheet, totalPanels, totalSheets, withWastage, reamsNeeded };
}

// ─── QUOTE CALCULATOR ─────────────────────────────────────────────────────────
function calcQuote(job, rates, qty) {
  const {
    numPages, colours, bookW, bookH,
    hasCover, coverColours, laminationType,
    bindingType, applyVAT, seposPlates, useManualPlates,
  } = job;

  // Overs: extra copies added to the press run to absorb spoilage / errors.
  // All per-copy running costs (paper, fold, binding, cover paper/lam) use
  // printRun so that those extra sheets are costed. Plates and impression
  // counts don't change — the same formes print regardless of overs.
  // Unit price is always grandTotal ÷ orderedQty so the client sees the real
  // cost per delivered copy, with overs already absorbed.
  const orderedQty = qty;
  const overs      = Math.max(0, parseInt(job.overs) || 0);
  const printRun   = orderedQty + overs;

  const paper = calcPaper(bookW, bookH, resolveSheet(job), numPages, printRun, job.printOrientation, resolvePlate(job));
  if (!paper) return null;

  // ── 1. Sepos & Plates ──
  // Each form has a front and back side. Each side needs one plate PER COLOUR.
  // So: forms × 2 sides × colours = total plates.
  // Plate count is per-forme — independent of overs (same plates print the full run).
  let numPlates;
  if (useManualPlates) {
    numPlates = Math.max(1, parseInt(seposPlates) || 0);
  } else {
    const forms = Math.ceil(numPages / paper.pagesPerSheet);
    numPlates = forms * 2 * Number(colours);
  }
  const plateCost = numPlates * rates.plateRate;

  // ── 2. Paper ──
  const paperCost = paper.reamsNeeded * rates.paperRate;

  // ── 3. Impressions (body) ──
  // numPlates already accounts for colours (forms × 2 sides × colours).
  // Each plate runs once through the machine = 1 impression.
  // Impression count is per-forme — also independent of overs.
  const impressions    = numPlates;
  const impressionCost = impressions * rates.impressionRate;

  // ── 4. Fold & Collate ──
  const foldCost = printRun * rates.foldCollateRate;

  // ── 5. Binding ──
  const bindingCost = printRun * getBindingRate(bindingType, rates);

  // ── 6. Cover ──
  let coverPlateCost = 0, coverPaperCost = 0, coverLamCost = 0,
      coverPaper = null, coverImpressionCost = 0;
  if (hasCover) {
    const covPlates       = Number(coverColours);
    coverPlateCost        = covPlates * rates.coverPlateRate;
    // Cover impressions: one press run per colour on the cover forme.
    coverImpressionCost   = covPlates * rates.impressionRate;
    coverPaper            = calcCoverPaper(paper.pagesPerSide * paper.platesPerSheetSide, printRun);
    coverPaperCost        = coverPaper.reamsNeeded * rates.coverPaperRate;
    const lamRate         = getLamRate(laminationType, rates);
    coverLamCost          = printRun * lamRate;
  }

  const subtotal  = plateCost + paperCost + impressionCost + foldCost + bindingCost
                  + coverPlateCost + coverPaperCost + coverLamCost + coverImpressionCost;
  const margin    = subtotal * (rates.profitMargin / 100);
  const beforeVAT = subtotal + margin;
  const vatAmt    = applyVAT ? beforeVAT * VAT_RATE : 0;
  const grandTotal = beforeVAT + vatAmt;
  // Unit price = total for full print run ÷ ordered qty (overs cost is absorbed).
  const unitPrice  = grandTotal / orderedQty;

  return {
    numPlates, plateCost,
    paper, paperCost,
    impressions, impressionCost,
    foldCost, bindingCost,
    coverPlateCost, coverPaperCost, coverLamCost, coverPaper, coverImpressionCost,
    subtotal, margin, beforeVAT, vatAmt, grandTotal, unitPrice,
    overs, printRun, orderedQty,
  };
}

// ─── COST BAR ────────────────────────────────────────────────────────────────
function CostBar({ r, qty }) {
  if (!r) return null;
  const items = [
    { label: "Plates",      val: r.plateCost,                              color: "#C0392B" },
    { label: "Paper",       val: r.paperCost,                              color: "#E67E22" },
    { label: "Impressions", val: r.impressionCost,                         color: "#2980B9" },
    { label: "Post-press",  val: r.foldCost + r.bindingCost,               color: "#27AE60" },
    { label: "Cover",       val: r.coverPlateCost + r.coverPaperCost + r.coverLamCost + (r.coverImpressionCost || 0), color: "#8E44AD" },
    { label: "Margin",      val: r.margin,                                 color: "#7F8C8D" },
    { label: "VAT",         val: r.vatAmt,                                 color: "#BDC3C7" },
  ].filter(i => i.val > 0);
  const total = items.reduce((s, i) => s + i.val, 0);
  return (
    <div className="cost-bar-wrap" style={{ marginBottom: 20 }}>
      <p style={{ fontSize: 10, color: "#888", marginBottom: 5, letterSpacing: 1, textTransform: "uppercase" }}>
        Cost breakdown — {qty?.toLocaleString()} copies
      </p>
      <div style={{ display: "flex", height: 12, borderRadius: 6, overflow: "hidden", gap: 1 }}>
        {items.map(i => (
          <div key={i.label} title={`${i.label}: ${GHS(i.val)}`}
            style={{ width: `${(i.val / total) * 100}%`, background: i.color, transition: "width 0.4s" }} />
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 6 }}>
        {items.map(i => (
          <span key={i.label} style={{ fontSize: 10, color: "#999", display: "flex", alignItems: "center", gap: 3 }}>
            <span style={{ width: 7, height: 7, borderRadius: 1, background: i.color, display: "inline-block" }} />
            {i.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function PrintQuoteGH({ embedded = false, csMode = false, initialQuote = null }) {

  // Inject print CSS once
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
    printOrientation: "portrait",       // how the book PAGE sits on the sheet
    parentSheetOrientation: "portrait", // how the parent sheet itself is fed
    customSheetW: 25, customSheetH: 38, // used only when parentSheet === "custom"
    // Press plate size
    plateSize: "full_sheet",            // "full_sheet" | "kord64" | "custom"
    customPlateW: 18.1, customPlateH: 25.2,
    // Sepos & Plates
    useManualPlates: false,
    seposPlates: "",        // manual plate count
    // Cover
    hasCover: false, coverColours: "4",
    laminationType: "none",
    bindingType: "perfect",
    // Quantities
    selectedQtys: [1000, 2000],
    customQty: "",           // custom quantity input
    overs: 0,               // extra copies added to press run to absorb spoilage
    // VAT
    applyVAT: false,
    // Workflow — does this job need design work before it goes to production?
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
  const [approving, setApproving]     = useState(false);
  const [approveMsg, setApproveMsg]   = useState("");
  const [jobId, setJobId]             = useState(null);
  const printRef = useRef(null);
  const { user } = useAuth();

  // Preload a quote passed in from the saved-quotes list, if any.
  useEffect(() => {
    if (initialQuote) {
      setJob(initialQuote.job);
      setRates(initialQuote.rates);
      setQuoteRef(initialQuote.ref);
      // Restore the Supabase job ID so re-approving updates the existing row
      // rather than creating a duplicate job.
      setJobId(initialQuote.jobId ?? null);
    }
  }, [initialQuote]);

  // Pull the admin-configured rate defaults. A saved quote keeps the rates
  // it was created with, but new quotes start from whatever Admin has set
  // in Settings (falling back to the built-in defaults if never configured).
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

  // All active quantities = presets + custom (if valid and not duplicate)
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

  // Results — recalculate live whenever job or rates change
  const results = useMemo(() => {
    const out = {};
    allQtys.forEach(q => { out[q] = calcQuote(job, rates, q); });
    return out;
  }, [job, rates, allQtys]);

  const paperPreview = useMemo(() =>
    calcPaper(job.bookW, job.bookH, resolveSheet(job), job.numPages, allQtys[0] || 1000, job.printOrientation, resolvePlate(job)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [job.bookW, job.bookH, job.parentSheet, job.customSheetW, job.customSheetH,
     job.parentSheetOrientation, job.printOrientation, job.numPages,
     job.plateSize, job.customPlateW, job.customPlateH, allQtys]
  );

  // Auto-calc plates for display in form hint
  const autoPlates = useMemo(() => {
    if (!paperPreview) return null;
    const forms = Math.ceil(job.numPages / paperPreview.pagesPerSheet);
    return forms * 2 * Number(job.colours);
  }, [paperPreview, job.numPages, job.colours]);

  const resultQtys = allQtys.filter(q => results[q]);

  const buildQuoteSnapshot = () => ({
    ref: quoteRef || genRefNo(),
    date: job.date,
    clientName: job.clientName,
    clientPhone: job.clientPhone,
    clientEmail: job.clientEmail || "",
    jobTitle: job.jobTitle,
    invoiceNo: job.invoiceNo || "",
    job: { ...job },
    rates: { ...rates },
    results: { ...results },
    resultQtys: [...resultQtys],
    // Persisted so a loaded saved quote can link back to its existing job row.
    jobId: jobId || null,
  });

  // Creates the job row on first send/approve; later calls reuse it.
  async function ensureJobId(status) {
    if (jobId) return jobId;
    const ref = quoteRef || genRefNo();
    if (!quoteRef) setQuoteRef(ref);
    const snapshot = { ...buildQuoteSnapshot(), ref };
    const job = await createJob(user.id, snapshot, status);
    setJobId(job.id);
    return job.id;
  }

  // Payment confirmed for this quote — this is what other lobbies use to
  // decide a job is real, not the act of sending it to the client.
  // CS decides here whether the job needs design work first (routes to the
  // Designer lobby) or goes straight to Production.
  async function handleApproveQuote() {
    if (!user) {
      setApproveMsg("You must be signed in to approve quotes.");
      return;
    }
    if (!resultQtys.length) return;

    setApproving(true);
    setApproveMsg("");

    try {
      const finalStatus = job.needsDesign ? "ready_for_design" : "approved";
      const snapshot = buildQuoteSnapshot();
      const id = await ensureJobId(finalStatus);

      // If the job already existed (loaded from saved quotes), sync any
      // edits (new quantities, rates, specs) back to the Supabase job row.
      if (jobId) await updateJobQuote(id, { ...snapshot, ref: quoteRef });

      const updatedJob = await updateJobStatus(id, finalStatus);

      // Auto-save to saved quotes with the job ID embedded so future
      // edits can find and update the correct job row.
      saveQuoteToStorage({ ...snapshot, jobId: id });

      const deposit = `Deposit: GH₵ ${Number(updatedJob.deposit_amount).toFixed(2)}`;
      setApproveMsg(
        job.needsDesign
          ? `Quote ${updatedJob.quote_ref} approved and sent to design. ${deposit}`
          : `Quote ${updatedJob.quote_ref} approved. ${deposit}`
      );
    } catch (err) {
      setApproveMsg(err.message ?? "Could not approve quote.");
    } finally {
      setApproving(false);
    }
  }

  // Prints/saves the PDF first so the client receives an attachment,
  // then opens the communication channel after the print dialog is closed.
  function handleSendEmail() {
    const snapshot = buildQuoteSnapshot();
    window.print();
    setTimeout(() => {
      // Use the client's email as the recipient if it's been filled in.
      window.location.href = buildMailtoUrl(snapshot, job.clientEmail || "");
      if (user) {
        ensureJobId("sent").then((id) => markJobSent(id, "email")).catch(() => {});
      }
    }, 500);
  }

  function handleSendWhatsApp() {
    const snapshot = buildQuoteSnapshot();
    window.print();
    setTimeout(() => {
      window.open(buildWhatsAppUrl(snapshot), "_blank", "noopener,noreferrer");
      if (user) {
        ensureJobId("sent").then((id) => markJobSent(id, "whatsapp")).catch(() => {});
      }
    }, 500);
  }

  // ── Save quote ──
  // Uses buildQuoteSnapshot() so results & resultQtys are included —
  // required for the Invoice tab's "Import from print quote" feature.
  const saveQuote = () => {
    if (!resultQtys.length) {
      alert("Please generate the quote first (click Generate quote →) before saving.");
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

  // ── Generate ──
  const generate = () => {
    if (!resultQtys.length) { alert("Please check your inputs."); return; }
    if (!quoteRef) setQuoteRef(genRefNo());
    setShowResults(true);
  };

  // ─── STYLES ────────────────────────────────────────────────────────────────
  const S = {
    app:     { minHeight: "100vh", background: "#1C1C1E", fontFamily: "'Inter','Segoe UI',sans-serif", padding: "24px 16px" },
    wrap:    { maxWidth: 980, margin: "0 auto" },
    hdr:     { textAlign: "center", marginBottom: 28 },
    eye:     { fontSize: 11, letterSpacing: 3, color: "#C0392B", textTransform: "uppercase", marginBottom: 6 },
    title:   { fontSize: 26, fontWeight: 700, color: "#F5F0E8", margin: 0 },
    sub:     { fontSize: 12, color: "#888", marginTop: 3 },
    card:    { background: "#F5F0E8", borderRadius: 12, padding: "22px", marginBottom: 14 },
    cTitle:  { fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#C0392B", marginBottom: 14, fontWeight: 600 },
    g2:      { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
    g3:      { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
    g4:      { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 },
    lbl:     { fontSize: 11, color: "#666", marginBottom: 3, display: "block", fontWeight: 500 },
    inp:     { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #D4CFC8", background: "#fff", fontSize: 13, color: "#1C1C1E", boxSizing: "border-box", fontFamily: "inherit" },
    sel:     { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid #D4CFC8", background: "#fff", fontSize: 13, color: "#1C1C1E", boxSizing: "border-box", fontFamily: "inherit" },
    div:     { borderTop: "1.5px solid #E0D9CF", margin: "16px 0" },
    chip:    (on) => ({ padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "1.5px solid " + (on ? "#C0392B" : "#D4CFC8"), background: on ? "#C0392B" : "#fff", color: on ? "#fff" : "#666", transition: "all .15s" }),
    tog:     (on) => ({ display: "inline-block", width: 40, height: 22, borderRadius: 11, background: on ? "#C0392B" : "#CCC", position: "relative", cursor: "pointer", transition: "background .2s", flexShrink: 0 }),
    togDot:  (on) => ({ position: "absolute", top: 3, left: on ? 20 : 3, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left .2s" }),
    togRow:  { display: "flex", alignItems: "center", gap: 10 },
    hint:    { fontSize: 11, color: "#888", marginTop: 4, fontStyle: "italic" },
    btn:     { padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, fontFamily: "inherit" },
    btnP:    { background: "#C0392B", color: "#fff" },
    btnS:    { background: "#E0D9CF", color: "#444" },
    // Results
    rCard:   { background: "#F5F0E8", borderRadius: 12, padding: "28px", marginBottom: 14 },
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
    <div style={S.app}>
      <div style={S.wrap}>

        {/* ── Header ── */}
        {!embedded && (
        <div style={S.hdr} className="no-print">
          <div style={S.eye}>⬛ PrintQuote GH</div>
          <h1 style={S.title}>Offset Printing Quotation</h1>
          <p style={S.sub}>Ghana · Professional Print Cost Calculator</p>
        </div>
        )}

        {/* ── Quote Reference Bar ── */}
        <div style={{ ...S.card, padding: "14px 22px" }} className="no-print">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 12, color: "#666" }}>
              {quoteRef
                ? <span>Ref: <b style={{ color: "#1C1C1E" }}>{quoteRef}</b></span>
                : <span style={{ color: "#AAA" }}>No reference yet — generate quote to assign one</span>}
            </div>
            <button style={{ ...S.btn, ...S.btnS, padding: "7px 16px" }} onClick={saveQuote}>
              💾 Save
            </button>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════
            FORM SECTION
        ══════════════════════════════════════════════════════ */}
        <div className="no-print">

          {/* ── 01 Job Details ── */}
          <div style={S.card}>
            <div style={S.cTitle}>01 — Job details</div>
            <div style={S.g2}>
              <div><label style={S.lbl}>Client name</label><input style={S.inp} value={job.clientName} onChange={e => setJ("clientName", e.target.value)} placeholder="e.g. Mr. Oppong" /></div>
              <div><label style={S.lbl}>Client phone (WhatsApp)</label><input style={S.inp} type="tel" value={job.clientPhone} onChange={e => setJ("clientPhone", e.target.value)} placeholder="e.g. 0244 123 456" /></div>
            </div>
            <div style={{ ...S.g2, marginTop: 12 }}>
              <div>
                <label style={S.lbl}>Client email <span style={{ color: "#AAA", fontWeight: 400 }}>(for sending quote)</span></label>
                <input style={S.inp} type="email" value={job.clientEmail} onChange={e => setJ("clientEmail", e.target.value)} placeholder="e.g. client@email.com" />
              </div>
            </div>
            <div style={{ ...S.g2, marginTop: 12 }}>
              <div>
                <label style={S.lbl}>Job title / book name</label>
                <input style={S.inp} value={job.jobTitle} onChange={e => setJ("jobTitle", e.target.value)} placeholder="e.g. Elite Mathematics JHS" />
              </div>
              <div><label style={S.lbl}>Date</label><input style={S.inp} type="date" value={job.date} onChange={e => setJ("date", e.target.value)} /></div>
            </div>
            {csMode && (
              <div style={{ ...S.g2, marginTop: 12 }}>
                <div>
                  <label style={S.lbl}>Invoice No. <span style={{ color: "#AAA", fontWeight: 400 }}>(optional)</span></label>
                  <input style={S.inp} value={job.invoiceNo} onChange={e => setJ("invoiceNo", e.target.value)} placeholder="e.g. INV-2024-001" />
                </div>
              </div>
            )}

            <div style={S.div} />

            {/* Paper & size */}
            <div style={S.g2}>
              <div><label style={S.lbl}>Number of pages</label><input style={S.inp} type="number" min={4} step={4} value={job.numPages} onChange={e => setJ("numPages", Number(e.target.value))} /></div>
              <div><label style={S.lbl}>Colours</label>
                <select style={S.sel} value={job.colours} onChange={e => setJ("colours", e.target.value)}>
                  <option value="1">1 colour (black)</option>
                  <option value="2">2 colours</option>
                  <option value="4">4 colours (full colour)</option>
                </select>
              </div>
            </div>

            {/* Parent sheet — ranked cheapest-first by the imposition advisor */}
            <div style={{ marginTop: 12 }}>
              <ImpositionAdvisor
                bookW={job.bookW}
                bookH={job.bookH}
                numPages={job.numPages}
                colours={job.colours}
                bindingType={job.bindingType}
                qty={allQtys[0] || 1000}
                rates={rates}
                value={job.parentSheet}
                orientation={job.printOrientation}
                onOrientationChange={(o) => setJ("printOrientation", o)}
                sheetOrientation={job.parentSheetOrientation}
                onSheetOrientationChange={(o) => setJ("parentSheetOrientation", o)}
                onSelect={(key, custom) => {
                  if (key === "custom" && custom) {
                    setJob(j => ({ ...j, parentSheet: "custom", customSheetW: custom.w, customSheetH: custom.h }));
                  } else {
                    setJ("parentSheet", key);
                  }
                }}
              />
            </div>

            <div style={{ ...S.g2, marginTop: 12 }}>
              <div>
                <label style={S.lbl}>Book / print size</label>
                <select style={S.sel} value={job.bookSize} onChange={e => {
                  const sz = BOOK_SIZES[e.target.value];
                  setJob(j => ({ ...j, bookSize: e.target.value, bookW: sz.w, bookH: sz.h }));
                }}>
                  {Object.entries(BOOK_SIZES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              {job.bookSize === "Custom" ? (
                <div style={S.g2}>
                  <div><label style={S.lbl}>Width (inches)</label><input style={S.inp} type="number" step="0.1" value={job.bookW} onChange={e => setJ("bookW", Number(e.target.value))} /></div>
                  <div><label style={S.lbl}>Height (inches)</label><input style={S.inp} type="number" step="0.1" value={job.bookH} onChange={e => setJ("bookH", Number(e.target.value))} /></div>
                </div>
              ) : paperPreview ? (
                <div style={{ background: "#E8F4FD", border: "1px solid #B8D9F0", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#2471A3" }}>
                  <b>📄 Paper layout:</b><br />
                  {paperPreview.pairsAcross} pairs × {paperPreview.rowsDown} rows = {paperPreview.pagesPerSide} pages/{resolvePlate(job) ? "plate side" : "sheet side"}
                  {paperPreview.rotated && " (rotated)"}<br />
                  {resolvePlate(job) && paperPreview.platesPerSheetSide > 1 && (
                    <>{paperPreview.platesPerSheetSide} plates/sheet side → {paperPreview.pagesPerSheetEffective} pages/sheet · </>
                  )}
                  {paperPreview.sheetsPerCopy} sheets/copy · {paperPreview.reamsNeeded} reams per {(allQtys[0] || 1000).toLocaleString()} copies
                </div>
              ) : null}
            </div>
          </div>

          {/* ── 02 Sepos & Plates ── */}
          <div style={S.card}>
            <div style={S.cTitle}>02 — Sepos &amp; plates</div>

            {/* Press plate size */}
            <div style={{ marginBottom: 16 }}>
              <label style={S.lbl}>Press plate size</label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 6 }}>
                {PLATE_SIZES.map(ps => (
                  <button
                    key={ps.value}
                    type="button"
                    style={S.chip(job.plateSize === ps.value || (!job.plateSize && ps.value === "full_sheet"))}
                    onClick={() => setJ("plateSize", ps.value)}
                  >
                    {ps.label}
                  </button>
                ))}
              </div>

              {/* Custom plate dimensions */}
              {job.plateSize === "custom" && (
                <div style={{ ...S.g2, marginTop: 10, maxWidth: 340 }}>
                  <div>
                    <label style={S.lbl}>Plate width (inches)</label>
                    <input style={S.inp} type="number" step="0.1" value={job.customPlateW}
                      onChange={e => setJ("customPlateW", Number(e.target.value))} />
                  </div>
                  <div>
                    <label style={S.lbl}>Plate height (inches)</label>
                    <input style={S.inp} type="number" step="0.1" value={job.customPlateH}
                      onChange={e => setJ("customPlateH", Number(e.target.value))} />
                  </div>
                </div>
              )}

              {/* Live plate-per-sheet feedback */}
              {resolvePlate(job) && paperPreview && (
                <div style={{ marginTop: 8, background: "#E8F4FD", border: "1px solid #B8D9F0", borderRadius: 8, padding: "8px 12px", fontSize: 11, color: "#2471A3" }}>
                  {paperPreview.pagesPerSide} pages/plate side · {paperPreview.platesPerSheetSide} plate{paperPreview.platesPerSheetSide !== 1 ? "s" : ""}/sheet side
                  {paperPreview.platesPerSheetSide > 1
                    ? ` → ${paperPreview.pagesPerSheetEffective} pages/sheet (${paperPreview.platesPerSheetSide}-up printing)`
                    : ` → ${paperPreview.pagesPerSheetEffective} pages/sheet`
                  }
                </div>
              )}
            </div>

            <div style={S.div} />

            {/* Manual plate override */}
            <div style={S.togRow}>
              <div style={S.tog(job.useManualPlates)} onClick={() => setJ("useManualPlates", !job.useManualPlates)}>
                <div style={S.togDot(job.useManualPlates)} />
              </div>
              <span style={{ fontSize: 13, color: "#333" }}>Enter plate count manually</span>
            </div>

            {job.useManualPlates ? (
              <div style={{ marginTop: 12, maxWidth: 220 }}>
                <label style={S.lbl}>Number of plates (sepos)</label>
                <input style={S.inp} type="number" min={1} value={job.seposPlates}
                  onChange={e => setJ("seposPlates", e.target.value)}
                  placeholder="e.g. 34" />
                <p style={S.hint}>Enter the exact plate count from your CTP/film output.</p>
              </div>
            ) : (
              <p style={{ ...S.hint, marginTop: 8 }}>
                Auto-calculated: <b style={{ color: "#1C1C1E" }}>{autoPlates ?? "—"} plates</b>
                {autoPlates && paperPreview && (() => {
                  const forms = Math.ceil(job.numPages / paperPreview.pagesPerSheet);
                  const isPlateMode = !!resolvePlate(job);
                  return ` (${forms} ${isPlateMode ? "plate formes" : "forms"} × 2 sides × ${job.colours} colour${Number(job.colours) > 1 ? "s" : ""})`;
                })()}
              </p>
            )}
          </div>

          {/* ── 03 Binding & Cover ── */}
          <div style={S.card}>
            <div style={S.cTitle}>03 — Binding &amp; cover</div>

            {/* Binding type */}
            <div style={S.g2}>
              <div>
                <label style={S.lbl}>Binding type</label>
                <select style={S.sel} value={job.bindingType} onChange={e => setJ("bindingType", e.target.value)}>
                  {BINDING_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </div>
              <div style={{ background: "#E8F4FD", border: "1px solid #B8D9F0", borderRadius: 8, padding: "10px 14px", fontSize: 11, color: "#2471A3" }}>
                <b>Selected rate:</b><br />
                {BINDING_TYPES.find(b => b.value === job.bindingType)?.label}<br />
                <span style={{ fontSize: 13, fontWeight: 700 }}>GH₵ {getBindingRate(job.bindingType, rates).toFixed(2)}</span>
                <span style={{ fontSize: 10, color: "#5DADE2" }}> per copy</span>
                {!csMode && <p style={{ ...S.hint, color: "#5DADE2", marginTop: 4 }}>Edit rate in Rate Settings below</p>}
              </div>
            </div>

            <div style={S.div} />

            {/* Separate cover toggle */}
            <div style={{ ...S.togRow, cursor: "pointer" }} onClick={() => setJ("hasCover", !job.hasCover)}>
              <div style={S.tog(job.hasCover)}><div style={S.togDot(job.hasCover)} /></div>
              <span style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>Job has a separate cover</span>
            </div>

            {job.hasCover && (
              <div style={{ marginTop: 14 }}>
                <div style={S.g3}>
                  <div>
                    <label style={S.lbl}>Cover colours</label>
                    <select style={S.sel} value={job.coverColours} onChange={e => setJ("coverColours", e.target.value)}>
                      <option value="1">1 colour</option>
                      <option value="2">2 colours</option>
                      <option value="4">4 colours (full colour)</option>
                    </select>
                  </div>
                  <div>
                    <label style={S.lbl}>Lamination type</label>
                    <select style={S.sel} value={job.laminationType} onChange={e => setJ("laminationType", e.target.value)}>
                      {LAM_TYPES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                  </div>
                  {job.laminationType !== "none" && (
                    <div>
                      <label style={S.lbl}>Lam. rate (GHS/copy)</label>
                      <input style={{ ...S.inp, background: "#EDE7D9", color: "#666" }}
                        value={getLamRate(job.laminationType, rates).toFixed(2)} readOnly />
                      {!csMode && <p style={S.hint}>Edit in Rate Settings below</p>}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── 04 Quantities ── */}
          <div style={S.card}>
            <div style={S.cTitle}>04 — Quantities to quote</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
              {PRESET_QTYS.map(q => (
                <button key={q} style={S.chip(job.selectedQtys.includes(q))} onClick={() => toggleQty(q)}>
                  {q.toLocaleString()}
                </button>
              ))}
            </div>

            {/* Custom quantity */}
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ maxWidth: 200 }}>
                <label style={S.lbl}>Custom quantity</label>
                <input style={S.inp} type="number" min={1} step={50}
                  value={job.customQty}
                  onChange={e => setJ("customQty", e.target.value)}
                  placeholder="e.g. 750" />
              </div>
              {job.customQty && parseInt(job.customQty) > 0 && (
                <div style={{ marginTop: 16, fontSize: 12, color: "#C0392B", fontWeight: 600 }}>
                  ✓ {parseInt(job.customQty).toLocaleString()} copies added
                </div>
              )}
            </div>

            {/* Overs / spoilage */}
            <div style={{ marginTop: 14 }}>
              <label style={S.lbl}>Overs / spoilage quantity</label>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <input style={{ ...S.inp, maxWidth: 200 }} type="number" min={0} step={50}
                  value={job.overs}
                  onChange={e => setJ("overs", e.target.value)}
                  placeholder="e.g. 200" />
                {parseInt(job.overs) > 0 && (
                  <div style={{ fontSize: 12, color: "#888", lineHeight: "1.5" }}>
                    Press run = ordered + {parseInt(job.overs).toLocaleString()} overs
                    <br />
                    Unit price = total ÷ ordered qty
                  </div>
                )}
              </div>
              <p style={S.hint}>Extra copies to absorb spoilage — all running costs are calculated for the full print run, but the unit price is divided by the ordered quantity only.</p>
            </div>

            <div style={{ ...S.div, marginTop: 16 }} />

            <div style={S.togRow}>
              <div style={S.tog(job.applyVAT)} onClick={() => setJ("applyVAT", !job.applyVAT)}>
                <div style={S.togDot(job.applyVAT)} />
              </div>
              <span style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>Apply Ghana VAT (20%)</span>
              <span style={{ fontSize: 11, color: "#AAA" }}>— VAT 15% + NHIL 2.5% + GETFund 2.5%</span>
            </div>
          </div>

          {/* ── 05 Rate Settings (Admin only — hidden in CS mode) ── */}
          {!csMode && <div style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }} onClick={() => setRatesOpen(o => !o)}>
              <div style={S.cTitle}>⚙ Rate settings (GHS)</div>
              <span style={{ fontSize: 11, color: "#888" }}>{ratesOpen ? "▲ collapse" : "▼ expand"}</span>
            </div>
            {ratesOpen && (
              <>
                {RATE_GROUPS.map(grp => (
                  <div key={grp.group} style={{ marginBottom: 18 }}>
                    <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#C0392B", fontWeight: 600, marginBottom: 10, marginTop: 14, borderBottom: "1px solid #E0D9CF", paddingBottom: 6 }}>
                      {grp.group}
                    </div>
                    <div style={S.g3}>
                      {grp.fields.map(({ key, label }) => (
                        <div key={key}>
                          <label style={S.lbl}>{label}</label>
                          <input style={S.inp} type="number" step="0.01" value={rates[key]}
                            onChange={e => setR(key, e.target.value)} />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{ ...S.g2, marginTop: 4, alignItems: "end" }}>
                  <div>
                    <label style={S.lbl}>Profit margin (%)</label>
                    <input style={S.inp} type="number" min={0} max={100} value={rates.profitMargin}
                      onChange={e => setR("profitMargin", e.target.value)} />
                  </div>
                  <button style={{ ...S.btn, ...S.btnS }} onClick={() => setRates(savedDefaultRates)}>
                    Reset to defaults
                  </button>
                </div>
              </>
            )}
          </div>}

          {/* ── Generate ── */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <button style={{ ...S.btn, ...S.btnP, fontSize: 15, padding: "13px 40px" }} onClick={generate}>
              Generate quote →
            </button>
          </div>
        </div>{/* end no-print */}

        {/* ══════════════════════════════════════════════════════
            RESULTS / PRINT SECTION
        ══════════════════════════════════════════════════════ */}
        {showResults && resultQtys.length > 0 && (
          <div className="result-card" style={S.rCard} ref={printRef}>

            {/* ── Company header (visible in print) ── */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, paddingBottom: 16, borderBottom: "2px solid #1C1C1E" }}>
              <div>
                {companyLogo && (
                  <img src={companyLogo} alt={company.name} style={{ maxHeight: 56, maxWidth: 180, objectFit: "contain", display: "block", marginBottom: 6 }} />
                )}
                <div style={{ fontSize: 20, fontWeight: 800, color: "#1C1C1E", letterSpacing: -0.5 }}>{company.name}</div>
                <div style={{ fontSize: 11, color: "#666", marginTop: 2 }}>{company.address}</div>
                <div style={{ fontSize: 11, color: "#666" }}>{company.phone} · {company.email}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: "var(--br, #C0392B)", letterSpacing: 1 }}>PRINTING QUOTATION</div>
                <div style={{ fontSize: 12, color: "#555", marginTop: 4 }}>Ref: <b>{quoteRef}</b></div>
                {job.invoiceNo && <div style={{ fontSize: 12, color: "#555" }}>Invoice No: <b>{job.invoiceNo}</b></div>}
                <div style={{ fontSize: 12, color: "#555" }}>Date: {job.date}</div>
              </div>
            </div>

            {/* ── Job summary ── */}
            <div style={{ marginBottom: 18, background: "#EDE7D9", borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 16, fontWeight: 700, color: "#1C1C1E" }}>{job.jobTitle || "—"}</div>
              <div style={{ fontSize: 12, color: "#666", marginTop: 3 }}>
                {job.clientName && <span>Client: <b>{job.clientName}</b> · </span>}
                {job.numPages} pages ·{" "}
                {job.colours === "1" ? "1 colour" : job.colours === "4" ? "Full colour" : "2 colours"} ·{" "}
                {BOOK_SIZES[job.bookSize]?.label || `${job.bookW}"×${job.bookH}"`} ·{" "}
                {resolveSheet(job)?.label} ·{" "}
                {BINDING_TYPES.find(b => b.value === job.bindingType)?.label}
                {job.hasCover && ` · Cover: ${LAM_TYPES.find(l => l.value === job.laminationType)?.label || "No lam."}`}
              </div>
            </div>

            {/* ── Cost bar (screen only) ── */}
            <CostBar r={results[resultQtys[0]]} qty={resultQtys[0]} />

            {/* ── Quote table ── */}
            <div style={{ overflowX: "auto" }}>
              <table className="quote-table" style={S.tbl}>
                <thead>
                  <tr>
                    <th style={{ ...S.th, ...S.thF }}>Item</th>
                    {resultQtys.map(q => <th key={q} style={S.th}>{q.toLocaleString()} copies</th>)}
                  </tr>
                </thead>
                <tbody>

                  {/* ── Client-facing summary (print only — replaces the individual spec rows) ── */}
                  <tr className="desc-row">
                    <td colSpan={resultQtys.length + 1} style={{ ...S.tdF, paddingBottom: 14, borderBottom: "1px solid #E0D9CF" }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: "#1C1C1E", marginBottom: 4 }}>
                        {job.jobTitle || "Printing Services"}
                      </div>
                      <div style={{ fontSize: 11, color: "#555", lineHeight: "1.7" }}>
                        {job.numPages}-page ·{" "}
                        {job.colours === "1" ? "1 colour" : job.colours === "4" ? "Full colour" : `${job.colours} colours`} ·{" "}
                        {BOOK_SIZES[job.bookSize]?.label || `${job.bookW}"×${job.bookH}"`} ·{" "}
                        {resolveSheet(job)?.label} ·{" "}
                        {BINDING_TYPES.find(b => b.value === job.bindingType)?.label}
                        {job.hasCover && ` · With separate cover`}
                        {job.hasCover && job.laminationType !== "none" && ` (${LAM_TYPES.find(l => l.value === job.laminationType)?.label} lamination)`}
                      </div>
                    </td>
                  </tr>

                  {/* ── Individual cost rows (screen only — spec-row class hides them in print) ── */}

                  {/* Sepos & Plates */}
                  <tr className="spec-row">
                    <td style={S.tdF}>
                      Sepos &amp; Plates
                      <span style={S.pill("#555")}>{results[resultQtys[0]]?.numPlates} plates</span>
                    </td>
                    {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.plateCost)}</td>)}
                  </tr>

                  {/* Paper */}
                  <tr className="spec-row">
                    <td style={S.tdF}>
                      Paper
                      {resultQtys.map(q => (
                        <span key={q} style={{ ...S.pill("#E67E22"), marginRight: 3 }}>
                          {results[q]?.paper?.reamsNeeded} rms
                        </span>
                      ))}
                    </td>
                    {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.paperCost)}</td>)}
                  </tr>

                  {/* Impressions */}
                  <tr className="spec-row">
                    <td style={S.tdF}>
                      Impressions
                      <span style={S.pill("#2980B9")}>{results[resultQtys[0]]?.impressions} impr.</span>
                    </td>
                    {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.impressionCost)}</td>)}
                  </tr>

                  {/* Cover */}
                  {job.hasCover && <>
                    <tr className="spec-row">
                      <td style={S.tdF}>Cover — Plates</td>
                      {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.coverPlateCost)}</td>)}
                    </tr>
                    <tr className="spec-row">
                      <td style={S.tdF}>
                        Cover — Impressions
                        <span style={S.pill("#2980B9")}>{job.coverColours} clrs</span>
                      </td>
                      {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.coverImpressionCost)}</td>)}
                    </tr>
                    <tr className="spec-row">
                      <td style={S.tdF}>
                        Cover — Paper
                        {resultQtys.map(q => (
                          <span key={q} style={{ ...S.pill("#8E44AD"), marginRight: 3 }}>
                            {results[q]?.coverPaper?.reamsNeeded} rms
                          </span>
                        ))}
                      </td>
                      {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.coverPaperCost)}</td>)}
                    </tr>
                    {job.laminationType !== "none" && (
                      <tr className="spec-row">
                        <td style={S.tdF}>
                          Lamination
                          <span style={S.pill("#8E44AD")}>{LAM_TYPES.find(l => l.value === job.laminationType)?.label}</span>
                        </td>
                        {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.coverLamCost)}</td>)}
                      </tr>
                    )}
                  </>}

                  {/* Fold & Collate */}
                  <tr className="spec-row">
                    <td style={S.tdF}>Fold &amp; Collate</td>
                    {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.foldCost)}</td>)}
                  </tr>

                  {/* Binding */}
                  <tr className="spec-row">
                    <td style={S.tdF}>
                      Binding
                      <span style={S.pill("#27AE60")}>{BINDING_TYPES.find(b => b.value === job.bindingType)?.label}</span>
                    </td>
                    {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.bindingCost)}</td>)}
                  </tr>

                  {/* Subtotal */}
                  <tr className="subtotal-row spec-row">
                    <td style={{ ...S.tdF, ...S.tdSub }}>Subtotal</td>
                    {resultQtys.map(q => <td key={q} style={{ ...S.td, ...S.tdSub }}>{GHS(results[q]?.subtotal)}</td>)}
                  </tr>

                  {/* Margin */}
                  <tr className="spec-row">
                    <td style={S.tdF}>Profit margin ({rates.profitMargin}%)</td>
                    {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.margin)}</td>)}
                  </tr>

                  {/* Before VAT */}
                  <tr className="subtotal-row spec-row">
                    <td style={{ ...S.tdF, ...S.tdSub }}>Total before VAT</td>
                    {resultQtys.map(q => <td key={q} style={{ ...S.td, ...S.tdSub }}>{GHS(results[q]?.beforeVAT)}</td>)}
                  </tr>

                  {/* VAT — visible in both screen and print */}
                  {job.applyVAT && (
                    <tr>
                      <td style={S.tdF}>VAT @ 20% (VAT + NHIL + GETFund)</td>
                      {resultQtys.map(q => <td key={q} style={S.td}>{GHS(results[q]?.vatAmt)}</td>)}
                    </tr>
                  )}

                  {/* Grand Total */}
                  <tr className="grand-row">
                    <td style={{ ...S.tdF, fontWeight: 800, fontSize: 13, color: "#C0392B" }}>GRAND TOTAL</td>
                    {resultQtys.map(q => <td key={q} style={{ ...S.td, ...S.tdGrand }}>{GHS(results[q]?.grandTotal)}</td>)}
                  </tr>

                  {/* Unit Price */}
                  <tr className="grand-row">
                    <td style={{ ...S.tdF, fontWeight: 800, fontSize: 13, color: "#C0392B" }}>
                      UNIT PRICE{" "}
                      <span style={{ fontSize: 10, fontWeight: 400, color: "#999" }}>
                        per copy{parseInt(job.overs) > 0 ? ` · incl. ${parseInt(job.overs).toLocaleString()} overs in run` : ""}
                      </span>
                    </td>
                    {resultQtys.map(q => (
                      <td key={q} style={{ ...S.td, ...S.tdGrand, fontSize: 16 }}>
                        {GHS(results[q]?.unitPrice)}
                      </td>
                    ))}
                  </tr>

                  {/* Deposit & balance — shown in both screen and print */}
                  <tr style={{ borderTop: "2px solid #E0D9CF" }}>
                    <td style={{ ...S.tdF, fontWeight: 700, color: "#1C1C1E", paddingTop: 10 }}>
                      Deposit required (60%)
                      <span style={{ fontSize: 9, fontWeight: 400, color: "#AAA", marginLeft: 6 }}>payable before production begins</span>
                    </td>
                    {resultQtys.map(q => (
                      <td key={q} style={{ ...S.td, fontWeight: 700, color: "#1C1C1E", paddingTop: 10 }}>
                        {GHS((results[q]?.grandTotal ?? 0) * 0.6)}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ ...S.tdF, color: "#666" }}>Balance on delivery</td>
                    {resultQtys.map(q => (
                      <td key={q} style={{ ...S.td, color: "#666" }}>
                        {GHS((results[q]?.grandTotal ?? 0) * 0.4)}
                      </td>
                    ))}
                  </tr>

                </tbody>
              </table>
            </div>

            {/* ── Footer ── */}
            <div style={{ marginTop: 20, paddingTop: 12, borderTop: "1px solid #E0D9CF", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, fontSize: 10, color: "#999" }}>
              <span>This quotation is valid for 14 days from the date of issue.</span>
              {job.applyVAT && <span>{company.vatNo}</span>}
              <span>{company.name} · Ref: {quoteRef}</span>
            </div>

            {/* ── Terms of service (print only) ── */}
            {termsOfService && (
              <div className="print-only" style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid #E0D9CF" }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.8, color: "#999", marginBottom: 4 }}>
                  Terms &amp; Conditions
                </div>
                <div style={{ fontSize: 9, color: "#888", lineHeight: "1.6", whiteSpace: "pre-wrap" }}>
                  {termsOfService}
                </div>
              </div>
            )}

            {/* ── Needs design? (CS decides before approving) ── */}
            {csMode && (
              <div className="btn-row" style={{ ...S.togRow, marginTop: 16, cursor: "pointer" }} onClick={() => setJ("needsDesign", !job.needsDesign)}>
                <div style={S.tog(job.needsDesign)}><div style={S.togDot(job.needsDesign)} /></div>
                <span style={{ fontSize: 13, color: "#333", fontWeight: 500 }}>This job needs design work first</span>
                <span style={{ fontSize: 11, color: "#AAA" }}>
                  {job.needsDesign ? "— will route to the Designer lobby on approval" : "— will go straight to Production on approval"}
                </span>
              </div>
            )}

            {/* ── Buttons (screen only) ── */}
            <div className="btn-row" style={{ marginTop: 16, display: "flex", flexWrap: "wrap", gap: 10 }}>
              <button style={{ ...S.btn, ...S.btnS }} onClick={() => setShowResults(false)}>← Edit quote</button>
              <button style={{ ...S.btn, ...S.btnS }} onClick={saveQuote}>💾 Save quote</button>
              <button style={{ ...S.btn, ...S.btnP }} onClick={() => window.print()}>🖨 Print / Save PDF</button>
              {csMode && (
                <>
                  <button style={{ ...S.btn, ...S.btnS }} onClick={handleSendEmail}>
                    ✉ Send via Email
                  </button>
                  <button
                    style={{ ...S.btn, ...S.btnS, background: "#25D366", color: "#fff" }}
                    onClick={handleSendWhatsApp}
                  >
                    WhatsApp
                  </button>
                  <button
                    style={{ ...S.btn, ...S.btnP, background: "#27AE60" }}
                    onClick={handleApproveQuote}
                    disabled={approving}
                    title="Use once the client's deposit payment is confirmed"
                  >
                    {approving ? "Approving…" : "✓ Approve (payment received)"}
                  </button>
                </>
              )}
            </div>
            {csMode && approveMsg && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 12,
                  color: approveMsg.includes("approved") ? "#27AE60" : "#C0392B",
                  textAlign: "center",
                }}
              >
                {approveMsg}
              </p>
            )}

          </div>
        )}

      </div>
    </div>
  );
}
