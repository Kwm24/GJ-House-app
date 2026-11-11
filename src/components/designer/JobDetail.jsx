import { useState, useEffect, useCallback } from "react";
import { getJob, updateJobDesignDue } from "../../lib/jobs.js";
import { getInvoiceByRef } from "../../lib/invoices.js";
import { buildWhatsAppChatUrl } from "../../lib/jobNotify.js";
import { getJobCustomerContact } from "../../lib/customerProfile.js";
import { SpecSheet } from "../SpecSheet.jsx";
import { ResourcesTab } from "./ResourcesTab.jsx";
import { DesignUploadTab } from "./DesignUploadTab.jsx";

const TABS = [
  { id: "spec",      label: "Spec Sheet"    },
  { id: "resources", label: "Resources"     },
  { id: "upload",    label: "Design Upload" },
  { id: "notes",     label: "Notes"         },
];

export function JobDetail({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("spec");
  // Customer's own WhatsApp number (profile) before the invoice's typed phone
  const [contact, setContact] = useState(null);
  useEffect(() => {
    if (!job) return;
    let cancelled = false;
    getJobCustomerContact(job).then((c) => { if (!cancelled) setContact(c); });
    return () => { cancelled = true; };
  }, [job]);
  const waNumber = contact?.whatsapp || job?.client_phone;

  // "Design ready by": the customer sees it in their portal
  const [dueSaving, setDueSaving] = useState(false);
  async function handleDesignDueChange(e) {
    setDueSaving(true);
    setError("");
    try {
      const updated = await updateJobDesignDue(job.id, e.target.value);
      setJob((j) => ({ ...j, ...updated }));
    } catch (err) {
      setError(err.message ?? "Could not save the design date.");
    } finally {
      setDueSaving(false);
    }
  }
  // Invoice lines let the spec sheet show every print quote on a multi-quote invoice
  const [invoiceLineItems, setInvoiceLineItems] = useState([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getJob(jobId);
      setJob(data);
      if (data?.quote_ref) {
        getInvoiceByRef(data.quote_ref)
          .then((inv) => setInvoiceLineItems(inv?.line_items ?? []))
          .catch(() => {}); // non-fatal — spec sheet still renders without it
      }
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
          className="h-8 w-8 rounded-full border-2 border-[var(--t-border)] border-t-brand-red animate-spin"
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
          className="text-sm font-medium text-[var(--t-muted)] hover:text-[var(--t-text1)] transition-colors"
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
        className="text-sm font-medium text-[var(--t-muted)] hover:text-[var(--t-text1)] transition-colors"
      >
        ← Back to jobs
      </button>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Header ── */}
      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg sm:text-xl font-semibold text-[var(--t-text1)] truncate">
              {job.job_title || "Untitled job"}
            </h2>
            <p className="mt-1 text-sm text-[var(--t-text2)]">
              {job.client_name || "No client"} · Ref:{" "}
              <span className="font-mono">{job.quote_ref}</span>
            </p>
          </div>
          {waNumber && (
            <a
              href={buildWhatsAppChatUrl(waNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 flex items-center gap-1.5 rounded-lg bg-[#25D366] text-white text-sm font-medium px-4 py-2 hover:bg-[#1ebe5a] transition-colors"
            >
              WhatsApp client
            </a>
          )}
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="design-due" className="block text-xs font-medium text-[var(--t-muted)] mb-1.5">
              Design finishing time (ready for the customer by)
            </label>
            <input
              id="design-due"
              type="date"
              value={job.design_due ?? ""}
              onChange={handleDesignDueChange}
              disabled={dueSaving}
              className="w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 text-sm text-[var(--t-text1)] focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red disabled:opacity-60"
            />
            <p className="mt-1 text-[11px] text-[var(--t-muted)]">The customer sees this date and is notified when you set or change it.</p>
          </div>
          {job.deadline && (
            <div>
              <p className="block text-xs font-medium text-[var(--t-muted)] mb-1.5">Job finishing time (production)</p>
              <p className="py-2.5 text-sm text-[var(--t-text1)]">
                {new Date(`${job.deadline}T00:00:00`).toLocaleDateString("en-GH", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div>
        <div className="flex gap-1 overflow-x-auto scrollbar-none border-b border-[var(--t-border)]">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-brand-red text-[var(--t-text1)]"
                  : "border-transparent text-[var(--t-muted)] hover:text-[var(--t-text2)]",
              ].join(" ")}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-4">
          {activeTab === "spec" && <SpecSheet job={job} invoiceLineItems={invoiceLineItems} variant="designer" />}
          {activeTab === "resources" && (
            <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
              <ResourcesTab jobId={job.id} />
            </div>
          )}
          {activeTab === "upload" && (
            <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
              <DesignUploadTab job={job} onStatusChange={setJob} />
            </div>
          )}
          {activeTab === "notes" && (
            <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
              <p className="text-[10px] font-bold uppercase tracking-widest text-brand-red mb-3">
                Internal Notes
              </p>
              {job.notes ? (
                <p className="text-sm text-[var(--t-text1)] whitespace-pre-wrap leading-relaxed">
                  {job.notes}
                </p>
              ) : (
                <p className="text-sm text-[var(--t-muted)] italic">No notes added for this job.</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
