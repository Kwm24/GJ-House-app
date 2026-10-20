import { supabase } from "./supabase.js";

export function genInvoiceRef(type) {
  const prefix = type === "receipt" ? "RCP" : type === "invoice" ? "INV" : "QT";
  const d = new Date();
  const ymd =
    `${d.getFullYear()}` +
    `${String(d.getMonth() + 1).padStart(2, "0")}` +
    `${String(d.getDate()).padStart(2, "0")}`;
  const seq = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}-${ymd}-${seq}`;
}

export const INVOICE_TYPES = [
  { value: "quote",   label: "Quotation" },
  { value: "invoice", label: "Invoice"   },
  { value: "receipt", label: "Receipt"   },
];

export const INVOICE_STATUSES = [
  { value: "draft",     label: "Draft"     },
  { value: "sent",      label: "Sent"      },
  { value: "paid",      label: "Paid"      },
  { value: "cancelled", label: "Cancelled" },
];

export const STATUS_COLORS = {
  draft:     "bg-gray-100 text-gray-700",
  sent:      "bg-blue-100 text-blue-800",
  paid:      "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-700",
};

export const TYPE_COLORS = {
  quote:   "bg-purple-100 text-purple-800",
  invoice: "bg-amber-100 text-amber-800",
  receipt: "bg-green-100 text-green-800",
};

export async function listInvoices() {
  const { data, error } = await supabase
    .from("invoices")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// Pass id to update an existing invoice, omit (or null) to create a new one.
export async function saveInvoice(payload, id = null) {
  if (id) {
    const { data, error } = await supabase
      .from("invoices")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
  const { data, error } = await supabase
    .from("invoices")
    .insert(payload)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteInvoice(id) {
  const { error } = await supabase.from("invoices").delete().eq("id", id);
  if (error) throw error;
}

// Fetch the ref + line_items for a batch of invoice refs in one query.
// Used by the Designer lobby to pull design-fee line items for each job
// without needing a FK relationship between jobs and invoices.
export async function listInvoicesByRefs(refs) {
  if (!refs || refs.length === 0) return [];
  const { data, error } = await supabase
    .from("invoices")
    .select("ref, line_items")
    .in("ref", refs);
  if (error) throw error;
  return data ?? [];
}

// Fetch a single invoice by its ref string — used by Production JobDetail to
// read line items (including print specs) for the job's matching invoice.
export async function getInvoiceByRef(ref) {
  if (!ref) return null;
  const { data, error } = await supabase
    .from("invoices")
    .select("ref, line_items")
    .eq("ref", ref)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Payment receipts linked to the currently signed-in customer.
// Only returns type='receipt' rows — the formal proof-of-payment document
// that Accounts creates when they record payment against an invoice.
// Quotes and invoices (the pre-payment documents) are intentionally excluded
// so customers see only confirmed payment records here.
export async function listCustomerInvoices() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("invoices")
    .select("id, ref, type, status, client_name, date, due_date, line_items, subtotal, discount_pct, discount_amt, vat_amt, total, notes, created_at")
    .eq("customer_id", user.id)
    .eq("type", "receipt")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// All documents (quotes, invoices, receipts) for the currently signed-in customer.
// Used by the customer portal "My Documents" tab.
export async function listCustomerDocuments() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("invoices")
    .select("id, ref, type, status, client_name, date, due_date, line_items, subtotal, discount_pct, discount_amt, vat_amt, total, notes, created_at")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// All invoices (quotes, invoices, receipts) for a specific customer.
// Used by CS and admin staff when viewing a customer's full document history.
export async function listInvoicesByCustomer(customerId) {
  const { data, error } = await supabase
    .from("invoices")
    .select("id, ref, type, status, client_name, date, due_date, subtotal, vat_amt, total, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}