// Deletes a file from Google Drive by its file ID (moves to trash).
// Deploy: supabase functions deploy google-drive-delete
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function toB64Url(input: Uint8Array | object): string {
  const bytes = input instanceof Uint8Array
    ? input
    : new TextEncoder().encode(JSON.stringify(input));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function getAccessToken(saJsonB64: string): Promise<string> {
  let sa: { client_email: string; private_key: string };
  try {
    sa = JSON.parse(atob(saJsonB64));
  } catch {
    throw new Error("Could not parse GOOGLE_SERVICE_ACCOUNT_JSON.");
  }

  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", der,
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
    false, ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const header  = toB64Url({ alg: "RS256", typ: "JWT" });
  const payload = toB64Url({
    iss: sa.client_email, aud: "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/drive.file", iat: now, exp: now + 3600,
  });
  const unsigned = `${header}.${payload}`;
  const sigBuf = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
    cryptoKey, new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${toB64Url(new Uint8Array(sigBuf))}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=urn:ietf:params:oauth2:grant-type:jwt-bearer&assertion=" + jwt,
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Google auth failed (${res.status}): ${errText}`);
  }
  const { access_token } = await res.json();
  return access_token;
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
function json(data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" });

  const saJsonB64 = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  if (!saJsonB64) return json({ error: "Google Drive is not configured (GOOGLE_SERVICE_ACCOUNT_JSON missing)" });

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const caller  = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await caller.auth.getUser();
  if (authErr || !user) return json({ error: "Invalid session" });

  let body: { driveFileId?: string };
  try { body = await req.json(); } catch {
    return json({ error: "Invalid JSON body" });
  }
  if (!body.driveFileId) return json({ error: "driveFileId is required" });

  try {
    const token = await getAccessToken(saJsonB64);
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${body.driveFileId}`,
      { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok && res.status !== 404) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Drive delete failed: ${res.status}`);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) });
  }
});
