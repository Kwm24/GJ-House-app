/**
 * InvoiceBuilder.jsx
 * General-purpose quotation / invoice / receipt builder.
 * Picks items from the catalogue (or custom), calculates totals,
 * saves to Supabase, and prints a professional document.
 *
 * Supports:
 *  - Company logo (top-left of print header)
 *  - Accent colour (from admin settings) used in print CSS
 *  - Import line-items from a saved print quote (localStorage)
 */
import { useState, useMemo, useEffect } from "react";
import { useAuth } from "../AuthProvider.jsx";
import {
  saveInvoice, genInvoiceRef,
  INVOICE_TYPES, INVOICE_STATUSES, STATUS_COLORS,
} from "../../lib/invoices.js";
import { loadSavedQuotes } from "../../lib/quoteStorage.js";
import { formatGHS as GHS } from "../../lib/currency.js";

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
    thead tr { background:#1C1C1E; color:#fff; }
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

  ${state.notes ? `
  <div class="notes">
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
function buildSpecSummary(snap) {
  const j = snap.job || {};
  const sz = j.bookSize === "custom"
    ? `${j.bookW}″×${j.bookH}″`
    : (j.bookSize || "");
  const pages = j.numPages ? `${j.numPages}pp` : "";
  const body  = j.colours === "4" ? "FC body" : `${j.colours || "1"}C body`;
  const cover = j.hasCover
    ? `, FC cover${j.laminationType && j.laminationType !== "none" ? ` (${j.laminationType} lam)` : ""}`
    : "";
  const binding = j.bindingType ? `, ${j.bindingType} bound` : "";
  return [sz, pages, body + cover + binding].filter(Boolean).join(" · ");
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
      ? initial.line_items.map((li) => ({ ...li, _key: crypto.randomUUID() }))
      : [newLine()]
  );
  const [discountPct, setDiscountPct] = useState(Number(initial?.discount_pct ?? 0));
  const [applyVAT,    setApplyVAT]    = useState(Number(initial?.vat_amt ?? 0) > 0);
  const [notes,       setNotes]       = useState(initial?.notes ?? "");
  const [saving,      setSaving]      = useState(false);
  const [error,       setError]       = useState("");

  // ── Print-quote import
  const [savedPrintQuotes, setSavedPrintQuotes] = useState([]);
  const [importQuoteRef,   setImportQuoteRef]   = useState("");
  const [importQty,        setImportQty]        = useState("");

  useEffect(() => {
    try { setSavedPrintQuotes(loadSavedQuotes()); } catch {}
  }, []);

  const selectedImportQuote = useMemo(
    () => savedPrintQuotes.find((q) => q.ref === importQuoteRef) ?? null,
    [savedPrintQuotes, importQuoteRef]
  );

  function applyPrintQuoteImport() {
    if (!selectedImportQuote || !importQty) return;
    const snap   = selectedImportQuote;
    const qtyNum = Number(importQty);
    const result = snap.results?.[qtyNum];
    if (!result) return;

    const specSummary  = buildSpecSummary(snap);
    // Use price-per-copy BEFORE VAT so the invoice VAT toggle is accurate
    const pricePerCopy = result.orderedQty > 0
      ? round2((result.beforeVAT ?? result.grandTotal) / result.orderedQty)
      : round2(result.unitPrice ?? 0);

    setClientName(snap.clientName || "");
    setClientPhone(snap.clientPhone || "");
    setClientEmail(snap.clientEmail || "");

    setLineItems([{
      _key:        crypto.randomUUID(),
      itemId:      "",
      name:        snap.jobTitle || "Book printing",
      description: specSummary,
      unit:        "copy",
      qty:         result.orderedQty ?? qtyNum,
      unitPrice:   pricePerCopy,
    }]);

    // Mirror VAT setting from original quote
    setApplyVAT(!!(snap.job?.applyVAT));

    // Leave a reference note
    const existingNotes = notes.trim();
    setNotes(`Based on print quote ${snap.ref}${existingNotes ? "\n" + existingNotes : ""}`);

    // Reset the picker
    setImportQuoteRef("");
    setImportQty("");
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
    const found = catalogueItems.find((i) => i.name === val);
    if (found) {
      updateLine(key, {
        itemId: found.id,
        name: found.name,
        description: found.description || "",
        unit: found.unit,
        unitPrice: Number(found.unit_price),
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

  // ── Save
  async function handleSave() {
    const validLines = lineItems.filter((li) => li.name.trim() && Number(li.qty) > 0);
    if (validLines.length === 0) {
      setError("Add at least one line item with a name and quantity greater than zero.");
      return;
    }
    setError("");
    setSaving(true);
    try {
      const payload = {
        user_id: user?.id ?? null,
        ref, type: docType, status: docStatus,
        client_name:  clientName  || null,
        client_phone: clientPhone || null,
        client_email: clientEmail || null,
        date,
        due_date: dueDate || null,
        line_items: validLines.map((li) => ({
          itemId:      li.itemId  || null,
          name:        li.name,
          description: li.description || "",
          unit:        li.unit,
          qty:         Number(li.qty),
          unitPrice:   Number(li.unitPrice),
          total:       round2(Number(li.qty) * Number(li.unitPrice)),
        })),
        subtotal,
        discount_pct: discountPct,
        discount_amt: discountAmt,
        vat_amt:      vatAmt,
        total,
        notes: notes || null,
      };
      const result = await saveInvoice(payload, isEdit ? initial.id : null);
      onSaved(result);
    } catch (err) {
      setError(err.message ?? "Could not save.");
    } finally {
      setSaving(false);
    }
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

  const inpAmber =
    "w-full rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm text-gray-900 " +
    "placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-amber-400/40 focus:border-amber-500";

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">

      {/* Back */}
      <button type="button" onClick={onCancel}
        className="text-sm font-medium text-brand-cream/70 hover:text-brand-cream transition-colors mb-6 block">
        ← Back to invoices
      </button>

      {/* ── 00 — Import from print quote ── */}
      {savedPrintQuotes.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5 mb-4">
          <div className="text-xs font-semibold uppercase tracking-widest text-amber-700 mb-1">
            Import from saved print quote
          </div>
          <p className="text-xs text-amber-600 mb-3">
            Select a saved print quote to auto-fill client info and line items.
          </p>
          <div className="flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[220px]">
              <label className="block text-xs font-medium text-amber-700 mb-1.5">Select print quote</label>
              <select
                className={inpAmber}
                value={importQuoteRef}
                onChange={(e) => { setImportQuoteRef(e.target.value); setImportQty(""); }}
              >
                <option value="">— choose a saved print quote —</option>
                {savedPrintQuotes.map((q) => (
                  <option key={q.ref} value={q.ref}>
                    {q.ref} · {q.jobTitle || "Untitled"} · {q.clientName || "No client"}
                  </option>
                ))}
              </select>
            </div>

            {selectedImportQuote?.resultQtys?.length > 0 && (
              <div>
                <label className="block text-xs font-medium text-amber-700 mb-1.5">Quantity</label>
                <select
                  className={inpAmber}
                  value={importQty}
                  onChange={(e) => setImportQty(e.target.value)}
                  style={{ minWidth: 160 }}
                >
                  <option value="">— select qty —</option>
                  {selectedImportQuote.resultQtys.map((q) => {
                    const r = selectedImportQuote.results?.[q];
                    return (
                      <option key={q} value={q}>
                        {Number(q).toLocaleString()} copies
                        {r?.grandTotal ? ` — GH₵ ${Number(r.grandTotal).toLocaleString("en-GH", { minimumFractionDigits: 2 })}` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {importQty && (
              <button
                type="button"
                onClick={applyPrintQuoteImport}
                className="rounded-lg bg-amber-600 text-white text-sm font-semibold px-4 py-2 hover:bg-amber-700 transition-colors shrink-0"
              >
                Apply →
              </button>
            )}
          </div>
        </div>
      )}

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
        <div className="text-xs font-semibold uppercase tracking-widest text-brand-red mb-4">
          02 — Client information
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

        {catalogueItems.length > 0 && (
          <p className="text-xs text-gray-500 mb-3">
            💡 Type an item name — if it matches your catalogue it will pre-fill the price and unit.
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b-2 border-gray-300">
                <th className="py-2 pr-3">Item / Description</th>
                <th className="py-2 pr-3 text-center" style={{ width: 70 }}>Qty</th>
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
                      </datalist>
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
                      <input
                        type="number" min="0.01" step="any"
                        value={li.qty}
                        onChange={(e) => updateLine(li._key, { qty: e.target.value })}
                        className="w-16 text-center rounded-lg border border-gray-300 bg-white px-1.5 py-1.5 text-sm focus:outline-none focus:border-brand-red"
                      />
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

        <button
          type="button"
          onClick={addLine}
          className="mt-3 text-sm font-medium text-brand-red hover:underline"
        >
          + Add line item
        </button>
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
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-brand-cream hover:bg-white/20 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handlePrint}
          className="rounded-lg border border-white/20 bg-white/10 px-4 py-2.5 text-sm font-medium text-brand-cream hover:bg-white/20 transition-colors"
        >
          🖨 Print / PDF
        </button>
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
