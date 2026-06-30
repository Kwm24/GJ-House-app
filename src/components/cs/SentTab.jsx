import { useEffect, useState } from "react";
import { listSentJobs } from "../../lib/jobs.js";
import { formatGHS } from "../../lib/currency.js";

export function SentTab() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError("");
      try {
        const data = await listSentJobs();
        if (mounted) setJobs(data);
      } catch (err) {
        if (mounted) {
          setError(err.message ?? "Could not load sent quotes.");
          setJobs([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">
          Sent quotes
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Quotes shared via email or WhatsApp.
        </p>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        {!error && jobs.length === 0 && (
          <p className="mt-8 text-center text-sm text-gray-500 py-8">
            No sent quotes yet. Approve a quote and send it via email or WhatsApp
            from the Quotes tab.
          </p>
        )}

        <ul className="mt-6 space-y-3">
          {jobs.map((job) => (
            <li
              key={job.id}
              className="rounded-lg border border-gray-200 bg-white p-4 sm:p-5"
            >
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold text-brand-dark truncate">
                    {job.job_title || "Untitled job"}
                  </p>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Ref: <span className="font-mono">{job.quote_ref}</span>
                    {job.client_name && ` · ${job.client_name}`}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Sent{" "}
                    {job.sent_at
                      ? new Date(job.sent_at).toLocaleString("en-GH")
                      : "—"}
                    {job.sent_via && (
                      <span className="capitalize"> via {job.sent_via}</span>
                    )}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-brand-red">
                    Deposit {formatGHS(job.deposit_amount)}
                  </p>
                  <span
                    className={[
                      "mt-1 inline-block rounded-full text-xs font-medium px-2.5 py-0.5 capitalize",
                      job.status === "approved"
                        ? "bg-green-100 text-green-800"
                        : "bg-yellow-100 text-yellow-800",
                    ].join(" ")}
                  >
                    {job.status === "approved" ? "Paid" : "Awaiting payment"}
                  </span>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
