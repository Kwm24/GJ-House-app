import { useState, useRef } from "react";
import { useAuth } from "../AuthProvider.jsx";
import { uploadDesignFile, recordJobFile } from "../../lib/jobFiles.js";
import { updateJobStatus } from "../../lib/jobs.js";
import {
  buildDesignReadyMailtoUrl,
  buildDesignReadyWhatsAppUrl,
} from "../../lib/jobNotify.js";
import { JobFilesList } from "../JobFilesList.jsx";

export function DesignUploadTab({ job, onStatusChange }) {
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  const [error, setError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [justUploaded, setJustUploaded] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  async function handleUpload(file) {
    if (!file) return;
    setError("");
    setUploading(true);
    try {
      const path = await uploadDesignFile(job.id, file);
      await recordJobFile({
        jobId: job.id,
        fileType: "design",
        fileName: file.name,
        filePath: path,
        uploadedBy: user?.id,
      });
      const updated = await updateJobStatus(job.id, "design_ready");
      onStatusChange?.(updated);
      setJustUploaded(true);
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err.message ?? "Could not upload design file.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div>
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <label className="flex flex-col items-center justify-center gap-2 cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-8 text-center hover:border-brand-red transition-colors">
        <span className="text-2xl">🎨</span>
        <span className="text-sm font-medium text-gray-700">
          {uploading ? "Uploading…" : "Upload design (image or PDF)"}
        </span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={(e) => handleUpload(e.target.files?.[0])}
        />
      </label>

      {justUploaded && (
        <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4 sm:p-5">
          <p className="text-sm font-medium text-green-900">
            Design uploaded — job marked "Design Ready". Let the client know:
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <a
              href={buildDesignReadyMailtoUrl(job)}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              ✉ Notify via Email
            </a>
            <a
              href={buildDesignReadyWhatsAppUrl(job)}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-[#25D366] text-white px-4 py-2 text-sm font-medium hover:bg-[#1ebe5a] transition-colors"
            >
              Notify via WhatsApp
            </a>
          </div>
        </div>
      )}

      <div className="mt-6">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">
          Uploaded designs
        </h4>
        <JobFilesList
          key={refreshKey}
          jobId={job.id}
          fileType="design"
          emptyMessage="No designs uploaded yet."
        />
      </div>
    </div>
  );
}
