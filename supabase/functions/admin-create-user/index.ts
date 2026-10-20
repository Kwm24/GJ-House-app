// Creates a new staff/customer account. Runs server-side because it needs
// the Supabase service-role key (auth.admin.*) -- that key must never be
// shipped to the browser, so this can't be done from client code directly.
//
// Deploy via the Supabase CLI: `supabase functions deploy admin-create-user`
// (or via Dashboard -> Edge Functions if your project supports pasting code
// there). SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are
// injected automatically by the platform -- no manual secrets needed.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ROLES = ["cs", "production", "designer", "accounts", "customer", "admin"];

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" }, 401);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
  if (callerError || !caller) return json({ error: "Invalid session" }, 401);

  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: callerProfile } = await adminClient
    .from("profiles").select("role").eq("user_id", caller.id).maybeSingle();
  const callerRole = callerProfile?.role ?? null;

  let body;
  try { body = await req.json(); } catch {
    return json({ error: "Invalid request body" }, 400);
  }

  const { action = "create", email, role, fullName, userId: targetUserId, newEmail } = body ?? {};

  // ── action: update_email ───────────────────────────────────────────────────
  if (action === "update_email") {
    if (!["cs", "admin"].includes(callerRole)) return json({ error: "CS or admin only" }, 403);
    if (!targetUserId || !newEmail) return json({ error: "userId and newEmail are required" }, 400);

    const { error: authErr } = await adminClient.auth.admin.updateUserById(targetUserId, { email: newEmail });
    if (authErr) return json({ error: authErr.message }, 400);

    // Keep the profiles table in sync
    await adminClient.from("profiles").update({ email: newEmail }).eq("user_id", targetUserId);

    return json({ ok: true, email: newEmail });
  }

  // ── action: send_password_reset ────────────────────────────────────────────
  if (action === "send_password_reset") {
    if (!["cs", "admin"].includes(callerRole)) return json({ error: "CS or admin only" }, 403);
    if (!email) return json({ error: "email is required" }, 400);

    const { error: resetErr } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email,
    });
    if (resetErr) return json({ error: resetErr.message }, 400);

    return json({ ok: true });
  }

  // ── action: create (default) ───────────────────────────────────────────────
  if (callerRole !== "admin") return json({ error: "Admins only" }, 403);

  if (!email || !role || !ALLOWED_ROLES.includes(role)) {
    return json({ error: "A valid email and role are required" }, 400);
  }

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(
    email, { data: { full_name: fullName ?? null } }
  );
  if (inviteError) return json({ error: inviteError.message }, 400);

  const { error: profileError } = await adminClient.from("profiles").insert({
    user_id: invited.user.id,
    role,
    full_name: fullName ?? null,
    email,
  });
  if (profileError) return json({ error: profileError.message }, 400);

  return json({ user: { id: invited.user.id, email } });
});
