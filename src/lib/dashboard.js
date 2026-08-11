import { supabase } from "./supabase.js";

// Fetches summary data for the Admin Dashboard in a single parallel request.
// Jobs include their per-job payments sub-array so actual cash-received can
// be summed per job without a separate N+1 query.
export async function getDashboardData() {
  const [jobsRes, expRes, profilesRes, paymentsRes] = await Promise.all([
    supabase
      .from("jobs")
      .select("id, status, quote, deposit_amount, created_at, job_title, client_name, payments(id, amount, type)")
      .neq("status", "sent"),
    supabase.from("expenditures").select("id, amount, created_at"),
    supabase.from("profiles").select("id, role, is_active"),
    // Recent payments feed — includes job info for display
    supabase
      .from("payments")
      .select("id, amount, type, method, date, job_id, jobs(job_title, client_name, quote_ref)")
      .order("date", { ascending: false })
      .limit(10),
  ]);

  if (jobsRes.error) throw jobsRes.error;
  if (expRes.error) throw expRes.error;
  if (profilesRes.error) throw profilesRes.error;
  if (paymentsRes.error) throw paymentsRes.error;

  return {
    jobs: jobsRes.data ?? [],
    expenditures: expRes.data ?? [],
    profiles: profilesRes.data ?? [],
    payments: paymentsRes.data ?? [],
  };
}
