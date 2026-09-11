import { useEffect, useState, useCallback } from "react";
import { listSentJobs, assignCustomerToJob } from "../../lib/jobs.js";
import { listCustomers } from "../../lib/auth.js";
import { formatGHS } from "../../lib/currency.js";

export function SentTab() {
  const [jobs,      setJobs]      = useState([]);
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");

  // Track which job row has the assignment picker open
  const [assigningJobId, setAssigningJobId] = useState(null);
  const [assignSearch,   setAssignSearch]   = useState("");
  const [assignSaving,   setAssignSaving]   = useState(false);
  const [assignMsg,      setAssignMsg]      = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [jobData, custData] = await Promise.all([listSentJobs(), listCustomers()]);
      setJobs(jobData);
      setCustomers(custData);
    } catch (err) {
      setError(err.message ?? "Could not load sent quotes.");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openAssign(jobId) {
    setAssigningJobId(jobId);
    setAssignSearch("");
    setAssignMsg("");
  }
  function closeAssign() {
    setAssigningJobId(null);
    setAssignSearch("");
    setAssignMsg("");
  }

  async function handleAssign(job, customerUserId) {
    setAssignSaving(true); setAssignMsg("");
    try {
      await assignCustomerToJob(job.id, customerUserId || null);
      setJobs((prev) =>
        prev.map((j) => j.id === job.id ? { ...j, customer_id: customerUserId || null } : j)
      );
      setAssignMsg(customerUserId ? "✓ Customer linked" : "✓ Unlinked");
      setTimeout(closeAssign, 1200);
    } catch (err) {
      setAssignMsg("Error: " + (err.message ?? "Could not save"));
    } finally {
      setAssignSaving(false);
    }
  }

  const filteredCustomers = customers.filter((c) => {
    if (!assignSearch.trim()) return true;
    const q = assignSearch.toLowerCase();
    return (c.full_name ?? "").toLowerCase().includes(q)
        || (c.phone ?? "").toLowerCase().includes(q);
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="h-8 w-8 rounded-full border-2 border-brand-cream/30 border-t-brand-red animate-spin" aria-label="Loading" />
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
          Quotes shared via email or WhatsApp. Link a registered customer to give them portal access.
        </p>

        {error && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {!error && jobs.length === 0 && (
          <p className="mt-8 text-center text-sm text-gray-500 py-8">
            No sent quotes yet.
          </p>
        )}

        <ul className="mt-6 space-y-3">
          {jobs.map((job) => {
            const isAssigning = assigningJobId === job.id;
            const linkedCustomer = customers.find((c) => c.user_id === job.customer_id);

            return (
              <li key={job.id} className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                {/* Job row */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 p-4 sm:p-5">
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
                    {/* Customer link badge */}
                    {linkedCustomer ? (
                      <span className="inline-flex items-center gap-1 mt-1.5 text-xs font-medium text-green-700">
                        👤 {linkedCustomer.full_name}
                        <button
                          type="button"
                          onClick={() => openAssign(job.id)}
                          className="text-gray-400 hover:text-gray-600 ml-1"
                          title="Change customer"
                        >
                          ✏️
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => openAssign(job.id)}
                        className="mt-1.5 text-xs font-medium text-amber-700 hover:text-amber-900 hover:underline"
                      >
                        + Link customer portal
                      </button>
                    )}
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

                {/* Inline customer assignment panel */}
                {isAssigning && (
                  <div className="border-t border-amber-200 bg-amber-50 p-4">
                    <p className="text-xs font-semibold text-amber-800 mb-2">
                      Link a registered customer to this job
                    </p>
                    <input
                      type="text"
                      placeholder="Search by name or phone…"
                      value={assignSearch}
                      onChange={(e) => setAssignSearch(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 mb-2"
                      autoFocus
                    />

                    {filteredCustomers.length === 0 ? (
                      <p className="text-xs text-gray-500 italic py-1">
                        No registered customers found.
                        {!assignSearch && " Ask the customer to sign up at /signup first."}
                      </p>
                    ) : (
                      <ul className="rounded-lg border border-gray-200 bg-white overflow-hidden max-h-44 overflow-y-auto mb-2">
                        {filteredCustomers.map((c) => (
                          <li key={c.user_id}>
                            <button
                              type="button"
                              disabled={assignSaving}
                              onClick={() => handleAssign(job, c.user_id)}
                              className={[
                                "w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors",
                                job.customer_id === c.user_id
                                  ? "bg-green-50 text-green-800 font-medium"
                                  : "text-gray-800",
                              ].join(" ")}
                            >
                              {c.full_name}
                              {c.phone && <span className="text-gray-400 text-xs ml-2">{c.phone}</span>}
                              {job.customer_id === c.user_id && <span className="ml-2 text-green-600">✓ current</span>}
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="flex items-center gap-2 flex-wrap">
                      {job.customer_id && (
                        <button
                          type="button"
                          disabled={assignSaving}
                          onClick={() => handleAssign(job, null)}
                          className="text-xs text-red-600 hover:underline"
                        >
                          Remove link
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={closeAssign}
                        className="text-xs text-gray-500 hover:underline ml-auto"
                      >
                        Cancel
                      </button>
                    </div>

                    {assignMsg && (
                      <p className={["text-xs mt-2 font-medium", assignMsg.startsWith("Error") ? "text-red-600" : "text-green-700"].join(" ")}>
                        {assignMsg}
                      </p>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
