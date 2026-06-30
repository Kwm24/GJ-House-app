import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../AuthProvider.jsx";
import { listPayments, createPayment, deletePayment, PAYMENT_METHODS, PAYMENT_TYPES } from "../../lib/payments.js";
import { listJobsForPicker } from "../../lib/jobs.js";
import { subscribeToTable } from "../../lib/realtime.js";
import { getSettings } from "../../lib/settings.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { exportToCsv } from "../../lib/csvExport.js";

// Opens a new browser window with a formatted payment receipt and triggers
// the browser's print dialog. Works entirely client-side, no server needed.
function printPaymentReceipt(payment, company) {
  const receiptRef = `REC-${new Date().getFullYear()}${String(new Date().getMonth() + 1).padStart(2, "0")}-${payment.id.slice(-6).toUpperCase()}`;
  const jobInfo = payment.jobs
    ? `${payment.jobs.job_title || "Untitled job"} (${payment.jobs.quote_ref})`
    : "Not linked to a job";

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
    .receipt-title h1 { font-size: 16px; font-weight: 700; color: #C0392B; letter-spacing: 1px; text-transform: uppercase; }
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

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red";

function jobLabel(payment) {
  if (!payment.jobs) return "Not linked to a job";
  return `${payment.jobs.job_title || "Untitled job"} (${payment.jobs.quote_ref})`;
}

export function PaymentsTab() {
  const { user } = useAuth();
  const [mode, setMode] = useState("list");
  const [company, setCompany] = useState({ name: "PrintPress GH", address: "", phone: "", email: "", vatNo: "" });

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [jobOptions, setJobOptions] = useState([]);
  const [jobId, setJobId] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("deposit");
  const [method, setMethod] = useState(PAYMENT_METHODS[0]);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

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
          name: data.company_name,
          address: data.company_address || "",
          phone: data.company_phone || "",
          email: data.company_email || "",
          vatNo: data.company_vat_no || "",
        });
      }
    }).catch(() => {});
  }, []);

  // New payment submissions appear live without a manual refresh.
  useEffect(() => {
    return subscribeToTable("payments", () => loadPayments());
  }, [loadPayments]);

  useEffect(() => {
    if (mode !== "create") return;
    listJobsForPicker()
      .then(setJobOptions)
      .catch(() => setJobOptions([]));
  }, [mode]);

  function resetForm() {
    setJobId("");
    setAmount("");
    setType("deposit");
    setMethod(PAYMENT_METHODS[0]);
    setDate(new Date().toISOString().slice(0, 10));
    setFormError("");
  }

  async function handleSave() {
    if (!user) return;
    setFormError("");
    setSaving(true);
    try {
      await createPayment({
        jobId: jobId || null,
        amount: Number(amount),
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
      payments.map((p) => ({
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
        <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
          <button
            type="button"
            onClick={() => {
              resetForm();
              setMode("list");
            }}
            className="text-sm font-medium text-gray-500 hover:text-brand-red transition-colors"
          >
            ← Back to payments
          </button>

          <h2 className="mt-4 text-lg sm:text-xl font-semibold text-brand-dark">
            Record payment
          </h2>
          <p className="mt-1 text-sm text-gray-600">
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Job (optional)</label>
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className={inputClass}>
                <option value="">— Not linked to a job —</option>
                {jobOptions.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.quote_ref} — {j.job_title || j.client_name || "Untitled"}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Amount (GHS)</label>
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
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
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
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Type</label>
                <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
                  {PAYMENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Method</label>
                <select value={method} onChange={(e) => setMethod(e.target.value)} className={inputClass}>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Clear
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-lg bg-brand-red text-white text-sm font-semibold py-2.5 px-4 hover:bg-brand-red/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving…" : "Save payment"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Payments</h2>
            <p className="mt-1 text-sm text-gray-600">
              Deposits and balance payments received via MoMo, cash, or bank transfer.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={payments.length === 0}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              ⬇ Export CSV
            </button>
            <button
              type="button"
              onClick={() => setMode("create")}
              className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2 hover:bg-brand-red/90 transition-colors"
            >
              + Record Payment
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin"
              aria-label="Loading"
            />
          </div>
        ) : !error && payments.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500 py-8">
            No payments recorded yet.
          </p>
        ) : payments.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Method</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-200">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">{p.date}</td>
                    <td className="py-2.5 pr-4 text-brand-dark">{jobLabel(p)}</td>
                    <td className="py-2.5 pr-4 text-right font-medium text-brand-dark whitespace-nowrap">
                      {GHS(p.amount)}
                    </td>
                    <td className="py-2.5 pr-4 capitalize text-gray-600">{p.type}</td>
                    <td className="py-2.5 pr-4 text-gray-600">{p.method}</td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => printPaymentReceipt(p, company)}
                          className="text-brand-red hover:underline text-xs font-medium"
                        >
                          🖨 Receipt
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemove(p)}
                          className="text-red-600 hover:underline text-xs font-medium"
                        >
                          Remove
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
