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

// Returns all registered customers (for the CS customer-assignment picker).
export async function listCustomers() {
  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, full_name, phone")
    .eq("role", "customer")
    .order("full_name", { ascending: true });

  if (error) throw error;
  return data ?? [];
}
