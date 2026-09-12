import { supabase } from "./supabase.js";

function quoteGrandTotal(quoteSnapshot) {
  const primaryQty = quoteSnapshot?.resultQtys?.[0];
  return quoteSnapshot?.results?.[primaryQty]?.grandTotal ?? 0;
}

function depositFor(quoteSnapshot) {
  return Math.round(quoteGrandTotal(quoteSnapshot) * 0.6 * 100) / 100;
}

// Grand total of the quote a job was created from.
export function jobGrandTotal(job) {
  return quoteGrandTotal(job.quote);
}

// What's left to pay once the deposit has been settled.
export function jobBalanceDue(job) {
  return Math.round((jobGrandTotal(job) - Number(job.deposit_amount || 0)) * 100) / 100;
}

// Creates the job row the first time a quote is sent or approved.
// status is "sent" (awaiting payment) or "approved" (payment confirmed).
export async function createJob(userId, quoteSnapshot, status) {
  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      quote_ref: quoteSnapshot.ref,
      client_name: quoteSnapshot.clientName ?? "",
      client_phone: quoteSnapshot.clientPhone || null,
      job_title: quoteSnapshot.jobTitle ?? "",
      status,
      deposit_amount: depositFor(quoteSnapshot),
      quote: quoteSnapshot,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Every paid job (anything past "sent") — what the Accounts lobby's Jobs
// tab lists, since unpaid quotes have no deposit/balance to track yet.
// Includes the payments sub-array so actual cash received can be summed.
export async function listAccountsJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*, payments(id, amount, type, method, date)")
    .neq("status", "sent")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// Sum of all payment records linked to a job.
export function jobTotalPaid(job) {
  return Math.round(
    (job.payments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0) * 100
  ) / 100;
}

// Outstanding amount = grand total minus everything actually received so far.
export function jobOutstanding(job) {
  return Math.round((jobGrandTotal(job) - jobTotalPaid(job)) * 100) / 100;
}

// Lightweight job list for picker dropdowns (e.g. tagging an expenditure
// or payment to the job it belongs to). Includes deposit_amount and quote
// so the payments form can suggest the correct deposit figure.
export async function listJobsForPicker() {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, job_title, quote_ref, client_name, deposit_amount, quote")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// Every quote CS has sent, regardless of payment/approval status.
export async function listSentJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .not("sent_at", "is", null)
    .order("sent_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function markJobSent(jobId, sentVia) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ sent_at: new Date().toISOString(), sent_via: sentVia })
    .eq("id", jobId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Jobs the Production lobby's job list should show.
export async function listProductionJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .in("status", ["approved", "design_ready", "in_production"])
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// Jobs the Designer lobby's job list should show.
export async function listDesignerJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "ready_for_design")
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getJob(id) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data;
}

// Syncs an edited quote snapshot back to an existing job row — called when
// CS re-approves a quote that was already created (loaded from saved quotes).
export async function updateJobQuote(jobId, quoteSnapshot) {
  const { error } = await supabase
    .from("jobs")
    .update({
      quote:          quoteSnapshot,
      client_name:    quoteSnapshot.clientName ?? "",
      client_phone:   quoteSnapshot.clientPhone || null,
      job_title:      quoteSnapshot.jobTitle ?? "",
      deposit_amount: depositFor(quoteSnapshot),
    })
    .eq("id", jobId);

  if (error) throw error;
}

export async function updateJobStatus(jobId, status) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ status })
    .eq("id", jobId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function updateJobDeadline(jobId, deadline) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ deadline })
    .eq("id", jobId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Assign (or clear) a registered customer to a job so they can see it in the
// customer portal. Pass null to unlink.
export async function assignCustomerToJob(jobId, customerUserId) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ customer_id: customerUserId ?? null })
    .eq("id", jobId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Every job — for CS lobby's Jobs tab (CS can see all regardless of status).
export async function listAllJobsForCS() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// All jobs visible to the currently logged-in customer.
export async function listCustomerJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// List files in job-finals/{jobId}/ from Supabase Storage.
export async function listJobFinals(jobId) {
  const { data, error } = await supabase.storage
    .from("job-finals")
    .list(jobId, { limit: 50 });

  if (error) throw error;
  return data ?? [];
}

// Get a signed URL for a job-final file (valid for 1 hour).
export async function getJobFinalUrl(jobId, fileName) {
  const { data, error } = await supabase.storage
    .from("job-finals")
    .createSignedUrl(`${jobId}/${fileName}`, 3600);

  if (error) throw error;
  return data.signedUrl;
}

// Get a signed download URL (forces browser Save-As dialog).
export async function getJobFinalDownloadUrl(jobId, fileName) {
  const { data, error } = await supabase.storage
    .from("job-finals")
    .createSignedUrl(`${jobId}/${fileName}`, 3600, { download: true });

  if (error) throw error;
  return data.signedUrl;
}

// Upload a file (image or video) to job-finals/{jobId}/{fileName}.
// Overwrites if a file with the same name already exists.
export async function uploadJobFinal(jobId, file) {
  const path = `${jobId}/${file.name}`;
  const { error } = await supabase.storage
    .from("job-finals")
    .upload(path, file, { upsert: true });

  if (error) throw error;
  return path;
}

// Delete a file from job-finals/{jobId}/{fileName}.
export async function deleteJobFinal(jobId, fileName) {
  const { error } = await supabase.storage
    .from("job-finals")
    .remove([`${jobId}/${fileName}`]);

  if (error) throw error;
}
