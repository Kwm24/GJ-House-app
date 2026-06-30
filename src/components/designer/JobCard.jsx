import { buildWhatsAppChatUrl } from "../../lib/jobNotify.js";

export function JobCard({ job, onClick }) {
  const qty = job.quote?.resultQtys?.[0];

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 hover:border-brand-red hover:shadow-md transition-all">
      <button type="button" onClick={onClick} className="w-full text-left">
        <h3 className="font-semibold text-brand-dark truncate">
          {job.job_title || "Untitled job"}
        </h3>
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

      {job.client_phone && (
        <a
          href={buildWhatsAppChatUrl(job.client_phone)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-3 flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] text-white text-xs font-medium py-2 hover:bg-[#1ebe5a] transition-colors"
        >
          WhatsApp client
        </a>
      )}
    </div>
  );
}
