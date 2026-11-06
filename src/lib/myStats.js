/**
 * myStats.js
 * Raw data for the per-account lobby dashboards (CS, Production, Designer).
 * Every query is scoped to the signed-in user; the dashboards do the counting
 * so the period picker can re-slice without refetching.
 */
import { supabase } from "./supabase.js";

async function me() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user;
}

// CS: documents this person created + quotes they saved.
export async function getMyCSStats() {
  const user = await me();
  const [inv, quotes] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, ref, type, status, client_name, date, total, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("saved_quotes")
      .select("quote_type, ref, created_at")
      .eq("saved_by", user.id),
  ]);
  if (inv.error) throw inv.error;
  if (quotes.error) throw quotes.error;
  return { documents: inv.data ?? [], savedQuotes: quotes.data ?? [] };
}

// Production: jobs assigned to this producer + expenses they recorded.
export async function getMyProductionStats() {
  const user = await me();
  const [jobs, exp] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, quote_ref, job_title, client_name, status, deadline, created_at")
      .eq("assigned_producer_id", user.id),
    supabase
      .from("expenditures")
      .select("id, amount, date, created_at")
      .eq("user_id", user.id),
  ]);
  if (jobs.error) throw jobs.error;
  if (exp.error) throw exp.error;
  return { jobs: jobs.data ?? [], expenditures: exp.data ?? [] };
}

// Designer: jobs assigned to this designer + design files they uploaded.
export async function getMyDesignerStats() {
  const user = await me();
  const [jobs, files] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, quote_ref, job_title, client_name, status, deadline, created_at, design_approved")
      .eq("assigned_designer_id", user.id),
    supabase
      .from("job_files")
      .select("id, job_id, created_at")
      .eq("uploaded_by", user.id)
      .eq("file_type", "design"),
  ]);
  if (jobs.error) throw jobs.error;
  if (files.error) throw files.error;
  return { jobs: jobs.data ?? [], uploads: files.data ?? [] };
}

// Whether this production account may edit the Digital Print Quoter rates.
// Read separately (not in getProfile) so sign-in keeps working even before
// migration 037 has been run.
export async function getMyRatesPermission() {
  const user = await me();
  const { data, error } = await supabase
    .from("profiles")
    .select("can_edit_digital_rates")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) return false;
  return !!data?.can_edit_digital_rates;
}
