/**
 * InvoiceBuilder.jsx
 * General-purpose quotation / invoice / receipt builder.
 * Picks items from the catalogue (or custom), calculates totals,
 * saves to Supabase, and prints a professional document.
 *
 * Supports:
 *  - Company logo (top-left of print header)
 *  - Accent colour (from admin settings) used in print CSS
 *  - Saved offset/digital print quotes added as print line items (several per invoice)
 */
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../AuthProvider.jsx";
import {
  saveInvoice, genInvoiceRef,
  INVOICE_TYPES, INVOICE_STATUSES, STATUS_COLORS,
} from "../../lib/invoices.js";
import { loadSavedQuotes, loadDigitalQuotes } from "../../lib/quoteStorage.js";
import { buildDigitalSpecSummary } from "../DigitalPrintQuoteGH.jsx";
import { snapshotForLine } from "../../lib/quoteLines.js";
import { digitalJobSizeLabel } from "../../lib/digitalPrintSpecs.js";
import { offsetBookLabel, isSheetWork, offsetJobSummary } from "../../lib/printSpecs.js";
// Note: createJobFromInvoice is now called by Accounts (PaymentsTab) when they
// record payment — CS no longer marks invoices as paid directly.
import { formatGHS as GHS } from "../../lib/currency.js";
import { CustomerPicker } from "../CustomerPicker.jsx";
import { getCustomerContact } from "../../lib/customerProfile.js";
import { waDigits } from "../../lib/jobNotify.js";
import { QuotePicker } from "./QuotePicker.jsx";

const VAT_RATE = 0.20;
const todayStr = () => new Date().toISOString().slice(0, 10);
const newLine  = () => ({ _key: crypto.randomUUID(), itemId: "", name: "", description: "", unit: "ea", qty: 1, unitPrice: 0 });
const round2   = (n) => Math.round(Number(n) * 100) / 100;

const inp =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 " +
  "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red";
const sel = inp;

