import { supabase } from "./supabase.js";

export async function listProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, user_id, role, full_name, phone, email, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function setProfileActive(profileId, isActive) {
  const { data, error } = await supabase
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", profileId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Calls the admin-create-user Edge Function, which uses the service-role
// key server-side to invite the user via Supabase Auth and create their
// profile row -- the service-role key must never live in client code.
export async function inviteUser({ email, role, fullName }) {
  const { data, error } = await supabase.functions.invoke("admin-create-user", {
    body: { email, role, fullName },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data;
}
