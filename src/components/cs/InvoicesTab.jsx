import { useState, useEffect, useCallback, useRef } from "react";
import { Search } from "lucide-react";
import {
  listInvoices, deleteInvoice, genInvoiceRef,
  INVOICE_TYPES, STATUS_COLORS, TYPE_COLORS,
} from "../../lib/invoices.js";
import { listItems } from "../../lib/items.js";
import { getSettings } from "../../lib/settings.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import InvoiceBuilder from "./InvoiceBuilder.jsx";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";

const DEFAULT_COMPANY = {
  name: "YOUR PRESS NAME", address: "Street Address, Accra, Ghana",
  phone: "+233 XX XXX XXXX", email: "email@yourpress.com", vatNo: "",
  logoUrl: "", accentHex: "#C0392B",
  momoNumber: "", bankName: "", accountNumber: "", accountName: "",
};

const TYPE_LABELS = Object.fromEntries(INVOICE_TYPES.map((t) => [t.value, t.label]));

export function InvoicesTab({ focusInvoiceId, onFocusConsumed }) {
  const [mode,       setMode]       = useState("list");
  const [editTarget, setEditTarget] = useState(null);

  const [invoices,   setInvoices]   = useState([]);
  const [items,      setItems]      = useState([]);
  const [company,    setCompany]    = useState(DEFAULT_COMPANY);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState("");

  const [typeFilter, setTypeFilter] = useState("all");
  const [search,     setSearch]     = useState("");
  const [period,     setPeriod]     = useState(defaultPeriod());

  // Track whether we've already acted on the incoming focusInvoiceId so we
  // don't re-open the same invoice on every re-render.
  const handledFocusRef = useRef(null);

  const loadInvoices = useCallback(async () => {
    setLoading(true); setError("");
    try { setInvoices(await listInvoices()); }
    catch (err) { setError(err.message ?? "Could not load invoices."); }
    finally { setLoading(false); }
  }, []);

  // When a focusInvoiceId arrives (from customer profile navigation), open
  // that invoice in edit mode as soon as the list is loaded.
  useEffect(() => {
    if (!focusInvoiceId || loading || handledFocusRef.current === focusInvoiceId) return;
    const target = invoices.find((inv) => inv.id === focusInvoiceId);
    if (!target) return;
    handledFocusRef.current = focusInvoiceId;
    setEditTarget(target);
    setMode("edit");
    onFocusConsumed?.();
  }, [focusInvoiceId, invoices, loading, onFocusConsumed]);

  useEffect(() => {
    loadInvoices();
    listItems().then(setItems).catch(() => {});
    getSettings().then((d) => {
      if (d) setCompany({
        name:      d.company_name    ?? DEFAULT_COMPANY.name,
        address:   d.company_address ?? DEFAULT_COMPANY.address,
        phone:     d.company_phone   ?? DEFAULT_COMPANY.phone,
        email:     d.company_email   ?? DEFAULT_COMPANY.email,
        vatNo:     d.company_vat_no  ?? "",
        logoUrl:   d.company_logo_url ?? "",
        accentHex:     d.accent_color    ?? "#C0392B",
        momoNumber:    d.momo_number     ?? "",
        bankName:      d.bank_name       ?? "",
        accountNumber: d.account_number  ?? "",
        accountName:   d.account_name    ?? "",
      });
    }).catch(() => {});
  }, [loadInvoices]);

  function handleSaved() {
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
    setEditTarget({
      ...inv,
      id: null,
      type: "invoice",
      status: "draft",
      ref: genInvoiceRef("invoice"),
    });
    setMode("create");
  }

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

  const q = search.toLowerCase().trim();
  const filtered = filterByPeriod(invoices, period)
    .filter((i) => typeFilter === "all" || i.type === typeFilter)
    .filter((i) => !q || (
      (i.ref ?? "").toLowerCase().includes(q) ||
      (i.client_name ?? "").toLowerCase().includes(q) ||
      (i.status ?? "").toLowerCase().includes(q) ||
      (TYPE_LABELS[i.type] ?? "").toLowerCase().includes(q)
    ));

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
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--t-text1)]">Invoices</h2>
          <p className="mt-0.5 text-sm text-[var(--t-muted)]">
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

      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        {/* Period filter */}
        <div className="mb-4">
          <PeriodPicker period={period} onChange={setPeriod} accentColor="#C0392B" />
        </div>

        {/* Type filter */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[{ value: "all", label: "All" }, ...INVOICE_TYPES].map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTypeFilter(t.value)}
              className={[
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors",
                typeFilter === t.value
                  ? "bg-[var(--t-text1)] text-[var(--t-bg)]"
                  : "bg-[var(--t-bg)] border border-[var(--t-border)] text-[var(--t-text2)] hover:border-brand-red/50",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
          <input
            type="text"
            placeholder="Search by ref, client, status…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-bg)] pl-9 pr-4 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-colors"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-[var(--t-muted)] text-sm">
              {search || typeFilter !== "all" ? "No invoices match your search." : "No invoices yet."}
            </p>
            {!search && typeFilter === "all" && (
              <p className="text-[var(--t-muted)] text-xs mt-1">
                Click "+ New Invoice" to create your first quote, invoice, or receipt.
              </p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--t-muted)] border-b border-[var(--t-border)]">
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
                  <tr key={inv.id} className="border-b border-[var(--t-border)] hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                    <td className="py-2.5 pr-4 font-mono text-xs text-[var(--t-text1)] font-medium">
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
                    <td className="py-2.5 pr-4 text-[var(--t-text2)]">{inv.client_name || "—"}</td>
                    <td className="py-2.5 pr-4 text-[var(--t-muted)] whitespace-nowrap">{inv.date}</td>
                    <td className="py-2.5 pr-4 text-right font-semibold text-[var(--t-text1)] whitespace-nowrap">
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
