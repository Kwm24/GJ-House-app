import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../AuthProvider.jsx";
import { uploadReferenceFile, recordJobFile, listJobFiles, getJobFileSignedUrl } from "../../lib/jobFiles.js";
import { listJobsForPicker } from "../../lib/jobs.js";

export function ResourcesTab() {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [jobOptions, setJobOptions] = useState([]);
  const [jobId, setJobId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [recentFiles, setRecentFiles] = useState([]);
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");

  useEffect(() => {
    listJobsForPicker()
      .then(setJobOptions)
      .catch(() => setJobOptions([]));
  }, []);

  const loadRecentFiles = useCallback(async () => {
    if (!jobId) { setRecentFiles([]); return; }
    setListLoading(true);
    setListError("");
    try {
      setRecentFiles(await listJobFiles(jobId, "reference"));
    } catch (err) {
      setListError(err.message ?? "Could not load resources.");
    } finally {
      setListLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadRecentFiles();
  }, [loadRecentFiles]);

  async function handleUpload(file) {
    if (!file || !user) return;
    if (!jobId) {
      setError("Select a job before uploading a resource.");
      return;
    }

    setError("");
    setSuccess("");
    setUploading(true);

    try {
      const filePath = await uploadReferenceFile(jobId, file);
      await recordJobFile({
        jobId,
        fileType: "reference",
        fileName: file.name,
        filePath,
        uploadedBy: user.id,
      });
      setSuccess(`"${file.name}" uploaded successfully.`);
      loadRecentFiles();
    } catch (err) {
      setError(err.message ?? "Could not upload resource.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Upload resource</h2>
        <p className="mt-1 text-sm text-gray-600">
          Files uploaded here are attached to the job and visible to the Designer
          in their Resources tab.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}
        {success && (
          <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {success}
          </div>
        )}

        <div className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Job</label>
            <select
              value={jobId}
              onChange={(e) => { setJobId(e.target.value); setError(""); setSuccess(""); }}
              className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red"
            >
              <option value="">— Select a job —</option>
              {jobOptions.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.quote_ref} — {j.job_title || j.client_name || "Untitled"}
                </option>
              ))}
            </select>
          </div>

          <label className={[
            "flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed px-4 py-8 text-center transition-colors",
            jobId ? "border-gray-300 bg-white hover:border-brand-red" : "border-gray-200 bg-gray-50 cursor-not-allowed",
          ].join(" ")}>
            <span className="text-2xl">📁</span>
            <span className="text-sm font-medium text-gray-700">
              {uploading ? "Uploading to Drive…" : "Click to pick a file"}
            </span>
            <span className="text-xs text-gray-500">Images, PDFs, Word docs — any client-facing material</span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
              className="hidden"
              disabled={uploading || !jobId}
              onChange={(e) => handleUpload(e.target.files?.[0])}
            />
          </label>
        </div>
      </div>

      {jobId && (
        <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
          <h3 className="text-sm font-semibold text-brand-dark">Resources for this job</h3>

          {listLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin" aria-label="Loading" />
            </div>
          ) : listError ? (
            <p className="mt-4 text-sm text-red-700">{listError}</p>
          ) : recentFiles.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No resources uploaded for this job yet.</p>
          ) : (
            <ul className="mt-4 space-y-2">
              {recentFiles.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3">
                  <span className="text-sm text-gray-800 truncate">{f.file_name}</span>
                  {f.file_path && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const url = await getJobFileSignedUrl(f.file_path);
                          window.open(url, "_blank", "noopener,noreferrer");
                        } catch {
                          alert("Could not load file.");
                        }
                      }}
                      className="shrink-0 text-brand-red hover:underline text-xs font-medium"
                    >
                      View
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
