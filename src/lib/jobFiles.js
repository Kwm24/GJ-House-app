import { supabase } from "./supabase.js";

// Uploads a design file to Supabase Storage and returns its path.
export async function uploadDesignFile(jobId, file) {
  const ext = file.name.split(".").pop() || "bin";
  const path = `designs/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("job_files").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

// Uploads a file from a customer for their own job; stored in customer-uploads/{jobId}/...
export async function uploadCustomerFile(jobId, file) {
  const ext = file.name.split(".").pop() || "bin";
  const path = `customer-uploads/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("job_files").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

// Uploads a reference (resource) file to Supabase Storage and returns its path.
export async function uploadReferenceFile(jobId, file) {
  const ext = file.name.split(".").pop() || "bin";
  const path = `reference/${jobId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from("job_files").upload(path, file, {
    cacheControl: "3600",
    upsert: false,
  });
  if (error) throw error;
  return path;
}

export async function recordJobFile({ jobId, fileType, fileName, filePath, uploadedBy }) {
  const { data, error } = await supabase
    .from("job_files")
    .insert({
      job_id: jobId,
      file_type: fileType,
      file_name: fileName,
      file_path: filePath ?? null,
      uploaded_by: uploadedBy ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function listJobFiles(jobId, fileType) {
  const { data, error } = await supabase
    .from("job_files")
    .select("*")
    .eq("job_id", jobId)
    .eq("file_type", fileType)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

// All files uploaded by a specific user for a job — regardless of type.
// Used in the customer portal so customers see everything they've uploaded.
export async function listCustomerUploadedFiles(jobId, userId) {
  const { data, error } = await supabase
    .from("job_files")
    .select("*")
    .eq("job_id", jobId)
    .eq("uploaded_by", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data;
}

export async function getJobFileSignedUrl(path) {
  const { data, error } = await supabase.storage
    .from("job_files")
    .createSignedUrl(path, 60 * 5);
  if (error) throw error;
  return data.signedUrl;
}

// Every job a designer has uploaded artwork for, regardless of the job's
// current status.
export async function listDesignHistory(userId) {
  const { data, error } = await supabase
    .from("job_files")
    .select("id, job_id, created_at, jobs(job_title, quote_ref, client_name, status)")
    .eq("file_type", "design")
    .eq("uploaded_by", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const seen = new Set();
  const history = [];
  for (const row of data) {
    if (seen.has(row.job_id)) continue;
    seen.add(row.job_id);
    history.push(row);
  }
  return history;
}
