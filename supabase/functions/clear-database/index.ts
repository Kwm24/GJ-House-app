// Deletes all transactional business data (jobs, expenditures, payments,
// notifications, job_files) for a year-end reset. Staff accounts (profiles)
// and app settings are deliberately preserved.
// Runs server-side because direct client deletes fail due to RLS policies
// not granting admin bulk-delete rights -- the service-role key bypasses RLS.
// Deploy: supabase functions deploy clear-database
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Delete in FK-child-first order so FK constraints don't block the deletes.
const TABLES_IN_ORDER = [
  "notifications",
  "job_files",
  "payments",
  "expenditures",
  "jobs",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey    = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  // Confirm the caller is an admin before wiping anything.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await callerClient.auth.getUser();
  if (authErr || !user) return json({ error: "Invalid session" }, 401);

  const adminClient = createClient(supabaseUrl, serviceKey);
  const { data: profile } = await adminClient
    .from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  if (profile?.role !== "admin") return json({ error: "Admins only" }, 403);

  // Double-check the caller passed the confirmation phrase as a body
  // field (belt-and-braces on top of the frontend text-box check).
  let body: { confirm?: string };
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }
  if (body.confirm !== "DELETE ALL DATA") {
    return json({ error: "Missing confirmation phrase" }, 400);
  }

  const errors: string[] = [];
  for (const table of TABLES_IN_ORDER) {
    const { error } = await adminClient
      .from(table)
      .delete()
      .gte("created_at", "2000-01-01");
    if (error) errors.push(`${table}: ${error.message}`);
  }

  if (errors.length > 0) {
    return json({ error: "Some tables could not be cleared", details: errors }, 500);
  }

  return json({ ok: true, cleared: TABLES_IN_ORDER });
});
