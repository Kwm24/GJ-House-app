import { jobStatusLabel } from "../../lib/jobStatus.js";

const STATUS_BADGE = {
  approved: "bg-blue-100 text-blue-800",
  ready_for_design: "bg-purple-100 text-purple-800",
  design_ready: "bg-indigo-100 text-indigo-800",
  in_production: "bg-amber-100 text-amber-800",
  at_finishing: "bg-orange-100 text-orange-800",
  ready_for_pickup: "bg-teal-100 text-teal-800",
  delivered: "bg-green-100 text-green-800",
};

export function JobCard({ job, onClick }) {
  const qty = job.quote?.resultQtys?.[0];
  const badgeClass = STATUS_BADGE[job.status] ?? "bg-gray-100 text-gray-800";

  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-red hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-brand-dark truncate">
          {job.job_title || "Untitled job"}
        </h3>
        <span
          className={`shrink-0 rounded-full text-xs font-medium px-2.5 py-0.5 ${badgeClass}`}
        >
          {jobStatusLabel(job.status)}
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-600 truncate">
        {job.client_name || "No client"}
      </p>
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
        <span>{qty ? `${qty.toLocaleString()} copies` : "Quantity —"}</span>
        <span>
          {job.deadline
            ? `Finishing ${new Date(job.deadline).toLocaleDateString("en-GH", {
                day: "numeric",
                month: "short",
              })}`
            : "No finishing time set"}
        </span>
      </div>
    </button>
  );
}
