import { buildWhatsAppChatUrl } from "../../lib/jobNotify.js";
import { formatGHS } from "../../lib/currency.js";
import { ChevronRight, MessageCircle } from "lucide-react";

// Status accent colours — left border + badge
const STATUS_STYLE = {
  sent:             { border: "#3B82F6", badge: "bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"    },
  approved:         { border: "#10B981", badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20"               },
  ready_for_design: { border: "#A855F7", badge: "bg-purple-50 text-purple-700 dark:bg-purple-900/20"                  },
  design_ready:     { border: "#6366F1", badge: "bg-indigo-50 text-[#6366F1] dark:bg-indigo-900/20"                   },
  in_production:    { border: "#F59E0B", badge: "bg-amber-50 text-amber-700 dark:bg-amber-900/20"                     },
  at_finishing:     { border: "#F97316", badge: "bg-orange-50 text-orange-700 dark:bg-orange-900/20"                  },
  ready_for_pickup: { border: "#14B8A6", badge: "bg-teal-50 text-teal-700 dark:bg-teal-900/20"                        },
  delivered:        { border: "#22C55E", badge: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20"               },
  completed:        { border: "#0EA5E9", badge: "bg-sky-50 text-sky-700 dark:bg-sky-900/20"                           },
};

function statusLabel(status) {
  return (status ?? "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// assignmentSlot: optional JSX rendered below the card body (outside the
// clickable button area) — used by the admin view to show the designer
// assignment dropdown without nesting interactive elements inside a button.
export function JobCard({ job, designCost, onClick, assignmentSlot }) {
  const qty = job.quote?.resultQtys?.[0];
  const style = STATUS_STYLE[job.status] ?? { border: "#9C9C9C", badge: "bg-gray-100 text-gray-600 dark:bg-white/10 dark:text-gray-400" };

  const deadline = job.deadline
    ? new Date(job.deadline).toLocaleDateString("en-GH", { day: "numeric", month: "short" })
    : null;

  return (
    <div
      className="group relative bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] overflow-hidden transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover"
      style={{ borderLeft: `4px solid ${style.border}` }}
    >
      <button type="button" onClick={onClick} className="w-full text-left p-4">
        {/* Top row: status badge + title + arrow */}
        <div className="flex items-start gap-2">
          <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}>
            {statusLabel(job.status)}
          </span>
          <span className="flex-1 font-semibold text-sm text-[var(--t-text1)] truncate leading-5">
            {job.job_title || "Untitled job"}
          </span>
          <ChevronRight
            size={14}
            className="shrink-0 text-[var(--t-muted)] opacity-0 group-hover:opacity-100 transition-opacity duration-150 mt-0.5"
          />
        </div>

        {/* Bottom row: metadata */}
        <div className="mt-2 flex items-center gap-3 text-xs text-[var(--t-muted)]">
          <span className="truncate">{job.client_name || "No client"}</span>
          {qty && <span className="shrink-0">{qty.toLocaleString()} copies</span>}
          {deadline && <span className="shrink-0 ml-auto">{deadline}</span>}
        </div>

        {/* Design fee pill */}
        {designCost !== null && (
          <div className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-purple-50 dark:bg-purple-900/20 border border-purple-100 dark:border-purple-700/20 px-2.5 py-1 text-xs">
            <span className="font-semibold text-purple-700 dark:text-purple-300">Design fee</span>
            <span className="font-bold text-purple-800 dark:text-purple-200">{formatGHS(designCost)}</span>
          </div>
        )}
      </button>

      {/* Assignment slot — outside the button */}
      {assignmentSlot && (
        <div className="px-4 pb-3 pt-0 border-t border-[var(--t-border)]">
          {assignmentSlot}
        </div>
      )}

      {/* WhatsApp link */}
      {job.client_phone && (
        <div className="px-4 pb-3">
          <a
            href={buildWhatsAppChatUrl(job.client_phone)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-[#25D366] text-white text-xs font-medium py-1.5 hover:bg-[#1ebe5a] transition-colors"
          >
            <MessageCircle size={12} />
            WhatsApp client
          </a>
        </div>
      )}
    </div>
  );
}
