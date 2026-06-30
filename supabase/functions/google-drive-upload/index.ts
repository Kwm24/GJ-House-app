// Uploads a file to Google Drive using a Service Account.
// All Drive credentials stay server-side; the browser never sees the key.
//
// Setup (one-time):
//   1. Google Cloud Console → create a project → enable the Drive API.
//   2. IAM & Admin → Service Accounts → create an account → add a JSON key.
//   3. Google Drive → create your root folder + a shared resources folder →
//      share both with the service account email (Editor).
//   4. Set secrets:
//      PowerShell:
//        $json = Get-Content "C:\path\to\key.json" -Raw
//        $b64  = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
//        npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON=$b64
//        npx supabase secrets set GOOGLE_DRIVE_ROOT_FOLDER_ID="1Bxi..."
//        npx supabase secrets set GOOGLE_DRIVE_RESOURCES_FOLDER_ID="1Yqz..."
//   5. Deploy: supabase functions deploy google-drive-upload
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ── Google auth (Deno built-in Web Crypto — no external library) ─────────────

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
    throw new Error(
      "Could not parse GOOGLE_SERVICE_ACCOUNT_JSON. " +
      "Make sure you base64-encoded the full JSON key file."
    );
  }

  // JSON.parse converts \n escape sequences to real newlines, giving a
  // properly formatted PEM that Web Crypto can import directly.
  const pem = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
    false,
    ["sign"]
  );

  const now = Math.floor(Date.now() / 1000);
  const header  = toB64Url({ alg: "RS256", typ: "JWT" });
  const payload = toB64Url({
    iss:   sa.client_email,
    aud:   "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/drive.file",
    iat:   now,
    exp:   now + 3600,
  });

  const unsigned = `${header}.${payload}`;
  const sigBuf   = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
    cryptoKey,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${toB64Url(new Uint8Array(sigBuf))}`;

  const bodyStr =
    "grant_type=urn:ietf:params:oauth2:grant-type:jwt-bearer" +
    "&assertion=" + jwt;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: bodyStr,
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => res.statusText);
    throw new Error(`Google auth failed (${res.status}): ${errText}`);
  }
  const { access_token } = await res.json();
  return access_token;
}

// ── Drive upload ──────────────────────────────────────────────────────────────

async function uploadFile(
  token: string,
  fileBytes: Uint8Array,
  fileName: string,
  mimeType: string,
  folderId: string,
): Promise<{ id: string; webViewLink: string }> {
  const boundary = "ppgh-boundary";
  const metadata = JSON.stringify({ name: fileName, parents: [folderId] });
  const enc = new TextEncoder();

  const parts = [
    enc.encode(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    enc.encode(`--${boundary}\r\nContent-Type: ${mimeType}\r\n\r\n`),
    fileBytes,
    enc.encode(`\r\n--${boundary}--`),
  ];

  const totalLen = parts.reduce((s, p) => s + p.length, 0);
  const body = new Uint8Array(totalLen);
  let offset = 0;
  for (const part of parts) { body.set(part, offset); offset += part.length; }

  const res = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Drive upload failed: ${err.error?.message || res.statusText}`);
  }
  return res.json();
}

async function makePublicViewer(token: string, fileId: string): Promise<void> {
  await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}/permissions`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ role: "reader", type: "anyone" }),
  });
}

// ── CORS ──────────────────────────────────────────────────────────────────────

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

// ── Handler ───────────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Missing authorization" });

  const saJsonB64 = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");
  const rootId    = Deno.env.get("GOOGLE_DRIVE_ROOT_FOLDER_ID");
  const resId     = Deno.env.get("GOOGLE_DRIVE_RESOURCES_FOLDER_ID");

  if (!saJsonB64 || !rootId || !resId) {
    return json({
      error:
        "Google Drive is not configured. Run:\n" +
        "  $json = Get-Content 'key.json' -Raw\n" +
        "  $b64 = [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))\n" +
        "  npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON=$b64\n" +
        "  npx supabase secrets set GOOGLE_DRIVE_ROOT_FOLDER_ID='1Bxi...'\n" +
        "  npx supabase secrets set GOOGLE_DRIVE_RESOURCES_FOLDER_ID='1Yqz...'\n" +
        "Then: supabase functions deploy google-drive-upload",
      notConfigured: true,
    });
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const supaUrl = Deno.env.get("SUPABASE_URL");
  const caller  = createClient(supaUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await caller.auth.getUser();
  if (authErr || !user) return json({ error: "Invalid session" });

  const svcClient = createClient(supaUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: profile } = await svcClient
    .from("profiles").select("role").eq("user_id", user.id).maybeSingle();
  const allowedRoles = ["cs", "production", "designer", "accounts", "admin"];
  if (!profile || !allowedRoles.includes(profile.role)) return json({ error: "Not allowed" });

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return json({ error: "Expected multipart/form-data" });
  }

  const file       = formData.get("file") as File | null;
  const folder     = (formData.get("folder") as string) ?? "root";
  const customName = formData.get("fileName") as string | null;

  if (!file) return json({ error: "file field is required" });

  const folderId  = folder === "resources" ? resId : rootId;
  const fileName  = customName || file.name;
  const mimeType  = file.type || "application/octet-stream";
  const fileBytes = new Uint8Array(await file.arrayBuffer());

  try {
    const token = await getAccessToken(saJsonB64);
    const { id, webViewLink } = await uploadFile(token, fileBytes, fileName, mimeType, folderId);
    await makePublicViewer(token, id);
    return json({ driveFileId: id, webViewLink });
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : String(err) });
  }
});
