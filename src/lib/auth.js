import { supabase } from "./supabase.js";

export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function getProfile(userId) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, role, full_name, phone, is_active")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// Self-registration for customers.
// Passes full_name, phone, and role as user metadata so the database trigger
// (015_auth_trigger.sql) can create the profiles row server-side — this avoids
// any RLS issues that occur when email confirmation is enabled and there is
// no active session at the point the profile needs to be inserted.
export async function signUpCustomer({ fullName, phone, email, password }) {
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role:      "customer",
        full_name: fullName.trim(),
        phone:     phone.trim() || null,
      },
    },
  });
  if (authErr) throw authErr;
  if (!authData.user?.id) throw new Error("Sign-up succeeded but no user ID was returned.");
  return authData;
}

// Self-registration for staff (cs, designer, production).
// Works exactly like signUpCustomer — the role comes from whichever lobby's
// signup page the user visited, and the DB trigger sets it on the profile row.
export async function signUpStaff({ fullName, phone, email, password, role }) {
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role:      role,
        full_name: fullName.trim(),
        phone:     phone.trim() || null,
      },
    },
  });
  if (authErr) throw authErr;
  if (!authData.user?.id) throw new Error("Sign-up succeeded but no user ID was returned.");
  return authData;
}

// Returns all registered designers (for the admin designer-assignment dropdown).
export async function listDesigners() {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .eq("role", "designer")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Returns all registered production staff (for the admin producer-assignment dropdown).
export async function listProducers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name")
    .eq("role", "production")
    .order("full_name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Returns all registered customers (for the CS customer-assignment picker).
export async function listCustomers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone, email, is_active, created_at")
    .eq("role", "customer")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}

// Update a customer's editable profile fields (name + phone only).
export async function updateCustomerProfile(userId, { fullName, phone }) {
  const { data, error } = await supabase
    .from("profiles")
    .update({
      full_name: fullName?.trim() || null,
      phone:     phone?.trim()    || null,
    })
    .eq("user_id", userId)
    .eq("role", "customer")
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Update a customer's email address via the admin Edge Function.
// Requires the caller to be CS or admin.
export async function updateCustomerEmail(userId, newEmail) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: { action: "update_email", userId, newEmail: newEmail.trim() },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}

// Send a password-reset link to a customer's email address.
// Uses Supabase's built-in recovery flow — no service-role key needed.
export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + "/reset-password",
  });
  if (error) throw error;
}
