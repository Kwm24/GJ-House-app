import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../AuthProvider.jsx";
import { listPayments, createPayment, deletePayment, PAYMENT_METHODS, PAYMENT_TYPES } from "../../lib/payments.js";
import { listJobsForPicker, jobGrandTotal, createJobFromInvoice, jobTotalPaid } from "../../lib/jobs.js";
import { listInvoices, saveInvoice, genInvoiceRef } from "../../lib/invoices.js";
import { subscribeToTable } from "../../lib/realtime.js";
import { getSettings } from "../../lib/settings.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { exportToCsv } from "../../lib/csvExport.js";
import { CustomerPicker } from "../CustomerPicker.jsx";
import { Banknote, AlertCircle, CheckCircle2, Download, Plus, Printer, Trash2, ArrowLeft, Search } from "lucide-react";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";

// Opens a new browser window with a formatted payment receipt and triggers
// the browser's print dialog. Works entirely client-side, no server needed.
function printPaymentReceipt(payment, company) {
  const receiptRef = `REC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${payment.id.slice(-6).toUpperCase()}`;
  const jobInfo = payment.jobs
    ? `${payment.jobs.job_title || "Untitled job"} (${payment.jobs.quote_ref})`
    : "Not linked to a job";
  const invoiceTotal = payment.jobs ? jobGrandTotal(payment.jobs) : 0;
  const totalPaidSoFar = payment.jobs ? jobTotalPaid(payment.jobs) : Number(payment.amount);
  const balanceDue = invoiceTotal > 0 ? Math.round((invoiceTotal - totalPaidSoFar) * 100) / 100 : null;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Payment Receipt ${receiptRef}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; padding: 48px; color: #1C1C1E; max-width: 640px; margin: 0 auto; }
    .header { border-bottom: 2px solid #1C1C1E; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .company-name { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    .company-sub { font-size: 11px; color: #666; margin-top: 4px; }
    .receipt-title { text-align: right; }
    .receipt-title h1 { font-size: 16px; font-weight: 700; color: ${company.accentHex || "#C0392B"}; letter-spacing: 1px; text-transform: uppercase; }
    .receipt-title p { font-size: 12px; color: #555; margin-top: 4px; }
    .amount-box { background: #1C1C1E; color: #fff; border-radius: 8px; padding: 20px 24px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center; }
    .amount-box .label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; opacity: 0.6; }
    .amount-box .value { font-size: 28px; font-weight: 800; }
    .details { border: 1px solid #E0D9CF; border-radius: 8px; overflow: hidden; margin-bottom: 24px; }
    .detail-row { display: flex; border-bottom: 1px solid #E0D9CF; }
    .detail-row:last-child { border-bottom: none; }
    .detail-row .key { width: 40%; background: #F5F0E8; padding: 10px 14px; font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #888; font-weight: 600; }
    .detail-row .val { padding: 10px 14px; font-size: 13px; font-weight: 500; }
    .footer { font-size: 10px; color: #AAA; text-align: center; border-top: 1px solid #E0D9CF; padding-top: 16px; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="company-name">${company.name}</div>
      <div class="company-sub">${company.address}</div>
      <div class="company-sub">${company.phone} · ${company.email}</div>
    </div>
    <div class="receipt-title">
      <h1>Payment Receipt</h1>
      <p>Ref: <strong>${receiptRef}</strong></p>
      <p>Date: ${payment.date}</p>
    </div>
  </div>

  <div class="amount-box">
    <div>
      <div class="label">Amount received</div>
      <div class="value">${GHS(payment.amount)}</div>
    </div>
    <div style="text-align:right">
      <div class="label">Payment type</div>
      <div style="font-size:16px;font-weight:700;margin-top:4px;text-transform:capitalize">${payment.type}</div>
    </div>
  </div>

  <div class="details">
    <div class="detail-row"><div class="key">Job</div><div class="val">${jobInfo}</div></div>
    <div class="detail-row"><div class="key">Client</div><div class="val">${payment.jobs?.client_name || "—"}</div></div>
    <div class="detail-row"><div class="key">Method</div><div class="val">${payment.method}</div></div>
    <div class="detail-row"><div class="key">Payment date</div><div class="val">${payment.date}</div></div>
    <div class="detail-row"><div class="key">Receipt ref</div><div class="val">${receiptRef}</div></div>
  </div>

  ${balanceDue !== null ? `
  <div style="border:1.5px solid ${company.accentHex || "#C0392B"};border-radius:8px;overflow:hidden;margin-bottom:24px;">
    <div style="background:${company.accentHex || "#C0392B"};color:#fff;padding:7px 14px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">Balance Summary</div>
    <div style="padding:12px 14px;font-size:12px;display:flex;flex-direction:column;gap:8px;">
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#666;">Invoice Total</span>
        <span style="font-family:monospace;">${GHS(invoiceTotal)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span style="color:#666;">Total Paid</span>
        <span style="font-family:monospace;">${GHS(totalPaidSoFar)}</span>
      </div>
      <div style="display:flex;justify-content:space-between;border-top:1px solid #E0D9CF;padding-top:8px;">
        <span style="font-weight:700;">Balance Due on Delivery</span>
        <span style="font-family:monospace;font-weight:800;font-size:15px;color:${balanceDue <= 0 ? "#10B981" : "#1C1C1E"};">
          ${balanceDue <= 0 ? "PAID IN FULL" : GHS(balanceDue)}
        </span>
      </div>
    </div>
  </div>` : ""}

  <div class="footer">
    ${company.vatNo} · This is an official receipt issued by ${company.name}.
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const win = window.open("", "_blank", "width=700,height=900");
  if (win) {
    win.document.write(html);
    win.document.close();
  }
}

const inputClass = "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-3.5 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors";
const LBL = "block text-xs font-medium text-[var(--t-text2)] mb-1.5";

function jobLabel(payment) {
  if (!payment.jobs) return "Not linked to a job";
  return `${payment.jobs.job_title || "Untitled job"} (${payment.jobs.quote_ref})`;
}

export function PaymentsTab() {
  const { user } = useAuth();
  const [mode, setMode] = useState("list");
  const [company, setCompany] = useState({ name: "PrintPress GH", address: "", phone: "", email: "", vatNo: "", accentHex: "#C0392B" });

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState(defaultPeriod());

  // ── form state ──────────────────────────────────────────────────────────────
  // Invoice picker (primary) — when selected, creates job + receipt automatically
  const [invoiceOptions,    setInvoiceOptions]    = useState([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState("");
  // Manual job picker — only used if no invoice is selected
  const [jobOptions, setJobOptions] = useState([]);
  const [jobId,      setJobId]      = useState("");

  // Customer link — initialised from invoice.customer_id, overridable via CustomerPicker.
  // This controls whether a portal receipt is created and whether the job is customer-linked.
  const [pickedCustomerId, setPickedCustomerId] = useState(null);
  const [pickedCustomerName, setPickedCustomerName] = useState("");

  // Whether this job needs design work — shows the "Send to Design" panel in CS Active Jobs.
  const [jobNeedsDesign, setJobNeedsDesign] = useState(false);

  const [amount,    setAmount]    = useState("");
  const [type,      setType]      = useState("deposit");
  const [method,    setMethod]    = useState(PAYMENT_METHODS[0]);
  const [date,      setDate]      = useState(new Date().toISOString().slice(0, 10));
  const [saving,    setSaving]    = useState(false);
  const [formError, setFormError] = useState("");

  const selectedInvoice = invoiceOptions.find((i) => i.id === selectedInvoiceId) ?? null;
  const selectedJob     = jobOptions.find((j) => j.id === jobId)                 ?? null;

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setPayments(await listPayments());
    } catch (err) {
      setError(err.message ?? "Could not load payments.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  useEffect(() => {
    getSettings().then((data) => {
      if (data?.company_name) {
        setCompany({
          name:          data.company_name      || "",
          address:       data.company_address   || "",
          phone:         data.company_phone     || "",
          email:         data.company_email     || "",
          vatNo:         data.company_vat_no    || "",
          accentHex:     data.accent_color      || "#C0392B",
        });
      }
    }).catch(() => {});
  }, []);

  // New payment submissions appear live without a manual refresh.
  useEffect(() => {
    return subscribeToTable("payments", () => loadPayments());
  }, [loadPayments]);

  // Load invoices and jobs when entering the record-payment form
  useEffect(() => {
    if (mode !== "create") return;
    Promise.all([
      listJobsForPicker(),
      listInvoices(),
    ]).then(([jobs, invoices]) => {
      setJobOptions(jobs);
      // Only show open (unsettled) invoices — exclude already-paid or cancelled ones
      setInvoiceOptions(
        invoices.filter((inv) => inv.status !== "paid" && inv.status !== "cancelled")
      );
    }).catch(() => {});
  }, [mode]);

  function handleInvoiceChange(id) {
    setSelectedInvoiceId(id);
    const inv = invoiceOptions.find((i) => i.id === id);
    if (inv) {
      setAmount(Number(inv.total).toFixed(2));
      setJobId("");
      setPickedCustomerId(inv.customer_id || null);
      setPickedCustomerName(inv.customer_id ? (inv.client_name || "") : "");
      // Auto-detect: if any line item has category "design", route to designer lobby
      const hasDesignItems = (inv.line_items ?? []).some(
        (li) => (li.category || "").toLowerCase() === "design"
      );
      setJobNeedsDesign(hasDesignItems);
    } else {
      setPickedCustomerId(null);
      setPickedCustomerName("");
    }
  }

  function resetForm() {
    setSelectedInvoiceId("");
    setJobId("");
    setPickedCustomerId(null);
    setPickedCustomerName("");
    setJobNeedsDesign(false);
    setAmount("");
    setType("deposit");
    setMethod(PAYMENT_METHODS[0]);
    setDate(new Date().toISOString().slice(0, 10));
    setFormError("");
  }

  async function handleSave() {
    if (!user) return;
    if (!amount || Number(amount) <= 0) {
      setFormError("Please enter a payment amount greater than zero.");
      return;
    }
    setFormError("");
    setSaving(true);
    try {
      let resolvedJobId = jobId || null;

      if (selectedInvoice) {
        // The effective customer link: Accounts may have picked one even if CS didn't.
        const effectiveCustomerId = pickedCustomerId || null;

        // ── Step 1: Create / update the job ───────────────────────────────────
        const jobTitle = selectedInvoice.line_items?.[0]?.name || "Print Job";
        const job = await createJobFromInvoice(user.id, {
          ref:           selectedInvoice.ref,
          clientName:    selectedInvoice.client_name    || "",
          clientPhone:   selectedInvoice.client_phone   || null,
          jobTitle,
          total:         selectedInvoice.total,
          needsDesign:   jobNeedsDesign,       // checked by Accounts if job needs design work
          // Restore the original PrintQuoteGH snapshot if CS imported from one —
          // this gives Production/Designer the full SpecSheet (plates, paper, binding…).
          quoteSnapshot: selectedInvoice.quote_snapshot || null,
          customerId:    effectiveCustomerId,  // links job to customer so it shows in their portal
        });
        resolvedJobId = job.id;

        // ── Step 2: Mark the original invoice as paid ─────────────────────────
        await saveInvoice({ status: "paid" }, selectedInvoice.id);

        // ── Step 3: Create a receipt for the customer portal ──────────────────
        // Runs whenever we have a customer link — either from the original invoice
        // or from the CustomerPicker that Accounts used when recording this payment.
        if (effectiveCustomerId) {
          await saveInvoice({
            user_id:      user.id,
            ref:          genInvoiceRef("receipt"),
            type:         "receipt",
            status:       "paid",
            client_name:  selectedInvoice.client_name  || null,
            client_phone: selectedInvoice.client_phone || null,
            client_email: selectedInvoice.client_email || null,
            date,
            due_date:     null,
            line_items:   selectedInvoice.line_items   ?? [],
            subtotal:     selectedInvoice.subtotal,
            discount_pct: selectedInvoice.discount_pct,
            discount_amt: selectedInvoice.discount_amt,
            vat_amt:      selectedInvoice.vat_amt,
            total:        Number(amount),   // actual amount received (may differ from invoice total)
            notes:        `Payment received on ${date} via ${method}. Original invoice: ${selectedInvoice.ref}`,
            customer_id:  effectiveCustomerId,
          });
        }
      }

      // ── Step 4: Record the payment entry ──────────────────────────────────
      await createPayment({
        jobId:      resolvedJobId,
        amount:     Number(amount),
        type,
        method,
        date,
        recordedBy: user.id,
      });

      resetForm();
      setMode("list");
      loadPayments();
    } catch (err) {
      setFormError(err.message ?? "Could not record payment.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(payment) {
    if (!window.confirm("Remove this payment record? This cannot be undone.")) return;
    try {
      await deletePayment(payment.id);
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    } catch (err) {
      setError(err.message ?? "Could not remove payment.");
    }
  }

  function handleExport() {
    exportToCsv(
      `accounts-payments-${new Date().toISOString().slice(0, 10)}.csv`,
      periodPayments.map((p) => ({
        Date: p.date,
        Job: jobLabel(p),
        "Amount (GHS)": Number(p.amount || 0).toFixed(2),
        Type: p.type,
        Method: p.method,
      }))
    );
  }

  if (mode === "create") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 sm:p-8">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setMode("list");
            }}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-[var(--t-muted)] hover:text-[#6366F1] transition-colors"
          >
            <ArrowLeft size={14} /> Back to payments
          </button>

          <h2 className="mt-4 text-lg font-semibold text-[var(--t-text1)]">
            Record payment
          </h2>
          <p className="mt-1 text-sm text-[var(--t-muted)]">
            Log a deposit or balance payment received from a client.
          </p>

          {formError && (
            <div
              role="alert"
              className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
            >
              {formError}
            </div>
          )}

          <form
            className="mt-6 space-y-5"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
          >

            {/* ── Primary: select the invoice / quote being settled ── */}
            <div>
              <label className={LBL}>
                Invoice / Quote
                <span className="text-gray-400 font-normal ml-1">
                  — selecting one creates the job and sends a receipt to the customer automatically
                </span>
              </label>
              <select
                value={selectedInvoiceId}
                onChange={(e) => handleInvoiceChange(e.target.value)}
                className={inputClass}
              >
                <option value="">— Select an outstanding invoice or quote —</option>
                {invoiceOptions.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.ref}  ·  {inv.client_name || "No client"}  ·  {GHS(inv.total)}  [{inv.type}]
                  </option>
                ))}
              </select>

              {selectedInvoice && (
                <div className="mt-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 text-xs text-[var(--t-text2)] space-y-2">
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    <span><strong className="text-[var(--t-text1)]">{selectedInvoice.client_name || "—"}</strong></span>
                    {selectedInvoice.client_phone && <span>{selectedInvoice.client_phone}</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                    <span>Invoice total: <strong className="text-[var(--t-text1)]">{GHS(selectedInvoice.total)}</strong></span>
                    <button type="button" className="text-[#6366F1] underline decoration-dotted font-medium"
                      onClick={() => { setType("deposit"); setAmount((Number(selectedInvoice.total) * 0.6).toFixed(2)); }}>
                      Use 60% deposit ({GHS(Number(selectedInvoice.total) * 0.6)})
                    </button>
                    <button type="button" className="text-[#6366F1] underline decoration-dotted font-medium"
                      onClick={() => { setType("balance"); setAmount(Number(selectedInvoice.total).toFixed(2)); }}>
                      Use full amount
                    </button>
                  </div>

                  <div className="pt-2 border-t border-[var(--t-border)]">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-[var(--t-text2)]">Customer account (for portal receipt)</span>
                      {pickedCustomerId && (
                        <button type="button" onClick={() => { setPickedCustomerId(null); setPickedCustomerName(""); }}
                          className="text-[var(--t-muted)] hover:text-red-600 text-xs transition-colors">
                          Clear
                        </button>
                      )}
                    </div>
                    {pickedCustomerId ? (
                      <p className="text-emerald-600 font-medium mb-1.5">
                        {pickedCustomerName || "Customer"} linked
                      </p>
                    ) : (
                      <p className="text-amber-600 mb-1.5">No customer account linked</p>
                    )}
                    <CustomerPicker onSelect={({ name, userId }) => { setPickedCustomerId(userId ?? null); setPickedCustomerName(name || ""); }} />
                  </div>

                  <label className="flex items-center gap-2 pt-2 border-t border-[var(--t-border)] cursor-pointer select-none">
                    <input type="checkbox" checked={jobNeedsDesign} onChange={(e) => setJobNeedsDesign(e.target.checked)}
                      className="h-4 w-4 rounded border-[var(--t-border)] accent-[#6366F1]" />
                    <span className="font-semibold text-[var(--t-text2)]">Job needs design work</span>
                  </label>
                </div>
              )}
            </div>

            {/* ── Fallback: manual job link (only shown if no invoice selected) ── */}
            {!selectedInvoice && (
              <div>
                <label className={LBL}>
                  Job <span className="text-[var(--t-muted)] font-normal">(optional)</span>
                </label>
                <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputClass}>
                  <option value="">Not linked to a job</option>
                  {jobOptions.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.quote_ref} — {j.job_title || j.client_name || "Untitled"}
                    </option>
                  ))}
                </select>
                {selectedJob && (
                  <div className="mt-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-xs text-[var(--t-text2)] flex flex-wrap gap-x-4 gap-y-1">
                    <span>Grand total: <strong className="text-[var(--t-text1)]">{GHS(jobGrandTotal(selectedJob))}</strong></span>
                    <button type="button" className="font-semibold text-[#6366F1] underline decoration-dotted"
                      onClick={() => { setType("deposit"); setAmount(Number(selectedJob.deposit_amount).toFixed(2)); }}>
                      60% deposit ({GHS(selectedJob.deposit_amount)})
                    </button>
                    <button type="button" className="font-semibold text-[#6366F1] underline decoration-dotted"
                      onClick={() => { setType("balance"); setAmount((jobGrandTotal(selectedJob) * 0.4).toFixed(2)); }}>
                      Balance ({GHS(jobGrandTotal(selectedJob) * 0.4)})
                    </button>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LBL}>Amount (GHS)</label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass}
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className={LBL}>Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className={LBL}>Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                  {PAYMENT_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LBL}>Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                  {PAYMENT_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button type="button" onClick={resetForm}
                className="rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-4 py-2.5 text-sm font-medium text-[var(--t-text2)] hover:bg-gray-50 dark:hover:bg-white/5 active:scale-95 transition-all duration-150">
                Clear
              </button>
              <button type="submit" disabled={saving}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg bg-[#6366F1] text-white text-sm font-semibold py-2.5 px-4 hover:bg-[#4F46E5] hover:shadow-btn-primary active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150">
                {saving ? (
                  <><span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> Saving...</>
                ) : "Save payment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // Period-filtered payments (drives both stats and table)
  const periodPayments = filterByPeriod(payments, period, "date");
  const totalReceived  = periodPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const depositTotal   = periodPayments.filter((p) => p.type === "deposit").reduce((s, p) => s + Number(p.amount || 0), 0);
  const balanceTotal   = periodPayments.filter((p) => p.type === "balance").reduce((s, p) => s + Number(p.amount || 0), 0);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-5">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Period filter */}
      <PeriodPicker period={period} onChange={setPeriod} accentColor="#6366F1" bgVar="--t-bg" />

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center shrink-0">
            <Banknote size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--t-muted)]">Total Received</p>
            <p className="text-xl font-bold font-display -tracking-tight text-[var(--t-text1)]">{GHS(totalReceived)}</p>
          </div>
        </div>
        <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center shrink-0">
            <AlertCircle size={18} className="text-[#6366F1]" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--t-muted)]">Deposits</p>
            <p className="text-xl font-bold font-display -tracking-tight text-[var(--t-text1)]">{GHS(depositTotal)}</p>
          </div>
        </div>
        <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-sky-50 dark:bg-sky-900/20 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} className="text-sky-600" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--t-muted)]">Balances Paid</p>
            <p className="text-xl font-bold font-display -tracking-tight text-[var(--t-text1)]">{GHS(balanceTotal)}</p>
          </div>
        </div>
      </div>

      {/* List card */}
      <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-base font-semibold text-[var(--t-text1)]">Payments</h2>
            <p className="text-xs text-[var(--t-muted)] mt-0.5">
              Deposits and balance payments received via MoMo, cash, or bank transfer.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={handleExport} disabled={payments.length === 0}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--t-border)] text-[var(--t-text2)] text-sm font-medium px-3 py-2 hover:bg-gray-50 dark:hover:bg-white/5 active:scale-95 disabled:opacity-50 transition-all duration-150">
              <Download size={13} /> Export CSV
            </button>
            <button type="button" onClick={() => setMode("create")}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#6366F1] text-white text-sm font-semibold px-4 py-2 hover:bg-[#4F46E5] hover:shadow-btn-primary active:translate-y-px transition-all duration-150">
              <Plus size={13} /> Record Payment
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
          <input
            type="text"
            placeholder="Search by job, client, type or method…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-bg)] pl-9 pr-4 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors"
          />
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map((i) => <div key={i} className="h-12 rounded-lg bg-gray-100 dark:bg-white/10 animate-pulse" />)}
          </div>
        ) : (() => {
          const q = search.toLowerCase().trim();
          const filtered = q
            ? periodPayments.filter((p) =>
                jobLabel(p).toLowerCase().includes(q) ||
                (p.jobs?.client_name ?? "").toLowerCase().includes(q) ||
                (p.type ?? "").toLowerCase().includes(q) ||
                (p.method ?? "").toLowerCase().includes(q))
            : periodPayments;
          return filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--t-muted)]">
              {search ? "No payments match your search." : "No payments recorded yet."}
            </p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[var(--t-muted)] border-b border-[var(--t-border)]">
                  <th className="py-2 pr-4 font-bold">Date</th>
                  <th className="py-2 pr-4 font-bold">Job</th>
                  <th className="py-2 pr-4 text-right font-bold">Amount</th>
                  <th className="py-2 pr-4 font-bold">Type</th>
                  <th className="py-2 pr-4 font-bold">Method</th>
                  <th className="py-2 pr-4 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-[var(--t-border)] hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-[var(--t-text2)]">{p.date}</td>
                    <td className="py-2.5 pr-4 text-[var(--t-text1)]">{jobLabel(p)}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-[var(--t-text1)] whitespace-nowrap">
                      {GHS(p.amount)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        p.type === "deposit" ? "bg-indigo-50 text-[#6366F1] dark:bg-indigo-900/20"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20"
                      }`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-[var(--t-text2)]">{p.method}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={() => printPaymentReceipt(p, company)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#6366F1] hover:underline transition-colors">
                          <Printer size={11} /> Receipt
                        </button>
                        <button type="button" onClick={() => handleRemove(p)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-700 transition-colors">
                          <Trash2 size={11} /> Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          );
        })()}
      </div>
    </div>
  );
}
