import { useState, useEffect, useCallback } from "react";
import { getJob } from "../../lib/jobs.js";
import { buildWhatsAppChatUrl } from "../../lib/jobNotify.js";
import { SpecSheet } from "../SpecSheet.jsx";
import { ResourcesTab } from "./ResourcesTab.jsx";
import { DesignUploadTab } from "./DesignUploadTab.jsx";

const TABS = [
  { id: "spec", label: "Spec Sheet" },
  { id: "resources", label: "Resources" },
  { id: "upload", label: "Design Upload" },
];

export function JobDetail({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("spec");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getJob(jobId);
      setJob(data);
    } catch (err) {
      setError(err.message ?? "Could not load job.");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="h-8 w-8 rounded-full border-2 border-brand-cream/30 border-t-brand-red animate-spin"
          aria-label="Loading"
        />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">
        <button
          type="button"
          onClick={onBack}
          className="text-sm font-medium text-brand-cream/70 hover:text-brand-cream transition-colors"
        >
          ← Back to jobs
        </button>
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error || "Job not found."}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="text-sm font-medium text-brand-cream/70 hover:text-brand-cream transition-colors"
      >
        ← Back to jobs
      </button>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Header ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-brand-dark truncate">
              {job.job_title || "Untitled job"}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {job.client_name || "No client"} · Ref:{" "}
              <span className="font-mono">{job.quote_ref}</span>
            </p>
          </div>
          {job.client_phone && (
            <a
              href={buildWhatsAppChatUrl(job.client_phone)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#25D366] text-white text-sm font-medium px-4 py-2 hover:bg-[#1ebe5a] transition-colors"
            >
              WhatsApp client
            </a>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-white/10">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-brand-red text-brand-cream"
                  : "border-transparent text-brand-cream/50 hover:text-brand-cream/80",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "spec" && <SpecSheet job={job} />}
          {activeTab === "resources" && (
            <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
              <ResourcesTab jobId={job.id} />
            </div>
          )}
          {activeTab === "upload" && (
            <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
              <DesignUploadTab job={job} onStatusChange={setJob} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
