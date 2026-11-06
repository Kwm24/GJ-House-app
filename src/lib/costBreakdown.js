/**
 * costBreakdown.js
 * Money summary for a paid job, read from the quote snapshot(s) it was priced
 * on (offset, digital, or an invoice holding several quotes) plus the CS
 * invoice and payments. The Accounts popup renders each quote's own snapshot
 * with the quoters' result components, so it looks exactly like the quoter.
 */
import { jobGrandTotal, jobTotalPaid } from "./jobs.js";
import { DEFAULT_DIGITAL_RATES } from "./digitalPrintSpecs.js";

const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

function quoteEntry(snap, typeHint, ref, name) {
  if (!snap) return null;
  const type = snap.quoteType === "digital" || typeHint === "digital" ? "digital" : "offset";
  if (type === "digital") {
    const r = snap.result;
    if (!r) return null;
    const cost = round2(r.totalCost), total = round2(r.sellPrice);
    return { type, ref, name, snapshot: snap, qty: Number(r.qty ?? snap.job?.qty) || null, cost, profit: round2(total - cost), total };
  }
  // Offset: the invoiced quantity is first in resultQtys (see snapshotForLine)
  const qty = Number(snap.resultQtys?.[0]);
  const r   = snap.results?.[qty];
  if (!r) return null;
  return { type, ref, name, snapshot: snap, qty, cost: round2(r.subtotal), profit: round2(r.margin), total: round2(r.grandTotal) };
}

export function jobQuotes(job) {
  const snap = job?.quote;
  if (!snap) return [];
  if (snap.quoteType === "multi") {
    return (snap.quotes ?? [])
      .map((q) => quoteEntry(q.snapshot, q.quoteType, q.quoteRef, q.name || q.snapshot?.jobTitle || q.quoteRef))
      .filter(Boolean);
  }
  const e = quoteEntry(snap, null, snap.ref, snap.jobTitle || job.job_title || snap.ref);
  return e ? [e] : [];
}

/**
 * `invoice` — the CS invoice the job was paid from (matched on ref), if any.
 * Its total also covers catalogue items, design fees and discounts, which
 * have no cost data. `expenses` — spending recorded against the job.
 */
export function jobCostSummary(job, invoice, expenses = 0) {
  const quotes = jobQuotes(job);
  const has    = quotes.length > 0;

  const quotesTotal  = round2(quotes.reduce((s, q) => s + q.total, 0));
  const invoiceTotal = invoice ? round2(invoice.total) : round2(jobGrandTotal(job));
  const paid         = jobTotalPaid(job);

  const otherLines = (invoice?.line_items ?? [])
    .filter((li) => !li.quoteRef)
    .map((li) => ({ label: `${li.name}${li.qty ? ` × ${li.qty}` : ""}`, amount: round2(li.total ?? li.qty * li.unitPrice) }));

  let kind = "items";
  if (job?.quote?.quoteType === "multi") kind = "mixed";
  else if (has) kind = quotes[0].type;

  return {
    kind,
    quotes,
    cost:        has ? round2(quotes.reduce((s, q) => s + q.cost, 0))   : null,
    profit:      has ? round2(quotes.reduce((s, q) => s + q.profit, 0)) : null,
    invoiceTotal,
    other:       round2(invoiceTotal - quotesTotal),
    otherLines,
    discount:    invoice ? round2(invoice.discount_amt) : 0,
    paid,
    outstanding: round2(invoiceTotal - paid),
    expenses:    round2(expenses),
  };
}

// The rates a digital quote was priced with (saved on the snapshot), on top
// of the defaults for any setting added since it was saved.
export function digitalSnapshotRates(snap) {
  const saved = snap?.rates || {};
  const out = { ...DEFAULT_DIGITAL_RATES };
  for (const k of Object.keys(saved)) {
    const v = saved[k];
    out[k] = v && typeof v === "object" && !Array.isArray(v) ? { ...(DEFAULT_DIGITAL_RATES[k] || {}), ...v } : v;
  }
  return out;
}
