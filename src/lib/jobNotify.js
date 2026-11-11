function sanitizePhone(phone) {
  return (phone || "").replace(/[^\d]/g, "");
}

// Plain chat — no pre-filled message. Falls back to a blank wa.me (lets the
// user pick a contact) if no phone is on file for the job.
export function buildWhatsAppChatUrl(phone) {
  const digits = waDigits(phone);
  return digits ? `https://wa.me/${digits}` : "https://wa.me/";
}

// Ghana numbers typed locally ("024 123 4567") need the country code for wa.me
export function waDigits(phone) {
  let d = sanitizePhone(phone);
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 && d.startsWith("0")) d = "233" + d.slice(1);
  return d;
}

// `contact` (from getJobCustomerContact) is the customer's own details; the
// job's typed client name / phone are only the fallback.
export function buildDesignReadyMessage(job, contact = null) {
  const name = contact?.name || job.client_name;
  return [
    `Hi${name ? " " + name : ""},`,
    `Your design for "${job.job_title || "your job"}" (Ref: ${job.quote_ref}) is ready for review.`,
    "Please sign in to your customer portal to review and approve it, or let us know if you'd like any changes.",
    typeof window !== "undefined" ? `${window.location.origin}/login` : "",
  ].filter(Boolean).join("\n");
}

export function buildDesignReadyWhatsAppUrl(job, contact = null) {
  const digits = waDigits(contact ? contact.whatsapp : job.client_phone);
  const text = encodeURIComponent(buildDesignReadyMessage(job, contact));
  return digits ? `https://wa.me/${digits}?text=${text}` : `https://wa.me/?text=${text}`;
}

export function buildDesignReadyMailtoUrl(job, contact = null) {
  const subject = encodeURIComponent(
    `Design ready for review — ${job.job_title || job.quote_ref}`
  );
  const body = encodeURIComponent(buildDesignReadyMessage(job, contact));
  const to = contact?.email ? encodeURIComponent(contact.email) : "";
  return `mailto:${to}?subject=${subject}&body=${body}`;
}
