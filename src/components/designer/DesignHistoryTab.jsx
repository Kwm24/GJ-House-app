import { useState, useEffect, useCallback } from "react";
import { useAuth } from "../AuthProvider.jsx";
import { listDesignHistory } from "../../lib/jobFiles.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";

export function DesignHistoryTab() {
  const { user } = useAuth();
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      setHistory(await listDesignHistory(user.id));
    } catch (err) {
      setError(err.message ?? "Could not load design history.");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      {error && (
        <div
          role="alert"
          className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">
              Design history
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              Every job you've designed, even after it moves on to production.
            </p>
          </div>
          <div className="rounded-lg bg-brand-dark text-brand-cream px-4 py-2 text-center">
            <div className="text-xl font-bold">{history.length}</div>
            <div className="text-[11px] uppercase tracking-wide text-brand-cream/60">
              designs completed
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin"
              aria-label="Loading"
            />
          </div>
        ) : !error && history.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500 py-8">
            No designs uploaded yet.
          </p>
        ) : history.length > 0 ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300">
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Status now</th>
                  <th className="py-2 pr-4">Last upload</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.job_id} className="border-b border-gray-200">
                    <td className="py-2.5 pr-4 text-brand-dark">
                      <div className="font-medium">{row.jobs?.job_title || "Untitled job"}</div>
                      <div className="text-xs text-gray-500 font-mono">{row.jobs?.quote_ref}</div>
                    </td>
                    <td className="py-2.5 pr-4 text-gray-600">{row.jobs?.client_name || "—"}</td>
                    <td className="py-2.5 pr-4">
                      <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                        {jobStatusLabel(row.jobs?.status)}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-gray-600">
                      {new Date(row.created_at).toLocaleDateString("en-GH", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}
