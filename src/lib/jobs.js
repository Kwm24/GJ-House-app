import { supabase } from "./supabase.js";

function quoteGrandTotal(quoteSnapshot) {
  // Invoices holding several saved quotes store the invoice total on the bundle
  if (quoteSnapshot?.quoteType === "multi") {
    return quoteSnapshot?.grandTotal ?? 0;
  }
  // Digital quotes store the total directly in result.sellPrice
  if (quoteSnapshot?.quoteType === "digital") {
    return quoteSnapshot?.result?.sellPrice ?? 0;
  }
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

// Jobs the Designer lobby's job list should show:
// anything in a design step, OR flagged needs_design but not yet terminal.
export async function listDesignerJobs() {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .or("status.in.(ready_for_design,design_review),and(needs_design.eq.true,status.neq.delivered,status.neq.completed)")
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// Mark a job as needing design and move it to ready_for_design status.
// Called from the CS Jobs tab "Send to Design Team" button.
export async function sendToDesign(jobId) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ needs_design: true, status: "ready_for_design" })
    .eq("id", jobId)
    .select()
    .single();

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

// The designer's "design ready by" date (migration 044), shown to the customer.
export async function updateJobDesignDue(jobId, designDue) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ design_due: designDue || null })
    .eq("id", jobId)
    .select()
    .single();
  if (error) {
    if (String(error.message || "").includes("design_due")) {
      throw new Error("Run supabase/044_targeted_notifications_and_design_due.sql in Supabase first.");
    }
    throw error;
  }
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

const TERMINAL = ["delivered", "completed", "cancelled"];

// The job an invoice's payment belongs to, if one already exists:
//   1. a job created from this document or the quotation it was converted from
//   2. an open job created from the same saved quote, for the same customer
async function findJobForInvoice({ refs, quoteSnapshot, customerId }) {
  const { data: byRef, error } = await supabase
    .from("jobs")
    .select("id, status, created_at")
    .in("quote_ref", refs)
    .order("created_at", { ascending: true })
    .limit(1);
  if (error) throw error;
  if (byRef?.length) return byRef[0];

  const snapRef = quoteSnapshot?.quoteType !== "multi" ? quoteSnapshot?.ref : null;
  if (snapRef && customerId) {
    const { data: bySnap, error: e2 } = await supabase
      .from("jobs")
      .select("id, status, created_at")
      .eq("quote->>ref", snapRef)
      .eq("customer_id", customerId)
      .not("status", "in", `(${TERMINAL.join(",")})`)
      .order("created_at", { ascending: true })
      .limit(1);
    if (e2) throw e2;
    if (bySnap?.length) return bySnap[0];
  }
  return null;
}

// Create a job from invoice data when Accounts records a payment.
// If the order already has a job (an earlier deposit, or the quotation this
// invoice was converted from), that job is reused. An existing job's status
// is never moved backwards: a balance payment on a job that's in design or
// production leaves it where it is.
export async function createJobFromInvoice(userId, {
  ref, sourceRef, clientName, clientPhone, jobTitle, total, needsDesign, quoteSnapshot,
  customerId,   // optional: links the job to a registered customer account
}) {
  const refs = [...new Set([ref, sourceRef].filter(Boolean))];
  const existing = await findJobForInvoice({ refs, quoteSnapshot, customerId });

  if (existing) {
    const { data, error } = await supabase.rpc("confirm_job_payment", {
      p_job_id:       existing.id,
      p_customer_id:  customerId || null,
      p_needs_design: !!needsDesign,
    });
    if (!error) return Array.isArray(data) ? data[0] : data;
    if (error.code !== "PGRST202") throw error;

    // Migration 041 not run yet: same forward-only rule, done directly
    const patch = {};
    if (existing.status === "sent") patch.status = needsDesign ? "ready_for_design" : "approved";
    if (customerId) patch.customer_id = customerId;
    if (!Object.keys(patch).length) return existing;
    const { data: upd, error: updErr } = await supabase
      .from("jobs").update(patch).eq("id", existing.id).select().maybeSingle();
    if (updErr) throw updErr;
    return upd ?? existing;
  }

  const depositAmount = Math.round(Number(total || 0) * 0.6 * 100) / 100;

  // Use the full print-quote snapshot as the job's quote JSONB if available,
  // otherwise build a minimal stand-in so the spec sheet still renders.
  const snapshot = quoteSnapshot ?? {
    ref,
    clientName: clientName || "",
    clientPhone: clientPhone || null,
    jobTitle: jobTitle || "Print Job",
    resultQtys: [],
    results: {},
  };

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id:        userId,
      quote_ref:      ref,
      client_name:    clientName  || "",
      client_phone:   clientPhone || null,
      job_title:      jobTitle    || "Print Job",
      status:         needsDesign ? "ready_for_design" : "approved",
      deposit_amount: depositAmount,
      needs_design:   needsDesign || false,
      quote:          snapshot,
      customer_id:    customerId  || null,
    })
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
  // Filter explicitly too: staff accounts can read every job, so relying on
  // row security alone would show them other customers' jobs here.
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) return [];
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("customer_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Save internal staff notes on a job (visible only to staff, not customers).
export async function updateJobNotes(jobId, notes) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ notes: notes?.trim() || null })
    .eq("id", jobId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// All jobs for a specific customer — used by CS/admin staff when viewing a customer profile.
export async function listJobsByCustomer(customerId) {
  const { data, error } = await supabase
    .from("jobs")
    .select("id, job_title, quote_ref, status, deposit_amount, quote, created_at, payments(amount)")
    .eq("customer_id", customerId)
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

// Assign (or clear) a designer to a job so it appears in their "My Jobs" tab.
// Pass null to unassign. Called by admin from the designer lobby's Jobs tab.
export async function assignDesigner(jobId, designerUserId) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ assigned_designer_id: designerUserId || null })
    .eq("id", jobId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Jobs assigned to the currently signed-in designer.
// Only returns jobs where assigned_designer_id matches the logged-in user.
export async function listMyDesignJobs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("assigned_designer_id", user.id)
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Assign (or clear) a producer to a job so it appears in their "My Jobs" tab.
// Pass null to unassign. Called by admin from the production lobby's Jobs tab.
export async function assignProducer(jobId, producerUserId) {
  const { data, error } = await supabase
    .from("jobs")
    .update({ assigned_producer_id: producerUserId || null })
    .eq("id", jobId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Jobs assigned to the currently signed-in producer.
// Only returns jobs where assigned_producer_id matches the logged-in user.
export async function listMyProductionJobs() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("assigned_producer_id", user.id)
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}

// Permanently deletes a job row. Admin-only (enforced by RLS).
// Payments/expenditures survive with job_id set null; job_files cascade-delete.
export async function deleteJob(jobId) {
  const { error } = await supabase
    .from("jobs")
    .delete()
    .eq("id", jobId);
  if (error) throw error;
}

// Customer approves the designer's artwork — sets design_approved=true and
// moves the job from design_review to design_ready, giving production the
// green light (migration 041 only allows it while the design awaits them).
// Uses a SECURITY DEFINER RPC so customers don't need a broad UPDATE policy.
export async function approveDesign(jobId) {
  const { error } = await supabase.rpc("approve_job_design", { p_job_id: jobId });
  if (error) throw error;
}
