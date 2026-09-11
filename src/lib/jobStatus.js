// All possible job statuses in pipeline order.
export const ALL_STATUSES = [
  { value: "sent",             label: "Quote Sent"       },
  { value: "approved",         label: "Deposit Paid"     },
  { value: "in_production",    label: "In Production"    },
  { value: "ready_for_design", label: "Ready for Design" },
  { value: "design_ready",     label: "Design Ready"     },
  { value: "at_finishing",     label: "At Finishing"     },
  { value: "ready_for_pickup", label: "Ready for Pickup" },
  { value: "delivered",        label: "Collected"        },
  { value: "completed",        label: "Job Completed"    },
];

// Statuses CS staff can set (full pipeline control).
export const CS_STATUS_OPTIONS = ALL_STATUSES;

// Statuses production staff can set (excludes early CS-only stages).
export const PRODUCTION_STATUS_OPTIONS = [
  { value: "in_production",    label: "In Production"    },
  { value: "at_finishing",     label: "At Finishing"     },
  { value: "ready_for_pickup", label: "Ready for Pickup" },
  { value: "delivered",        label: "Collected"        },
  { value: "completed",        label: "Job Completed"    },
];

const JOB_STATUS_LABELS = Object.fromEntries(
  ALL_STATUSES.map((s) => [s.value, s.label])
);

export function jobStatusLabel(status) {
  return JOB_STATUS_LABELS[status] ?? status;
}
