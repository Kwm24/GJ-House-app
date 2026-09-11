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

// Self-registration for customers. Creates an Auth user then inserts a
// profiles row with role = "customer". Returns the new profile.
export async function signUpCustomer({ fullName, phone, email, password }) {
  const { data: authData, error: authErr } = await supabase.auth.signUp({
    email,
    password,
  });
  if (authErr) throw authErr;

  const userId = authData.user?.id;
  if (!userId) throw new Error("Sign-up succeeded but no user ID was returned.");

  const { error: profileErr } = await supabase.from("profiles").insert({
    user_id: userId,
    role: "customer",
    full_name: fullName.trim(),
    phone: phone.trim() || null,
  });
  if (profileErr) throw profileErr;

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
