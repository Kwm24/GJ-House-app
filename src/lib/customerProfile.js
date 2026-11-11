/**
 * customerProfile.js
 * The customer's own profile (portal → Profile) and staff look-ups of a
 * customer's contact details (migration 042).
 */
import { supabase } from "./supabase.js";

const MISSING_042 = "Profile settings aren't set up yet. Run supabase/042_customer_profile_contact.sql in Supabase.";

function friendly(error) {
  const m = error?.message || "";
  if (error?.code === "PGRST202" || error?.code === "42703" || m.includes("update_my_profile") || m.includes("whatsapp")) {
    return new Error(MISSING_042);
  }
  return error;
}

// ── Customer: own profile ────────────────────────────────────────────────────
export async function getMyProfile() {
  const { data: { session } } = await supabase.auth.getSession();
  const uid = session?.user?.id;
  if (!uid) throw new Error("Please sign in again.");
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", uid).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateMyProfile({ fullName, phone, whatsapp, contactEmail, companyName, preferredContact }) {
  const { data, error } = await supabase.rpc("update_my_profile", {
    p_full_name:         fullName ?? "",
    p_phone:             phone ?? "",
    p_whatsapp:          whatsapp ?? "",
    p_contact_email:     contactEmail ?? "",
    p_company_name:      companyName ?? "",
    p_preferred_contact: preferredContact || null,
  });
  if (error) throw friendly(error);
  return Array.isArray(data) ? data[0] : data;
}

// How this account signs in: ["google"], ["email"] or both.
export function signInMethods(user) {
  const list = user?.app_metadata?.providers
    || (user?.identities ?? []).map((i) => i.provider)
    || [];
  return [...new Set(list.length ? list : [user?.app_metadata?.provider].filter(Boolean))];
}

// Change the email used to sign in (email/password accounts). Supabase sends
// a confirmation link to the new address; nothing changes until it's clicked.
export async function changeSignInEmail(email) {
  const { error } = await supabase.auth.updateUser(
    { email: email.trim() },
    { emailRedirectTo: `${window.location.origin}/customer` },
  );
  if (error) throw error;
}

// Set or change the password (Google users can add one to also sign in by email).
export async function setPassword(password) {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

// Sign this account out on every phone / computer.
export async function signOutEverywhere() {
  const { error } = await supabase.auth.signOut({ scope: "global" });
  if (error) throw error;
}

// ── Staff: how to reach a customer ───────────────────────────────────────────
// { name, phone, whatsapp, email, company, preferred, linked } — the customer
// account's details first, then the job's typed client name / phone.
export async function getJobCustomerContact(job) {
  const fallback = {
    name: job?.client_name || "", phone: job?.client_phone || "", whatsapp: job?.client_phone || "",
    email: "", company: "", preferred: null, linked: false,
  };
  if (!job?.id) return fallback;
  const { data, error } = await supabase.rpc("job_customer_contact", { p_job_id: job.id });
  if (error) {
    if (error.code !== "PGRST202") console.warn("[contact] job_customer_contact:", error.message);
    return fallback;   // 042 not run yet: behave as before
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return fallback;
  return {
    name: row.full_name || fallback.name,
    phone: row.phone || fallback.phone,
    whatsapp: row.whatsapp || row.phone || fallback.whatsapp,
    email: row.email || "",
    company: row.company_name || "",
    preferred: row.preferred_contact || null,
    linked: !!row.linked,
  };
}

// Open WhatsApp to a job's customer from a click (the window opens at once so
// pop-up blockers allow it, then goes to the right number).
export async function openCustomerWhatsApp(job) {
  const win = window.open("about:blank", "_blank");
  const c = await getJobCustomerContact(job);
  let d = String(c.whatsapp || "").replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = "233" + d.slice(1);
  const url = d ? `https://wa.me/${d}` : "https://wa.me/";
  if (win) { win.opener = null; win.location.href = url; } else window.location.href = url;
}

export async function getCustomerContact(userId) {
  if (!userId) return null;
  const { data, error } = await supabase.rpc("customer_contact", { p_user_id: userId });
  if (error) return null;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? { name: row.full_name || "", phone: row.phone || "", whatsapp: row.whatsapp || row.phone || "", email: row.email || "", preferred: row.preferred_contact || null } : null;
}
