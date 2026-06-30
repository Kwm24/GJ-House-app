import { formatGHS as GHS } from "./currency.js";

export function buildQuoteSummary(snapshot) {
  const primaryQty = snapshot.resultQtys?.[0];
  const result = snapshot.results?.[primaryQty];
  const grandTotal = result?.grandTotal ?? 0;
  const deposit = Math.round(grandTotal * 0.6 * 100) / 100;

  const lines = [
    `Quote Ref: ${snapshot.ref}`,
    `Job: ${snapshot.jobTitle || "—"}`,
    `Client: ${snapshot.clientName || "—"}`,
    `Date: ${snapshot.date}`,
    "",
    `Quantity: ${primaryQty?.toLocaleString() ?? "—"} copies`,
    `Grand Total: ${GHS(grandTotal)}`,
    `Deposit (60%): ${GHS(deposit)}`,
    `Unit Price: ${GHS(result?.unitPrice)}`,
  ];

  return lines.join("\n");
}

export function buildMailtoUrl(snapshot, companyEmail = "") {
  const subject = encodeURIComponent(
    `Print Quote ${snapshot.ref} — ${snapshot.jobTitle || "Quotation"}`
  );
  const body = encodeURIComponent(buildQuoteSummary(snapshot));
  const to = companyEmail ? encodeURIComponent(companyEmail) : "";
  return `mailto:${to}?subject=${subject}&body=${body}`;
}

export function buildWhatsAppUrl(snapshot) {
  const text = encodeURIComponent(buildQuoteSummary(snapshot));
  return `https://wa.me/?text=${text}`;
}
