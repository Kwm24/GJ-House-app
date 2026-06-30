function sanitizePhone(phone) {
  return (phone || "").replace(/[^\d]/g, "");
}

// Plain chat — no pre-filled message. Falls back to a blank wa.me (lets the
// user pick a contact) if no phone is on file for the job.
export function buildWhatsAppChatUrl(phone) {
  const digits = sanitizePhone(phone);
  return digits ? `https://wa.me/${digits}` : "https://wa.me/";
}

export function buildDesignReadyMessage(job) {
  return [
    `Hi${job.client_name ? " " + job.client_name : ""},`,
    `Your design for "${job.job_title || "your job"}" (Ref: ${job.quote_ref}) is ready for review.`,
    "Please take a look and let us know if you'd like any changes.",
  ].join("\n");
}

export function buildDesignReadyWhatsAppUrl(job) {
  const digits = sanitizePhone(job.client_phone);
  const text = encodeURIComponent(buildDesignReadyMessage(job));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function buildDesignReadyMailtoUrl(job) {
  const subject = encodeURIComponent(
    `Design ready for review — ${job.job_title || job.quote_ref}`
  );
  const body = encodeURIComponent(buildDesignReadyMessage(job));
  return `mailto:?subject=${subject}&body=${body}`;
}
