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

// Image for a "How it works" process step card on the landing page.
export async function uploadStepImage(index, file) {
  const ext = file.name.split(".").pop() || "jpg";
  // Timestamp in the name so a replaced image isn't served stale from cache
  const path = `landing/step-${index}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage
    .from("company-assets")
    .getPublicUrl(path);
  return publicUrl;
}

// Image for a "Why Choose Us" point on the landing page.
export async function uploadFeatureImage(index, file) {
  const ext = file.name.split(".").pop() || "jpg";
  const path = `landing/feature-${index}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage
    .from("company-assets")
    .getPublicUrl(path);
  return publicUrl;
}

// Background image for every sign-in / sign-up screen.
export async function uploadLoginBackground(file) {
  const ext = file.name.split(".").pop() || "jpg";
  // Timestamp in the name so a replaced image isn't served stale from cache
  const path = `login/background-${Date.now()}.${ext}`;
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

// `jobType` is a job type ("flyer") or an item key ("souvenir:Ceramic mug").
export async function uploadQuoterThumbnail(jobType, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
  // Storage paths: letters, digits and dashes only ("souvenir:Ceramic mug" → souvenir/ceramic-mug)
  const slug = String(jobType).split(":").map((part) =>
    part.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "item").join("/");
  const path = `quoter/${slug}.${ext}`;
  const { error } = await supabase.storage
    .from("company-assets")
    .upload(path, file, { upsert: true, cacheControl: "3600" });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage
    .from("company-assets")
    .getPublicUrl(path);
  // Version the URL so a replaced image shows straight away (not the cached one)
  const url = `${publicUrl}?v=${Date.now()}`;
  const existing = (await getSettings())?.instant_quoter_thumbnails || {};
  await updateSettings({ instant_quoter_thumbnails: { ...existing, [jobType]: url } });
  return url;
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

// Save the Digital Print Quoter rates. Admins update settings directly;
// production rate-editors go through update_digital_rates(), a database
// function that checks their permission and touches only digital_quote_rates.
export async function saveDigitalRates(rates, { asProduction = false } = {}) {
  if (!asProduction) return updateSettings({ digital_quote_rates: rates });
  const { error } = await supabase.rpc("update_digital_rates", { rates });
  if (error) throw error;
}
