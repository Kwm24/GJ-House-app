import { useState, useEffect, useCallback } from "react";
import { listJobFiles, getJobFileSignedUrl } from "../lib/jobFiles.js";

export function JobFilesList({ jobId, fileType, emptyMessage }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listJobFiles(jobId, fileType);
      setFiles(data);
    } catch (err) {
      setError(err.message ?? "Could not load files.");
    } finally {
      setLoading(false);
    }
  }, [jobId, fileType]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleView(path) {
    try {
      const url = await getJobFileSignedUrl(path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      alert(err.message ?? "Could not load file.");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div
          className="h-6 w-6 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        {error}
      </div>
    );
  }

  if (files.length === 0) {
    return <p className="text-sm text-gray-500 py-4 text-center">{emptyMessage}</p>;
  }

  return (
    <ul className="space-y-2">
      {files.map((file) => (
        <li
          key={file.id}
          className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3"
        >
          <span className="text-sm text-gray-800 truncate">{file.file_name}</span>
          <button
            type="button"
            onClick={() => handleView(file.file_path)}
            className="shrink-0 text-brand-red hover:underline text-xs font-medium"
          >
            View
          </button>
        </li>
      ))}
    </ul>
  );
}
