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
