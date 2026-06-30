import { supabase } from "./supabase.js";

// Fetches summary data for the Admin Dashboard in a single parallel request.
export async function getDashboardData() {
  const [jobsRes, expRes, profilesRes, paymentsRes] = await Promise.all([
    supabase.from("jobs").select("id, status, quote, deposit_amount, created_at, job_title, client_name").neq("status", "sent"),
    supabase.from("expenditures").select("id, amount, created_at"),
    supabase.from("profiles").select("id, role, is_active"),
    supabase.from("payments").select("id, amount, type, created_at"),
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
