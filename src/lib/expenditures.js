import { supabase } from "./supabase.js";

export async function uploadReceipt(userId, file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("receipts").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function createExpenditure({
  userId, description, amount, date, vendor, lineItems,
  receiptPath, recordedBy, jobId,
}) {
  const { data, error } = await supabase
    .from("expenditures")
    .insert({
      user_id: userId,
      description,
      amount,
      date,
      vendor: vendor ?? null,
      line_items: lineItems ?? [],
      receipt_path: receiptPath ?? null,
      recorded_by: recordedBy ?? null,
      job_id: jobId ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listExpenditures(userId) {
  const { data, error } = await supabase
    .from("expenditures")
    .select("*, jobs(job_title, quote_ref)")
    .eq("user_id", userId)
    .order("date", { ascending: false });

  if (error) throw error;
  return data;
}

export async function listAllExpenditures() {
  const { data, error } = await supabase
    .from("expenditures")
    .select("*, jobs(job_title, quote_ref, client_name)")
    .order("date", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getReceiptSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from("receipts")
    .createSignedUrl(path, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

export async function deleteExpenditure(id) {
  const { error } = await supabase.from("expenditures").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteReceipt(path) {
  const { error } = await supabase.storage.from("receipts").remove([path]);
  if (error) throw error;
}
