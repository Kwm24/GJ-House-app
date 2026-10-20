import { supabase } from "./supabase.js";

// Uploads the company logo to the public company-assets bucket, stores the
// public URL in settings, and returns the URL.
export async function uploadServiceImage(index, file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `landing/service-${index}-img.${ext}`;
  const { error } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage
    .from("company-assets")
    .getPublicUrl(path);
  return publicUrl;
}

export async function uploadLandingImage(section, file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `landing/${section}-bg.${ext}`;
  const { error } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage
    .from("company-assets")
    .getPublicUrl(path);
  return publicUrl;
}

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

export async function uploadFavicon(file) {
  const ext = file.name.split(".").pop() || "png";
  const path = `favicon.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (uploadError) throw uploadError;

  const { data: { publicUrl } } = supabase.storage
    .from("company-assets")
    .getPublicUrl(path);

  await updateSettings({ favicon_url: publicUrl });
  return publicUrl;
}

export function applyFavicon(url) {
  if (!url) return;
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.href = url;
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

export async function uploadQuoterThumbnail(jobType, file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `quoter/${jobType}.${ext}`;
  const { error } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage
    .from("company-assets")
    .getPublicUrl(path);
  const existing = (await getSettings())?.instant_quoter_thumbnails || {};
  await updateSettings({ instant_quoter_thumbnails: { ...existing, [jobType]: publicUrl } });
  return publicUrl;
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
