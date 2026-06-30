import { useState, useRef, useEffect, useCallback } from "react";
import { useAuth } from "./AuthProvider.jsx";
import {
  createExpenditure,
  uploadReceipt,
  listExpenditures,
  getReceiptSignedUrl,
  deleteExpenditure,
  deleteReceipt,
} from "../lib/expenditures.js";
import { listJobsForPicker } from "../lib/jobs.js";
import { formatGHS as GHS } from "../lib/currency.js";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red";

export function ExpenditureRecorder({ recordedBy }) {
  const { user } = useAuth();
  const scanInputRef = useRef(null);
  const uploadInputRef = useRef(null);

  const [mode, setMode] = useState("list"); // "list" | "create"

  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [jobId, setJobId] = useState("");
  const [jobOptions, setJobOptions] = useState([]);
  const [receiptFile, setReceiptFile] = useState(null);
  const [receiptPreview, setReceiptPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [expenditures, setExpenditures] = useState([]);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState("");

  const loadExpenditures = useCallback(async () => {
    if (!user) return;
    setListLoading(true);
    setListError("");
    try {
      const data = await listExpenditures(user.id);
      setExpenditures(data);
    } catch (err) {
      setListError(err.message ?? "Could not load expenditures.");
    } finally {
      setListLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadExpenditures();
  }, [loadExpenditures]);

  useEffect(() => {
    if (mode !== "create") return;
    listJobsForPicker()
      .then(setJobOptions)
      .catch(() => setJobOptions([]));
  }, [mode]);

  async function handleViewReceipt(path) {
    try {
      const url = await getReceiptSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(err.message ?? "Could not load receipt.");
    }
  }

  async function handleRemoveExpenditure(exp) {
    if (!window.confirm(`Remove "${exp.description}"? This cannot be undone.`)) {
      return;
    }
    try {
      await deleteExpenditure(exp.id);
      if (exp.receipt_path) deleteReceipt(exp.receipt_path).catch(() => {});
      setExpenditures((prev) => prev.filter((e) => e.id !== exp.id));
    } catch (err) {
      setListError(err.message ?? "Could not remove expenditure.");
    }
  }

  function handleReceiptFile(file) {
    if (!file) return;
    setError("");
    setSuccess("");
    setReceiptFile(file);
    setReceiptPreview(URL.createObjectURL(file));
  }

  function resetForm() {
    setDescription("");
    setVendor("");
    setAmount("");
    setDate(new Date().toISOString().slice(0, 10));
    setJobId("");
    setReceiptFile(null);
    setReceiptPreview(null);
    setError("");
    setSuccess("");
    if (scanInputRef.current) scanInputRef.current.value = "";
    if (uploadInputRef.current) uploadInputRef.current.value = "";
  }

  async function handleSave() {
    if (!user) return;

    setError("");
    setSuccess("");
    setSaving(true);

    try {
      let receiptPath = null;
      if (receiptFile) {
        receiptPath = await uploadReceipt(user.id, receiptFile);
      }

      await createExpenditure({
        userId: user.id,
        description: description.trim(),
        amount: Number(amount),
        date,
        vendor: vendor.trim() || null,
        lineItems: [],
        receiptPath,
        recordedBy,
        jobId: jobId || null,
      });

      resetForm();
      setSuccess("Expenditure saved successfully.");
      loadExpenditures();
      setMode("list");
    } catch (err) {
      setError(err.message ?? "Could not save expenditure.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      {mode === "create" ? (
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <button
          type="button"
          onClick={() => setMode("list")}
          className="text-sm font-medium text-gray-500 hover:text-brand-red transition-colors"
        >
          ← Back to expenditures
        </button>

        <h2 className="mt-4 text-lg sm:text-xl font-semibold text-brand-dark">
          Record expenditure
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Log expenses and attach a photo of the receipt.
        </p>

        <form
          className="mt-6 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            handleSave();
          }}
        >
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Description
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className={inputClass}
              placeholder="e.g. Paper supplies — Accra Stationers"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Vendor
            </label>
            <input
              type="text"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              className={inputClass}
              placeholder="e.g. Accra Stationers"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Job (optional)
            </label>
            <select
              value={jobId}
              onChange={(e) => setJobId(e.target.value)}
              className={inputClass}
            >
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
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Amount (GHS)
              </label>
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
              <label className="block text-xs font-medium text-gray-600 mb-1.5">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Receipt
            </label>
            <div className="flex flex-col sm:flex-row gap-3">
              <label
                className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 hover:border-brand-red hover:text-brand-red transition-colors"
              >
                📷 Take photo
                <input
                  ref={scanInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={(e) => handleReceiptFile(e.target.files?.[0])}
                />
              </label>
              <label
                className="flex-1 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-center text-sm font-medium text-gray-700 hover:border-brand-red hover:text-brand-red transition-colors"
              >
                🖼 Upload image
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => handleReceiptFile(e.target.files?.[0])}
                />
              </label>
            </div>

            {receiptPreview && (
              <div className="mt-4">
                <img
                  src={receiptPreview}
                  alt="Receipt preview"
                  className="max-h-40 rounded-lg border border-gray-200 object-contain"
                />
              </div>
            )}
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
              {saving ? "Saving…" : "Save expenditure"}
            </button>
          </div>
        </form>
      </div>
      ) : (
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">
            Expenditure
          </h2>
          <button
            type="button"
            onClick={() => setMode("create")}
            className="shrink-0 rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 transition-colors"
          >
            + Add Expenditure
          </button>
        </div>

        {listError && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {listError}
          </div>
        )}

        {listLoading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin"
              aria-label="Loading"
            />
          </div>
        ) : !listError && expenditures.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500 py-8">
            No expenditures recorded yet.
          </p>
        ) : expenditures.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300">
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4">Description</th>
                  <th className="py-2 pr-4">Vendor</th>
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4 text-right">Amount</th>
                  <th className="py-2 pr-4">Receipt</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {expenditures.map((exp) => (
                  <tr key={exp.id} className="border-b border-gray-200">
                    <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">
                      {exp.date}
                    </td>
                    <td className="py-2.5 pr-4 text-brand-dark">
                      {exp.description}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      {exp.vendor || "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">
                      {exp.jobs?.quote_ref ?? "—"}
                    </td>
                    <td className="py-2.5 pr-4 text-right font-medium text-brand-dark whitespace-nowrap">
                      {GHS(exp.amount)}
                    </td>
                    <td className="py-2.5 pr-4">
                      {exp.receipt_path ? (
                        <button
                          type="button"
                          onClick={() => handleViewReceipt(exp.receipt_path)}
                          className="text-brand-red hover:underline text-xs font-medium"
                        >
                          View
                        </button>
                      ) : (
                        <span className="text-gray-400 text-xs">—</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-4">
                      <button
                        type="button"
                        onClick={() => handleRemoveExpenditure(exp)}
                        className="text-red-600 hover:underline text-xs font-medium"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
      )}
    </div>
  );
}
