// Statuses production staff can move a job through via the "Update status"
// dropdown. "sent" and "approved" are CS-driven and not selectable here.
export const PRODUCTION_STATUS_OPTIONS = [
  { value: "in_production", label: "In Production" },
  { value: "at_finishing", label: "At Finishing" },
  { value: "ready_for_pickup", label: "Ready for Pickup" },
  { value: "delivered", label: "Delivered" },
];

const JOB_STATUS_LABELS = {
  sent: "Awaiting payment",
  approved: "Approved",
  // No longer a selectable option, but kept so any job already at this
  // status (set before it was removed from the dropdown) still labels nicely.
  ready_for_design: "Ready for Design",
  design_ready: "Design Ready",
  ...Object.fromEntries(PRODUCTION_STATUS_OPTIONS.map((s) => [s.value, s.label])),
};

export function jobStatusLabel(status) {
  return JOB_STATUS_LABELS[status] ?? status;
}
