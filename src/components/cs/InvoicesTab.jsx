import { useState, useEffect, useCallback } from "react";
import {
  listInvoices, deleteInvoice, genInvoiceRef,
  INVOICE_TYPES, STATUS_COLORS, TYPE_COLORS,
} from "../../lib/invoices.js";
import { listItems } from "../../lib/items.js";
import { getSettings } from "../../lib/settings.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import InvoiceBuilder from "./InvoiceBuilder.jsx";

const DEFAULT_COMPANY = {
  name: "YOUR PRESS NAME", address: "Street Address, Accra, Ghana",
  phone: "+233 XX XXX XXXX", email: "email@yourpress.com", vatNo: "",
};

const TYPE_LABELS = Object.fromEntries(INVOICE_TYPES.map((t) => [t.value, t.label]));

export function InvoicesTab() {
  const [mode,       setMode]       = useState("list"); // "list" | "create" | "edit" | "convert"
  const [editTarget, setEditTarget] = useState(null);

  const [invoices,   setInvoices]   = useState([]);
  const [items,      setItems]      = useState([]);
  const [company,    setCompany]    = useState(DEFAULT_COMPANY);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  // Filter
  const [typeFilter, setTypeFilter] = useState("all");

  const loadInvoices = useCallback(async () => {
    setLoading(true); setError("");
    try { setInvoices(await listInvoices()); }
    catch (err) { setError(err.message ?? "Could not load invoices."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    loadInvoices();
    listItems().then(setItems).catch(() => {});
    getSettings().then((d) => {
      if (d?.company_name) setCompany({
        name:    d.company_name    ?? DEFAULT_COMPANY.name,
        address: d.company_address ?? DEFAULT_COMPANY.address,
        phone:   d.company_phone   ?? DEFAULT_COMPANY.phone,
        email:   d.company_email   ?? DEFAULT_COMPANY.email,
        vatNo:   d.company_vat_no  ?? "",
      });
    }).catch(() => {});
  }, [loadInvoices]);

  function handleSaved(result) {
    loadInvoices();
    setMode("list");
    setEditTarget(null);
  }

  async function handleDelete(inv) {
    if (!window.confirm(`Delete ${TYPE_LABELS[inv.type]} ${inv.ref}? This cannot be undone.`)) return;
    try {
      await deleteInvoice(inv.id);
      setInvoices((prev) => prev.filter((i) => i.id !== inv.id));
    } catch (err) {
      setError(err.message ?? "Could not delete.");
    }
  }

  function handleConvert(inv) {
    // Open builder pre-filled with the invoice data but as a new "invoice" type
    setEditTarget({
      ...inv,
      id: null,           // new record
      type: "invoice",
      status: "draft",
      ref: genInvoiceRef("invoice"),
    });
    setMode("create");
  }

  // ── Builder modes
  if (mode === "create" || mode === "edit") {
    return (
      <InvoiceBuilder
        initial={mode === "edit" ? editTarget : (mode === "create" && editTarget ? editTarget : null)}
        catalogueItems={items}
        company={company}
        onSaved={handleSaved}
        onCancel={() => { setMode("list"); setEditTarget(null); }}
      />
    );
  }

  // ── List mode
  const filtered = typeFilter === "all"
    ? invoices
    : invoices.filter((i) => i.type === typeFilter);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-lg sm:text-xl font-semibold text-brand-cream">Invoices</h2>
          <p className="mt-0.5 text-sm text-brand-cream/60">
            Quotes, invoices, and receipts for all services.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setEditTarget(null); setMode("create"); }}
          className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 transition-colors shrink-0"
        >
          + New Invoice
        </button>
      </div>

      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        {/* Type filter */}
        <div className="flex gap-2 mb-5 flex-wrap">
          {[{ value: "all", label: "All" }, ...INVOICE_TYPES].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTypeFilter(t.value)}
              className={[
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                typeFilter === t.value
                  ? "bg-brand-dark text-white"
                  : "bg-white border border-gray-300 text-gray-600 hover:border-brand-red/50",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-sm">No invoices yet.</p>
            <p className="text-gray-400 text-xs mt-1">
              Click "+ New Invoice" to create your first quote, invoice, or receipt.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300">
                  <th className="py-2 pr-4">Ref</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((inv) => (
                  <tr key={inv.id} className="border-b border-gray-200 hover:bg-white/60 transition-colors">
                    <td className="py-2.5 pr-4 font-mono text-xs text-brand-dark font-medium">
                      {inv.ref}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${TYPE_COLORS[inv.type] ?? "bg-gray-100 text-gray-700"}`}>
                        {TYPE_LABELS[inv.type] ?? inv.type}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium capitalize ${STATUS_COLORS[inv.status] ?? "bg-gray-100 text-gray-700"}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-700">{inv.client_name || "—"}</td>
                    <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">{inv.date}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-brand-dark whitespace-nowrap">
                      {GHS(inv.total)}
                    </td>
                    <td className="py-2.5 pr-4">
                      <div className="flex items-center gap-3 flex-wrap">
                        <button
                          type="button"
                          onClick={() => { setEditTarget(inv); setMode("edit"); }}
                          className="text-xs font-medium text-brand-red hover:underline"
                        >
                          Edit
                        </button>
                        {inv.type === "quote" && (
                          <button
                            type="button"
                            onClick={() => handleConvert(inv)}
                            className="text-xs font-medium text-amber-700 hover:underline"
                          >
                            → Invoice
                          </button>
                        )}
                        {inv.type === "invoice" && (
                          <button
                            type="button"
                            onClick={() => handleConvert({ ...inv, type: "receipt" })}
                            className="text-xs font-medium text-green-700 hover:underline"
                          >
                            → Receipt
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDelete(inv)}
                          className="text-xs font-medium text-red-500 hover:underline"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
