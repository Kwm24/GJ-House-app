import { supabase } from "./supabase.js";

// Uploads the company logo to the public company-assets bucket, stores the
// public URL in settings, and returns the URL.
export async function uploadCompanyLogo(file) {
  const ext = file.name.split(".").pop() || "png";
  const path = `logo.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from("company-assets")
    .getPublicUrl(path);

  await updateSettings({ company_logo_url: publicUrl });
  return publicUrl;
}

export async function getSettings() {
  const { data, error } = await supabase
    .from("settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function updateSettings(patch) {
  const { data, error } = await supabase
    .from("settings")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", 1)
    .select()
    .single();

  if (error) throw error;
  return data;
}
