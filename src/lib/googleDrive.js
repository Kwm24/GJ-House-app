import { supabase } from "./supabase.js";

// Uploads a file to Google Drive via the server-side Edge Function.
// `folder` is either "root" (internal files: receipts, designs) or
// "resources" (the shared client-accessible folder for reference material).
// Returns { driveFileId, webViewLink }.
export async function driveUpload(file, folder = "root", { fileName } = {}) {
  const form = new FormData();
  form.append("file", file);
  form.append("folder", folder);
  if (fileName) form.append("fileName", fileName);

  const { data, error } = await supabase.functions.invoke("google-drive-upload", {
    body: form,
  });

  // The function always returns HTTP 200; error here means it's unreachable.
  if (error) throw new Error("Could not reach the Google Drive upload service. Is the Edge Function deployed?");
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function driveDelete(driveFileId) {
  const { data, error } = await supabase.functions.invoke("google-drive-delete", {
    body: { driveFileId },
  });

  if (error) throw new Error("Could not reach the Google Drive delete service.");
  if (data?.error) throw new Error(data.error);
}
