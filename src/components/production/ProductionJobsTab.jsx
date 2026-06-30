import { useState, useEffect, useCallback } from "react";
import { listProductionJobs } from "../../lib/jobs.js";
import { subscribeToTable } from "../../lib/realtime.js";
import { JobCard } from "./JobCard.jsx";
import { JobDetail } from "./JobDetail.jsx";

export function ProductionJobsTab() {
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedJobId, setSelectedJobId] = useState(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await listProductionJobs();
      setJobs(data);
    } catch (err) {
      setError(err.message ?? "Could not load jobs.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  // New approved jobs (and status changes) appear without a manual refresh.
  useEffect(() => {
    return subscribeToTable("jobs", () => loadJobs());
  }, [loadJobs]);

  function handleBack() {
    setSelectedJobId(null);
    loadJobs();
  }

  if (selectedJobId) {
    return <JobDetail jobId={selectedJobId} onBack={handleBack} />;
  }

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
        <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">
          Jobs in production
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Approved jobs ready to print, and jobs currently being worked on.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div
              className="h-8 w-8 rounded-full border-2 border-brand-red/30 border-t-brand-red animate-spin"
              aria-label="Loading"
            />
          </div>
        ) : !error && jobs.length === 0 ? (
          <p className="mt-8 text-center text-sm text-gray-500 py-8">
            No jobs in production right now.
          </p>
        ) : jobs.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {jobs.map((job) => (
              <JobCard key={job.id} job={job} onClick={() => setSelectedJobId(job.id)} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
