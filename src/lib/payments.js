import { supabase } from "./supabase.js";

export const PAYMENT_METHODS = [
  "MTN MoMo",
  "Telecel Cash",
  "AirtelTigo Money",
  "Bank transfer",
  "Cash",
];

export const PAYMENT_TYPES = [
  { value: "deposit", label: "Deposit" },
  { value: "balance", label: "Balance" },
];

export async function listPayments() {
  const { data, error } = await supabase
    .from("payments")
    .select("*, jobs(job_title, quote_ref, client_name)")
    .order("date", { ascending: false });

  if (error) throw error;
  return data;
}

export async function createPayment({ jobId, amount, type, method, date, recordedBy }) {
  const { data, error } = await supabase
    .from("payments")
    .insert({
      job_id: jobId ?? null,
      amount,
      type,
      method,
      date,
      recorded_by: recordedBy ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deletePayment(id) {
  const { error } = await supabase.from("payments").delete().eq("id", id);
  if (error) throw error;
}
