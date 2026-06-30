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
export async function listAccountsJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .neq("status", "sent")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// Lightweight job list for picker dropdowns (e.g. tagging an expenditure
// or payment to the job it belongs to).
export async function listJobsForPicker() {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, job_title, quote_ref, client_name")
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