// ─── Print document ───────────────────────────────────────────────────────────
function buildPrintHtml(state, company) {
  const accent = company.accentHex || "#C0392B";

  const typeLabel =
    state.docType === "receipt" ? "RECEIPT"
    : state.docType === "invoice" ? "INVOICE"
    : "QUOTATION";

  const fmt = (n) =>
    "GH₵ " +
    Number(n || 0).toLocaleString("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  const logoHtml = company.logoUrl
    ? `<img src="${company.logoUrl}" alt="${company.name}" style="max-height:64px;max-width:180px;object-fit:contain;display:block;margin-bottom:8px">`
    : "";

  const validLines = state.lineItems.filter((li) => li.name);
  const linesHtml = validLines
    .map((li, i) => {
      const lineTotal = round2(Number(li.qty) * Number(li.unitPrice));
      return `
        <tr>
          <td style="padding:10px 12px;font-size:12px">${i + 1}</td>
          <td style="padding:10px 12px;font-size:12px">
            <strong>${li.name}</strong>
            ${li.description ? `<br><span style="color:#888;font-size:11px">${li.description}</span>` : ""}
          </td>
          <td style="padding:10px 12px;font-size:12px;text-align:center">${li.unit}</td>
          <td style="padding:10px 12px;font-size:12px;text-align:center">${li.qty}</td>
          <td style="padding:10px 12px;font-size:12px;text-align:right;white-space:nowrap">${fmt(li.unitPrice)}</td>
          <td style="padding:10px 12px;font-size:12px;text-align:right;font-weight:600;white-space:nowrap">${fmt(lineTotal)}</td>
        </tr>`;
    })
    .join("");

  const totalsRows = [
    `<tr><td style="padding:6px 0;font-size:12px;color:#555">Subtotal</td><td style="padding:6px 0;font-size:12px;text-align:right;font-variant-numeric:tabular-nums">${fmt(state.subtotal)}</td></tr>`,
    state.discountPct > 0
      ? `<tr><td style="padding:6px 0;font-size:12px;color:#555">Discount (${state.discountPct}%)</td><td style="padding:6px 0;font-size:12px;text-align:right;color:${accent}">- ${fmt(state.discountAmt)}</td></tr>`
      : "",
    state.vatAmt > 0
      ? `<tr><td style="padding:6px 0;font-size:12px;color:#555">VAT (20%)</td><td style="padding:6px 0;font-size:12px;text-align:right">+ ${fmt(state.vatAmt)}</td></tr>`
      : "",
    `<tr style="border-top:2px solid #1C1C1E">
       <td style="padding:10px 0 0;font-size:15px;font-weight:800">TOTAL</td>
       <td style="padding:10px 0 0;font-size:15px;font-weight:800;text-align:right;color:${accent};white-space:nowrap">${fmt(state.total)}</td>
     </tr>`,
  ].join("");

  const depositRow =
    state.docType === "quote"
      ? `<p style="margin-top:16px;font-size:12px;color:#555">
           <strong style="color:${accent}">60% deposit required:</strong> ${fmt(round2(state.total * 0.6))} &nbsp;|&nbsp;
           <strong>Balance on delivery:</strong> ${fmt(round2(state.total * 0.4))}
         </p>`
      : "";

  const hasPaymentInfo = company.momoNumber || company.bankName || company.accountNumber;
  const howToPayHtml = (state.docType !== "receipt" && hasPaymentInfo)
    ? `<div style="margin-top:28px;border:1.5px solid ${accent};border-radius:8px;overflow:hidden">
         <div style="background:${accent};color:#fff;padding:8px 16px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase">
           How to Pay
         </div>
         <div style="padding:14px 16px;display:flex;flex-wrap:wrap;gap:16px 32px;font-size:11px">
           ${company.momoNumber ? `<div>
             <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;margin-bottom:3px">Mobile Money (MoMo)</div>
             <div style="font-weight:600">${company.momoNumber}</div>
           </div>` : ""}
           ${company.bankName || company.accountNumber ? `<div>
             <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:0.8px;color:#888;margin-bottom:3px">Bank Transfer</div>
             ${company.bankName ? `<div style="font-weight:600">${company.bankName}</div>` : ""}
             ${company.accountNumber ? `<div>${company.accountNumber}${company.accountName ? ` &mdash; ${company.accountName}` : ""}</div>` : ""}
           </div>` : ""}
         </div>
       </div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${typeLabel} — ${state.ref}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family:'Helvetica Neue',Arial,sans-serif; padding:40px; color:#1C1C1E; max-width:760px; margin:0 auto; }
    .header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:32px; padding-bottom:20px; border-bottom:2px solid #1C1C1E; }
    .company-name { font-size:20px; font-weight:800; letter-spacing:-0.5px; }
    .company-sub { font-size:11px; color:#666; margin-top:2px; }
    .doc-title { font-size:22px; font-weight:800; color:${accent}; letter-spacing:1px; text-align:right; }
    .doc-meta { font-size:11px; color:#555; text-align:right; margin-top:4px; line-height:1.8; }
    .bill-to { margin-bottom:28px; display:flex; gap:40px; }
    .bill-section { flex:1; }
    .bill-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:4px; }
    .bill-name { font-size:14px; font-weight:700; }
    .bill-sub { font-size:11px; color:#666; margin-top:2px; }
    table { width:100%; border-collapse:collapse; margin-bottom:24px; }
    thead tr { background:${accent}; color:#fff; }
    thead th { padding:10px 12px; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; text-align:left; }
    thead th.right { text-align:right; }
    thead th.center { text-align:center; }
    tbody tr:nth-child(even) { background:#F5F0E8; }
    tbody tr { border-bottom:1px solid #E5DFD5; }
    .totals-wrap { display:flex; justify-content:flex-end; margin-bottom:24px; }
    .totals-box { width:280px; border-collapse:collapse; }
    .notes { margin-bottom:24px; }
    .notes-label { font-size:9px; font-weight:700; text-transform:uppercase; letter-spacing:1px; color:#888; margin-bottom:6px; }
    .notes-text { font-size:11px; color:#555; line-height:1.7; white-space:pre-wrap; }
    .footer { margin-top:40px; padding-top:12px; border-top:1px solid #E5DFD5; font-size:10px; color:#AAA; text-align:center; }
    @media print { body { padding:20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${logoHtml}
      <div class="company-name">${company.name}</div>
      <div class="company-sub">${company.address}</div>
      <div class="company-sub">${company.phone} &middot; ${company.email}</div>
      ${company.vatNo ? `<div class="company-sub" style="margin-top:4px;font-size:10px;color:#999">${company.vatNo}</div>` : ""}
    </div>
    <div>
      <div class="doc-title">${typeLabel}</div>
      <div class="doc-meta">
        Ref: <strong>${state.ref}</strong><br>
        Date: ${state.date}
        ${state.dueDate ? `<br>Due: ${state.dueDate}` : ""}
      </div>
    </div>
  </div>

  ${state.clientName ? `
  <div class="bill-to">
    <div class="bill-section">
      <div class="bill-label">Bill To</div>
      <div class="bill-name">${state.clientName}</div>
      ${state.clientPhone ? `<div class="bill-sub">${state.clientPhone}</div>` : ""}
      ${state.clientEmail ? `<div class="bill-sub">${state.clientEmail}</div>` : ""}
    </div>
  </div>` : ""}

  <table>
    <thead>
      <tr>
        <th style="width:36px">#</th>
        <th>Item / Description</th>
        <th class="center" style="width:60px">Unit</th>
        <th class="center" style="width:60px">Qty</th>
        <th class="right" style="width:110px">Unit price</th>
        <th class="right" style="width:110px">Amount</th>
      </tr>
    </thead>
    <tbody>${linesHtml}</tbody>
  </table>

  <div class="totals-wrap">
    <table class="totals-box">
      <tbody>${totalsRows}</tbody>
    </table>
  </div>

  ${depositRow}

  ${howToPayHtml}

  ${state.notes ? `
  <div class="notes" style="margin-top:28px">
    <div class="notes-label">Notes / Terms</div>
    <div class="notes-text">${state.notes}</div>
  </div>` : ""}

  <div class="footer">
    ${company.vatNo ? company.vatNo + " &middot; " : ""}${company.name}
    ${state.docType === "quote" ? "&middot; This quotation is valid for 14 days from the date of issue." : ""}
    ${state.docType === "invoice" ? "&middot; Please make payment within 30 days of the invoice date." : ""}
    ${state.docType === "receipt" ? "&middot; Thank you for your payment. This serves as your official receipt." : ""}
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;
}

// ─── Build a one-line spec summary from a saved print-quote snapshot ──────────
function offsetSizeLabel(j) {
  // In the unit the quote was made in: "A5 (148.1mm × 210.1mm)"
  return offsetBookLabel(j, j.dimUnit || "in");
}

function digitalSizeLabel(j) {
  return digitalJobSizeLabel(j);
}

function buildSpecSummary(snap) {
  const j = snap.job || {};
  if (isSheetWork(j)) return offsetJobSummary(j, j.dimUnit || "in");
  const sz = offsetSizeLabel(j);
  const pages = j.numPages ? `${j.numPages}pp` : "";
  const body  = j.colours === "4" ? "FC body" : `${j.colours || "1"}C body`;
  const cover = j.hasCover
    ? `, FC cover${j.laminationType && j.laminationType !== "none" ? ` (${j.laminationType} lam)` : ""}`
    : "";
  const binding = j.bindingType ? `, ${j.bindingType} bound` : "";
  return [sz, pages, body + cover + binding].filter(Boolean).join(" · ");
}

// ─── Saved quotes as "print items" ────────────────────────────────────────────
// A saved offset/digital quote is offered in the line-item picker like a
// catalogue item. It is never stored in the Items catalogue: the line simply
// carries the quote's snapshot so Production gets the full spec.

// Quantities an offset quote was priced at — prefer resultQtys, fall back to
// results keys for quotes saved before resultQtys existed.
function offsetQuoteQtys(snap) {
  if (snap?.resultQtys?.length > 0) return snap.resultQtys.map(Number);
  return Object.keys(snap?.results || {})
    .map(Number)
    .filter((n) => !isNaN(n) && n > 0)
    .sort((a, b) => a - b);
}

// Price for one offset quantity. Uses the before-VAT figure so the invoice's
// own VAT toggle stays accurate.
function offsetPriceFor(snap, qtyNum) {
  // JSON round-trip turns numeric keys to strings, so check both
  const r = snap.results?.[qtyNum] ?? snap.results?.[String(qtyNum)];
  if (!r) return null;
  const qty = r.orderedQty ?? qtyNum;
  const unitPrice = r.orderedQty > 0
    ? round2((r.beforeVAT ?? r.grandTotal) / r.orderedQty)
    : round2(r.unitPrice ?? 0);
  return { qty, unitPrice };
}

// What goes in invoices.quote_snapshot (→ jobs.quote when the job is created).
// Quote snapshots hold costs and profit, so they live ONLY here (staff-facing),
// never on line_items, which are copied onto customer-visible receipts.
//   exactly one quote line → that quote, so Production/Accounts work exactly as before
//   several quote lines    → a "multi" bundle with every quote + the invoice total
//   no quote lines         → the legacy invoice-level snapshot, if any
function invoiceQuoteSnapshot(lines, legacy, meta) {
  const quoteLines = lines.filter((li) => li.quoteSnapshot);
  if (quoteLines.length === 1) return snapshotForLine(quoteLines[0]);
  if (quoteLines.length > 1) {
    return {
      quoteType:   "multi",
      ref:         meta.ref,
      clientName:  meta.clientName,
      clientPhone: meta.clientPhone,
      jobTitle:    quoteLines.map((li) => li.name).join(" + "),
      grandTotal:  meta.total,   // read by jobGrandTotal for Accounts/Admin figures
      quotes: quoteLines.map((li) => ({
        quoteRef:  li.quoteRef,
        quoteType: li.quoteType,
        quoteQty:  li.quoteQty ?? null,
        name:      li.name,
        snapshot:  snapshotForLine(li),
      })),
    };
  }
  return legacy || null;
}

// Re-attach each saved line's quote snapshot (stored at invoice level) when an
// invoice is opened for editing.
function rehydrateQuoteLines(lines, invoiceSnap) {
  return lines.map((li) => {
    if (!li.quoteRef || !invoiceSnap) return li;
    const snapshot = invoiceSnap.quoteType === "multi"
      ? invoiceSnap.quotes?.find((q) => q.quoteRef === li.quoteRef)?.snapshot
      : (invoiceSnap.ref === li.quoteRef ? invoiceSnap : null);
    return snapshot ? { ...li, quoteSnapshot: snapshot } : li;
  });
}

const quoteOptionLabel = (q) => `${q.ref} · ${q.jobTitle || "Untitled"}`;

// Build an invoice line from a saved quote. For offset quotes `qtyNum` picks
// which priced quantity to use; digital quotes have a single quantity.
function quoteToLine(snap, type, qtyNum) {
  const common = {
    _key:          crypto.randomUUID(),
    itemId:        "",
    unit:          "copy",
    category:      "Print & Press",
    itemType:      "print",
    quoteRef:      snap.ref,
    quoteType:     type,
    quoteSnapshot: snap,
  };

  if (type === "offset") {
    const quoteQty = qtyNum ?? offsetQuoteQtys(snap)[0];
    const price    = offsetPriceFor(snap, quoteQty);
    if (!price) return null;
    const summary = buildSpecSummary(snap);
    return {
      ...common,
      name:        snap.jobTitle || "Book printing",
      description: `${summary} · Quote ${snap.ref}`,
      quoteQty,    // the quote's results key (may differ from the ordered qty shown)
      qty:         price.qty,
      unitPrice:   price.unitPrice,
      printSpecs:  { size: offsetSizeLabel(snap.job || {}), description: summary, quoteRef: snap.ref },
    };
  }

  const res       = snap.result ?? {};
  const summary   = res.description || buildDigitalSpecSummary(snap);
  const qty       = Number(res.qty) || 1;
  const sellPrice = Number(res.sellPrice) || 0;
  return {
    ...common,
    name:        snap.jobTitle || "Digital print",
    description: `${summary} · Quote ${snap.ref}`,
    qty,
    unitPrice:   qty > 0 ? round2(sellPrice / qty) : sellPrice,
    printSpecs:  { size: digitalSizeLabel(snap.job || {}), description: summary, quoteRef: snap.ref },
  };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function InvoiceBuilder({
  initial = null,
  catalogueItems = [],
  company,
  onSaved,
  onCancel,
}) {
  const { user } = useAuth();
  const isEdit = !!initial?.id;

  const [docType,    setDocType]    = useState(initial?.type     ?? "quote");
  const [docStatus,  setDocStatus]  = useState(initial?.status   ?? "draft");
  const [ref,        setRef]        = useState(initial?.ref      ?? genInvoiceRef("quote"));
  const [clientName, setClientName] = useState(initial?.client_name  ?? "");
  const [clientPhone,setClientPhone]= useState(initial?.client_phone ?? "");
  const [clientEmail,setClientEmail]= useState(initial?.client_email ?? "");
  const [date,       setDate]       = useState(initial?.date     ?? todayStr());
  const [dueDate,    setDueDate]    = useState(initial?.due_date ?? "");
  const [lineItems,  setLineItems]  = useState(
    initial?.line_items?.length
      ? rehydrateQuoteLines(initial.line_items, initial.quote_snapshot)
          .map((li) => ({ ...li, _key: crypto.randomUUID() }))
      : [newLine()]
  );
  const [discountPct, setDiscountPct] = useState(Number(initial?.discount_pct ?? 0));
  const [applyVAT,    setApplyVAT]    = useState(Number(initial?.vat_amt ?? 0) > 0);
  const [notes,       setNotes]       = useState(initial?.notes ?? "");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");
  // Set when CS uses CustomerPicker — carried into invoices.customer_id so the
  // document appears in that customer's portal Documents tab.
  const [linkedCustomerId, setLinkedCustomerId] = useState(initial?.customer_id ?? null);

  // Legacy: invoices made with the old one-quote import stored the snapshot only
  // at invoice level and no line references it. Kept so re-saving them doesn't
  // lose the Production spec.
  const legacyQuoteSnapshot =
    initial?.quote_snapshot && !(initial.line_items ?? []).some((li) => li.quoteRef)
      ? initial.quote_snapshot
      : null;

  // ── Saved quotes offered as print items in the line-item picker
  const [savedPrintQuotes,   setSavedPrintQuotes]   = useState([]);
  const [savedDigitalQuotes, setSavedDigitalQuotes] = useState([]);

  useEffect(() => {
    loadSavedQuotes().then(setSavedPrintQuotes).catch(() => {});
    loadDigitalQuotes().then(setSavedDigitalQuotes).catch(() => {});
  }, []);

  // label → { snap, type } for matching typed/datalist names
  const quoteOptions = useMemo(() => {
    const m = new Map();
    savedPrintQuotes.forEach((q) => m.set(quoteOptionLabel(q), { snap: q, type: "offset" }));
    savedDigitalQuotes.forEach((q) => m.set(quoteOptionLabel(q), { snap: q, type: "digital" }));
    return m;
  }, [savedPrintQuotes, savedDigitalQuotes]);

  // Fill client details from the quote only when CS hasn't entered any yet.
  function fillClientFromQuote(snap) {
    if (clientName.trim() || clientPhone.trim()) return;
    setClientName(snap.clientName   || "");
    setClientPhone(snap.clientPhone || "");
    setClientEmail(snap.clientEmail || "");
  }

  // Add a saved quote as a new line (or fill the trailing empty line).
  function addQuoteLine(snap, type) {
    const line = quoteToLine(snap, type);
    if (!line) {
      setError(`Quote ${snap.ref} has no priced quantities. Open it, generate the quote and save it again.`);
      return;
    }
    setError("");
    setLineItems((prev) => {
      const last = prev[prev.length - 1];
      const lastIsBlank = last && !last.name.trim() && !Number(last.unitPrice);
      return lastIsBlank ? [...prev.slice(0, -1), line] : [...prev, line];
    });
    fillClientFromQuote(snap);
    // Offset quotes remember whether VAT was applied; switch it on if so.
    if (type === "offset" && snap.job?.applyVAT) setApplyVAT(true);
  }

  // Offset quote line: switching the quantity re-prices from the saved results.
  function changeQuoteQty(key, snap, qtyNum) {
    const price = offsetPriceFor(snap, qtyNum);
    if (price) updateLine(key, { ...price, quoteQty: qtyNum });
  }

  // ── Type change → new ref (unless editing existing record)
  function handleTypeChange(t) {
    setDocType(t);
    if (!isEdit) setRef(genInvoiceRef(t));
  }

  // ── Line item helpers
  function updateLine(key, fields) {
    setLineItems((prev) => prev.map((li) => li._key === key ? { ...li, ...fields } : li));
  }
  function removeLine(key) {
    setLineItems((prev) => prev.filter((li) => li._key !== key));
  }
  function addLine() {
    setLineItems((prev) => [...prev, newLine()]);
  }
  function handleNameChange(key, val) {
    // Picked a saved quote from the item list → turn this line into a quote item
    const quoteHit = quoteOptions.get(val);
    if (quoteHit) {
      const line = quoteToLine(quoteHit.snap, quoteHit.type);
      if (line) {
        setLineItems((prev) => prev.map((li) => li._key === key ? { ...line, _key: key } : li));
        fillClientFromQuote(quoteHit.snap);
        if (quoteHit.type === "offset" && quoteHit.snap.job?.applyVAT) setApplyVAT(true);
        return;
      }
    }
    const found = catalogueItems.find((i) => i.name === val);
    if (found) {
      updateLine(key, {
        itemId:     found.id,
        name:       found.name,
        description: found.description || "",
        unit:       found.unit,
        unitPrice:  Number(found.unit_price),
        category:   found.category  || null,
        itemType:   found.item_type || null,
        printSpecs: found.item_type === "print" ? (found.print_specs || null) : null,
      });
    } else {
      updateLine(key, { itemId: "", name: val });
    }
  }

  // ── Computed totals
  const subtotal = useMemo(
    () => round2(lineItems.reduce((sum, li) => sum + Number(li.qty || 0) * Number(li.unitPrice || 0), 0)),
    [lineItems]
  );
  const discountAmt   = round2(subtotal * (discountPct / 100));
  const afterDiscount = round2(subtotal - discountAmt);
  const vatAmt        = applyVAT ? round2(afterDiscount * VAT_RATE) : 0;
  const total         = round2(afterDiscount + vatAmt);

  // ── Shared save — called by handleSave, handleMarkSent, handleMarkPaid
  async function buildAndSave(overrideStatus) {
    const validLines = lineItems.filter((li) => li.name.trim() && Number(li.qty) > 0);
    if (validLines.length === 0) {
      setError("Add at least one line item with a name and quantity greater than zero.");
      return false;
    }
    setError("");
    setSaving(true);
    try {
      const newStatus = overrideStatus ?? docStatus;
      const payload = {
        user_id:      user?.id ?? null,
        ref, type:    docType, status: newStatus,
        client_name:  clientName  || null,
        client_phone: clientPhone || null,
        client_email: clientEmail || null,
        date,
        due_date:     dueDate || null,
        line_items:   validLines.map((li) => ({
          itemId:      li.itemId  || null,
          name:        li.name,
          description: li.description || "",
          unit:        li.unit,
          qty:         Number(li.qty),
          unitPrice:   Number(li.unitPrice),
          total:       round2(Number(li.qty) * Number(li.unitPrice)),
          ...(li.category   ? { category:   li.category   } : {}),
          ...(li.itemType   ? { itemType:   li.itemType   } : {}),
          ...(li.printSpecs ? { printSpecs: li.printSpecs } : {}),
          // Reference only — the snapshot itself goes in quote_snapshot below
          ...(li.quoteSnapshot ? {
            quoteRef:  li.quoteRef,
            quoteType: li.quoteType,
            ...(li.quoteQty != null ? { quoteQty: li.quoteQty } : {}),
          } : {}),
        })),
        subtotal, discount_pct: discountPct, discount_amt: discountAmt,
        vat_amt: vatAmt, total, notes: notes || null,
        customer_id:      linkedCustomerId       || null,
        // Saved quote snapshot(s) — so the SpecSheet can render in Production/
        // Designer when the job is created later via the Accounts payment flow.
        quote_snapshot:   invoiceQuoteSnapshot(validLines, legacyQuoteSnapshot, { ref, clientName, clientPhone, total }),
        // Quotation this invoice was converted from (migration 041)
        ...(initial?.source_ref ? { source_ref: initial.source_ref } : {}),
      };
      let result;
      try {
        result = await saveInvoice(payload, isEdit ? initial.id : null);
      } catch (err) {
        // Column not there yet (041 not run): save without the link
        if (!payload.source_ref || !String(err.message || "").includes("source_ref")) throw err;
        delete payload.source_ref;
        result = await saveInvoice(payload, isEdit ? initial.id : null);
      }
      if (overrideStatus) setDocStatus(overrideStatus);
      onSaved(result);
      return true;
    } catch (err) {
      setError(err.message ?? "Could not save.");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleSave()     { await buildAndSave(); }
  async function handleMarkSent() { await buildAndSave("sent"); }
  // Payment recording has moved to Accounts → PaymentsTab.
  // When Accounts records payment against this invoice, a job is created
  // automatically and a receipt appears in the customer's portal.

  // ── Send via Email — print first, then open mailto
  async function handleSendEmail() {
    // A linked customer's own contact email, if the form has none
    const linked = linkedCustomerId && !clientEmail ? await getCustomerContact(linkedCustomerId) : null;
    handlePrint();
    const typeLabel = docType === "receipt" ? "Receipt"
      : docType === "invoice" ? "Invoice" : "Quotation";
    const fmtAmt = (n) =>
      `GH₵ ${Number(n || 0).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
    const itemLines = lineItems
      .filter((li) => li.name)
      .map((li) => `  • ${li.name}${li.description ? ` (${li.description})` : ""} — ${fmtAmt(round2(Number(li.qty) * Number(li.unitPrice)))}`);
    const body = [
      `Dear ${clientName || "Valued Customer"},`,
      "",
      `Please find ${docType === "receipt" ? "your receipt" : "attached"} ${typeLabel.toLowerCase()} ${ref}.`,
      "",
      ...itemLines,
      "",
      discountAmt > 0 ? `Discount: -${fmtAmt(discountAmt)}` : null,
      vatAmt > 0      ? `VAT (20%): +${fmtAmt(vatAmt)}` : null,
      `TOTAL: ${fmtAmt(total)}`,
      docType === "quote" ? `60% Deposit required: ${fmtAmt(round2(total * 0.6))}` : null,
      notes ? `\nNotes: ${notes}` : null,
      "",
      `Regards,`,
      company.name,
      company.phone || "",
    ].filter((l) => l !== null).join("\n");

    const subject = encodeURIComponent(`${typeLabel} ${ref} from ${company.name}`);
    const toAddr = clientEmail || linked?.email || "";
    const to = toAddr ? encodeURIComponent(toAddr) : "";
    setTimeout(() => {
      window.location.href = `mailto:${to}?subject=${subject}&body=${encodeURIComponent(body)}`;
    }, 600);
  }

  // ── Send via WhatsApp — print first, then open wa.me
  async function handleSendWhatsApp() {
    // Send to the linked customer's WhatsApp number (from their profile) first
    const linked = linkedCustomerId ? await getCustomerContact(linkedCustomerId) : null;
    handlePrint();
    const typeLabel = docType === "receipt" ? "Receipt"
      : docType === "invoice" ? "Invoice" : "Quotation";
    const fmtAmt = (n) =>
      `GH₵ ${Number(n || 0).toLocaleString("en-GH", { minimumFractionDigits: 2 })}`;
    const msg = [
      `*${typeLabel} ${ref}* — ${company.name}`,
      `Date: ${date}`,
      clientName ? `To: *${clientName}*` : null,
      "",
      ...lineItems.filter((li) => li.name).map((li) =>
        `• ${li.name} — ${fmtAmt(round2(Number(li.qty) * Number(li.unitPrice)))}`),
      "",
      discountAmt > 0 ? `Discount: -${fmtAmt(discountAmt)}` : null,
      vatAmt > 0      ? `VAT: +${fmtAmt(vatAmt)}` : null,
      `*TOTAL: ${fmtAmt(total)}*`,
      docType === "quote" ? `Deposit (60%): ${fmtAmt(round2(total * 0.6))}` : null,
    ].filter((l) => l !== null).join("\n");

    const phone = waDigits(linked?.whatsapp || clientPhone);
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    setTimeout(() => {
      window.open(waUrl, "_blank", "noopener,noreferrer");
    }, 600);
  }

  // ── Print
  function handlePrint() {
    const html = buildPrintHtml(
      { docType, ref, docStatus, clientName, clientPhone, clientEmail, date, dueDate,
        lineItems, subtotal, discountPct, discountAmt, applyVAT, vatAmt, total, notes },
      company
    );
    const win = window.open("", "_blank", "width=820,height=1100");
    if (win) { win.document.write(html); win.document.close(); }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">

      {/* Back */}
      <button type="button" onClick={onCancel}
        className="text-sm font-medium text-[var(--t-muted)] hover:text-[var(--t-text1)] transition-colors mb-6 block">
        ← Back to invoices
      </button>

      {/* ── 01 Document type + meta ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-6 mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-red mb-4">
          01 — Document type
        </div>

        {/* Type selector */}
        <div className="flex gap-2 mb-5">
          {INVOICE_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => handleTypeChange(t.value)}
              className={[
                "flex-1 rounded-lg border-2 py-2.5 text-sm font-semibold transition-colors",
                docType === t.value
                  ? "border-brand-red bg-brand-red text-white"
                  : "border-gray-300 bg-white text-gray-700 hover:border-brand-red/50",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Reference #</label>
            <input className={inp} value={ref} onChange={(e) => setRef(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Status</label>
            <select className={sel} value={docStatus} onChange={(e) => setDocStatus(e.target.value)}>
              {INVOICE_STATUSES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
            <input type="date" className={inp} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          {docType === "invoice" && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Due date</label>
              <input type="date" className={inp} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
          )}
        </div>
      </div>

      {/* ── 02 Client ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-6 mb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-brand-red">
            02 — Client information
          </div>
          <CustomerPicker
            onSelect={({ name, phone, email, userId }) => {
              setClientName(name);
              setClientPhone(phone);
              if (email) setClientEmail(email);
              setLinkedCustomerId(userId ?? null);
            }}
          />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Client name</label>
            <input className={inp} placeholder="e.g. Accra Schools Ltd"
              value={clientName} onChange={(e) => setClientName(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone</label>
            <input className={inp} placeholder="+233 XX XXX XXXX" type="tel"
              value={clientPhone} onChange={(e) => setClientPhone(e.target.value)} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
            <input className={inp} placeholder="client@example.com" type="email"
              value={clientEmail} onChange={(e) => setClientEmail(e.target.value)} />
          </div>
        </div>
      </div>

      {/* ── 03 Line items ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-6 mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-red mb-4">
          03 — Line items
        </div>

        {(catalogueItems.length > 0 || quoteOptions.size > 0) && (
          <p className="text-xs text-gray-500 mb-3">
            💡 Type an item name — catalogue items and saved print quotes (type the quote ref, e.g. "DQ-")
            pre-fill the price and unit.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b-2 border-gray-300">
                <th className="py-2 pr-3">Item / Description</th>
                <th className="py-2 pr-3 text-center" style={{ width: 100 }}>Qty</th>
                <th className="py-2 pr-3 text-center" style={{ width: 64 }}>Unit</th>
                <th className="py-2 pr-3 text-right" style={{ width: 110 }}>Unit price</th>
                <th className="py-2 pr-3 text-right" style={{ width: 110 }}>Total</th>
                <th className="py-2" style={{ width: 28 }}></th>
              </tr>
            </thead>
            <tbody>
              {lineItems.map((li) => {
                const lineTotal = round2(Number(li.qty || 0) * Number(li.unitPrice || 0));
                return (
                  <tr key={li._key} className="border-b border-gray-200">
                    <td className="py-2.5 pr-3">
                      {/* Name with catalogue datalist */}
                      <input
                        type="text"
                        list={`cat-${li._key}`}
                        value={li.name}
                        onChange={(e) => handleNameChange(li._key, e.target.value)}
                        placeholder="Item name…"
                        className="w-full rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-red"
                      />
                      <datalist id={`cat-${li._key}`}>
                        {catalogueItems.map((i) => <option key={i.id} value={i.name} />)}
                        {[...quoteOptions.entries()].map(([label, { type }]) => (
                          <option key={`q-${label}`} value={label}>
                            {type === "offset" ? "Offset print quote" : "Digital print quote"}
                          </option>
                        ))}
                      </datalist>
                      {li.quoteSnapshot && (
                        <span className={[
                          "mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold",
                          li.quoteType === "offset" ? "bg-amber-100 text-amber-800" : "bg-indigo-100 text-indigo-800",
                        ].join(" ")}>
                          {li.quoteType === "offset" ? "Offset" : "Digital"} print quote · {li.quoteRef}
                        </span>
                      )}
                      {/* Description */}
                      <input
                        type="text"
                        value={li.description}
                        onChange={(e) => updateLine(li._key, { description: e.target.value })}
                        placeholder="Description (optional)"
                        className="mt-1 w-full rounded border border-gray-200 bg-white px-2.5 py-1 text-xs text-gray-500 focus:outline-none focus:border-brand-red"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-center">
                      {li.quoteType === "offset" && li.quoteSnapshot ? (
                        // Offset quote: choose one of the quantities the quote was priced at
                        <select
                          value={li.quoteQty ?? li.qty}
                          onChange={(e) => changeQuoteQty(li._key, li.quoteSnapshot, Number(e.target.value))}
                          className="w-24 rounded-lg border border-gray-300 bg-white px-1.5 py-1.5 text-sm focus:outline-none focus:border-brand-red"
                          title="Quantities priced in this quote"
                        >
                          {offsetQuoteQtys(li.quoteSnapshot).map((q) => {
                            const p = offsetPriceFor(li.quoteSnapshot, q);
                            return p ? <option key={q} value={q}>{Number(p.qty).toLocaleString()}</option> : null;
                          })}
                        </select>
                      ) : li.quoteType === "digital" && li.quoteSnapshot ? (
                        // Digital quote: priced for one quantity — re-quote to change it
                        <span className="inline-block w-16 py-1.5 text-sm font-medium" title="Priced for this quantity. Re-quote in the Digital quoter to change it.">
                          {Number(li.qty).toLocaleString()}
                        </span>
                      ) : (
                        <input
                          type="number" min="0.01" step="any"
                          value={li.qty}
                          onChange={(e) => updateLine(li._key, { qty: e.target.value })}
                          className="w-16 text-center rounded-lg border border-gray-300 bg-white px-1.5 py-1.5 text-sm focus:outline-none focus:border-brand-red"
                        />
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-center">
                      <input
                        type="text"
                        value={li.unit}
                        onChange={(e) => updateLine(li._key, { unit: e.target.value })}
                        className="w-16 text-center rounded-lg border border-gray-300 bg-white px-1.5 py-1.5 text-sm focus:outline-none focus:border-brand-red"
                      />
                    </td>
                    <td className="py-2.5 pr-3">
                      <input
                        type="number" min="0" step="0.01"
                        value={li.unitPrice}
                        onChange={(e) => updateLine(li._key, { unitPrice: e.target.value })}
                        className="w-full text-right rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-sm focus:outline-none focus:border-brand-red"
                      />
                    </td>
                    <td className="py-2.5 pr-3 text-right font-medium text-brand-dark whitespace-nowrap text-sm">
                      {GHS(lineTotal)}
                    </td>
                    <td className="py-2.5 text-center">
                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(li._key)}
                          className="text-gray-400 hover:text-red-500 text-lg font-bold leading-none transition-colors"
                          title="Remove line"
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
          <button
            type="button"
            onClick={addLine}
            className="text-sm font-medium text-brand-red hover:underline"
          >
            + Add line item
          </button>

          {/* Saved quotes behave like print items — search all of them, add as many as needed */}
          <QuotePicker onPick={addQuoteLine} />
        </div>
      </div>

      {/* ── 04 Totals ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-6 mb-4">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-red mb-4">
          04 — Totals
        </div>
        <div className="flex justify-end">
          <div className="w-full max-w-xs space-y-2">
            <div className="flex justify-between text-sm text-gray-600 border-b border-gray-200 pb-2">
              <span>Subtotal</span>
              <span className="font-medium text-brand-dark">{GHS(subtotal)}</span>
            </div>

            {/* Discount */}
            <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
              <span className="text-sm text-gray-600 shrink-0">Discount</span>
              <input
                type="number" min="0" max="100" step="0.5"
                value={discountPct}
                onChange={(e) => setDiscountPct(Number(e.target.value))}
                className="w-16 text-center rounded-lg border border-gray-300 bg-white px-2 py-1 text-sm focus:outline-none focus:border-brand-red"
              />
              <span className="text-sm text-gray-500">%</span>
              <span className="ml-auto font-medium text-brand-red text-sm">
                {discountAmt > 0 ? `- ${GHS(discountAmt)}` : "—"}
              </span>
            </div>

            {/* VAT */}
            <div className="flex items-center gap-3 border-b border-gray-200 pb-2">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={applyVAT}
                  onChange={(e) => setApplyVAT(e.target.checked)}
                  className="rounded border-gray-300 text-brand-red focus:ring-brand-red"
                />
                VAT (20%)
              </label>
              <span className="ml-auto font-medium text-sm text-gray-700">
                {vatAmt > 0 ? `+ ${GHS(vatAmt)}` : "—"}
              </span>
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-1">
              <span className="text-base font-bold text-brand-dark">TOTAL</span>
              <span className="text-xl font-bold text-brand-red">{GHS(total)}</span>
            </div>

            {/* Deposit hint for quotes */}
            {docType === "quote" && total > 0 && (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800 space-y-0.5">
                <div><strong>60% deposit required:</strong> {GHS(round2(total * 0.6))}</div>
                <div><strong>Balance on delivery:</strong> {GHS(round2(total * 0.4))}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 05 Notes ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-6 mb-6">
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-red mb-4">
          05 — Notes / Terms
        </div>
        <textarea
          rows={3}
          className={`${inp} resize-y`}
          placeholder="Payment terms, delivery instructions, or any other notes for the client…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      {/* ── Actions ── */}
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {/* Left group: utility actions */}
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2.5 text-sm font-medium text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2.5 text-sm font-medium text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          🖨 Print / PDF
        </button>
        <button
          type="button"
          onClick={handleSendEmail}
          className="rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2.5 text-sm font-medium text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
        >
          ✉ Email
        </button>
        <button
          type="button"
          onClick={handleSendWhatsApp}
          className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2.5 text-sm font-medium text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-colors"
        >
          💬 WhatsApp
        </button>

        {/* Right group: status-advancing saves */}
        <div className="flex-1" />
        {docStatus !== "sent" && docStatus !== "paid" && (
          <button
            type="button"
            disabled={saving}
            onClick={handleMarkSent}
            className="rounded-lg border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/20 px-4 py-2.5 text-sm font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/30 disabled:opacity-60 transition-colors"
          >
            📤 Mark as Sent
          </button>
        )}
        {/* Payment recording is handled by Accounts → Payments tab.
            They select this invoice, record the payment, and the system
            creates the job and posts a receipt to the customer's portal. */}
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-lg bg-brand-red text-white text-sm font-semibold px-6 py-2.5 hover:bg-brand-red/90 disabled:opacity-60 transition-colors"
        >
          {saving ? "Saving…" : isEdit ? "Save changes" : `Save ${INVOICE_TYPES.find(t => t.value === docType)?.label}`}
        </button>
      </div>
    </div>
  );
}
