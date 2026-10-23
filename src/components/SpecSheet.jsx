import { PARENT_SHEETS, BOOK_SIZES, LAM_TYPES, BINDING_TYPES } from "../lib/printSpecs.js";

function SpecTile({ icon, label, value, sub }) {
  return (
    <div className="rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] p-4 flex flex-col items-center text-center gap-1">
      <div className="text-3xl leading-none">{icon}</div>
      <div className="text-base font-bold text-[var(--t-text1)] leading-tight">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--t-muted)]">
        {label}
      </div>
      {sub && <div className="text-xs text-[var(--t-muted)]">{sub}</div>}
    </div>
  );
}

const DIGITAL_JOB_LABELS = {
  flyer:    'Flyer / Leaflet / Poster',
  card:     'Business Card',
  brochure: 'Brochure (bi-fold)',
  trifold:  'Trifold Brochure',
  book:     'Booklet / Book',
  banner:   'Banner',
  sticker:  'Sticker / Label',
  custom:   'Custom Digital Print',
};

// Shown for jobs created from the Digital Print Quoter.
function DigitalPrintItemCard({ job, variant }) {
  const quote  = job.quote ?? {};
  const qJob   = quote.job   ?? {};
  const result = quote.result ?? {};

  const jobTypeLabel = DIGITAL_JOB_LABELS[qJob.jobType] || qJob.jobType || 'Digital Print';

  // Use stored description first; build fallback from raw fields
  const description = result.description || (() => {
    const parts = [];
    if (result.isLF) {
      if (qJob.lfMat) parts.push(qJob.lfMat);
    } else {
      if (qJob.stock)    parts.push(qJob.stock);
      parts.push(qJob.duplex ? 'Double-sided' : 'Single-sided');
      if (qJob.pages)    parts.push(`${qJob.pages} pages`);
      if (qJob.bindType) parts.push(qJob.bindType);
    }
    return parts.join(' · ') || '—';
  })();

  const sizeLabel = result.isLF
    ? `${qJob.lfWidth}×${qJob.lfHeight} ${qJob.lfUnit}`
    : qJob.sizeKey === 'Custom'
      ? `${qJob.customW}×${qJob.customH} mm`
      : qJob.sizeKey || '—';

  // Designer view: 4 tiles (finished size, pages, colours, binding)
  if (variant === "designer") {
    return (
      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red mb-4">
          Print Item Specifications
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SpecTile icon="📐" label="Finished size"  value={sizeLabel} />
          <SpecTile icon="📖" label="Pages"          value={qJob.pages ? String(qJob.pages) : "N/A"} />
          <SpecTile icon="🎨" label="Colours"        value="Full colour" />
          <SpecTile icon="📚" label="Binding"        value={qJob.bindType || "None"} />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red mb-4">
        Print Item Specifications
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--t-muted)] border-b border-[var(--t-border)]">
              <th className="py-2 pr-4 font-semibold">Item</th>
              <th className="py-2 pr-4 font-semibold">Description</th>
              <th className="py-2 pr-4 font-semibold">Size / Format</th>
              <th className="py-2 pr-4 text-right font-semibold">Qty</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2.5 pr-4 font-medium text-[var(--t-text1)]">{job.job_title || jobTypeLabel}</td>
              <td className="py-2.5 pr-4 text-[var(--t-text2)] max-w-[220px]">{description}</td>
              <td className="py-2.5 pr-4 text-[var(--t-text2)]">{sizeLabel}</td>
              <td className="py-2.5 pr-4 text-right font-semibold text-[var(--t-text1)]">
                {Number(result.qty || 0).toLocaleString()}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Shown for general-invoice jobs (no quote type) that have print items on the invoice.
function PrintItemsCard({ lineItems, variant }) {
  const printLines = (lineItems ?? []).filter((li) => li.printSpecs);
  if (printLines.length === 0) return null;

  // Designer view: one SpecTile block per print item showing size + material
  if (variant === "designer") {
    return (
      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red mb-4">
          Print Item Specifications
        </h3>
        {printLines.map((li, i) => (
          <div key={i} className={i > 0 ? "mt-4 pt-4 border-t border-[var(--t-border)]" : ""}>
            <p className="text-xs font-semibold text-[var(--t-text2)] mb-2">{li.name}</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <SpecTile icon="📐" label="Finished size" value={li.printSpecs.size || "—"} />
              <SpecTile icon="📖" label="Pages"         value="—" />
              <SpecTile icon="🎨" label="Colours"       value="—" />
              <SpecTile icon="📚" label="Material"      value={li.printSpecs.material || li.printSpecs.description || "—"} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red mb-4">
        Print Item Specifications
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-[var(--t-muted)] border-b border-[var(--t-border)]">
              <th className="py-2 pr-4 font-semibold">Item</th>
              <th className="py-2 pr-4 font-semibold">Description</th>
              <th className="py-2 pr-4 font-semibold">Size / Format</th>
              <th className="py-2 pr-4 text-right font-semibold">Qty</th>
            </tr>
          </thead>
          <tbody>
            {printLines.map((li, i) => (
              <tr key={i} className="border-b border-[var(--t-border)] last:border-0">
                <td className="py-2.5 pr-4 font-medium text-[var(--t-text1)]">{li.name}</td>
                <td className="py-2.5 pr-4 text-[var(--t-text2)]">{li.printSpecs.material || li.printSpecs.description || "—"}</td>
                <td className="py-2.5 pr-4 text-[var(--t-text2)]">{li.printSpecs.size || "—"}</td>
                <td className="py-2.5 pr-4 text-right font-semibold text-[var(--t-text1)]">
                  {Number(li.qty).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// Read-only print-specification — physical specs for production/design staff.
//
// Rules:
//   Digital print job (quote.quoteType === 'digital')
//     → show DigitalPrintItemCard ONLY (no offset spec tiles)
//   Offset print job (quote.resultQtys exists)
//     → show offset spec tiles ONLY (no PrintItemsCard)
//   General invoice job (no recognised quote type)
//     → show PrintItemsCard (from invoice line items) + "no spec" notice
//
// variant="designer" — hides press-room tiles irrelevant to design staff.
export function SpecSheet({ job, invoiceLineItems, variant }) {
  const quote = job.quote ?? {};

  // ── Digital print job ──────────────────────────────────────────────────────
  if (quote.quoteType === 'digital') {
    return <DigitalPrintItemCard job={job} variant={variant} />;
  }

  // ── Offset print job ───────────────────────────────────────────────────────
  const specJob    = quote.job ?? {};
  const primaryQty = quote.resultQtys?.[0];
  const r          = quote.results?.[primaryQty] ?? {};
  const hasSpec    = primaryQty != null;

  if (!hasSpec) {
    // General invoice — no recognised quote type
    return (
      <>
        <PrintItemsCard lineItems={invoiceLineItems} variant={variant} />
        <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red">
            Print specification
          </h3>
          <div className="mt-4 rounded-lg bg-[var(--t-bg)] border border-[var(--t-border)] px-5 py-4 flex items-center gap-4">
            <div className="text-3xl shrink-0">📋</div>
            <div>
              <p className="text-sm font-semibold text-[var(--t-text1)]">No detailed print spec</p>
              <p className="mt-1 text-xs text-[var(--t-muted)]">
                This job was created from a general invoice rather than a PrintQuoteGH quote.
                Contact CS or refer to the original invoice (ref: {job.quote_ref}) for full production details.
              </p>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Offset print — full spec tiles, no PrintItemsCard
  const bookSizeLabel    = BOOK_SIZES[specJob.bookSize]?.label || `${specJob.bookW}"×${specJob.bookH}"`;
  const parentSheetLabel = PARENT_SHEETS[specJob.parentSheet]?.label ?? "—";
  const bindingLabel     = BINDING_TYPES.find((b) => b.value === specJob.bindingType)?.label ?? "—";
  const lamLabel         = LAM_TYPES.find((l) => l.value === specJob.laminationType)?.label ?? "—";
  const coloursLabel     = specJob.colours === "1" ? "1 colour"
    : specJob.colours === "4" ? "Full colour"
    : `${specJob.colours ?? "—"} colours`;

  // Designer view: only the 4 fields they need
  if (variant === "designer") {
    return (
      <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red mb-4">
          Print specification
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SpecTile icon="📐" label="Finished size"   value={bookSizeLabel} />
          <SpecTile icon="📖" label="Pages"           value={specJob.numPages ?? "—"} />
          <SpecTile icon="🎨" label="Colours"         value={coloursLabel} />
          <SpecTile icon="📚" label="Binding"         value={bindingLabel} />
        </div>
      </div>
    );
  }

  const plateSub = specJob.useManualPlates
    ? "entered manually"
    : r.paper?.pagesPerSheet
    ? `${Math.ceil(specJob.numPages / r.paper.pagesPerSheet)} forms × 2 sides × ${specJob.colours} colour${specJob.colours > 1 ? "s" : ""}`
    : null;

  return (
    <div className="rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] p-5 sm:p-8">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red">
        Print specification
      </h3>

      {/* Quantity hero */}
      <div className="mt-4 rounded-lg bg-brand-red text-white px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide opacity-70">Quantity</div>
          <div className="text-2xl font-bold">{primaryQty?.toLocaleString() ?? "—"} copies</div>
        </div>
        <div className="text-4xl">📦</div>
      </div>

      {/* Job meta */}
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
        <div>
          <dt className="text-xs text-[var(--t-muted)]">Pages</dt>
          <dd className="font-medium text-[var(--t-text1)]">{specJob.numPages ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--t-muted)]">Colours</dt>
          <dd className="font-medium text-[var(--t-text1)]">{coloursLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--t-muted)]">Book size</dt>
          <dd className="font-medium text-[var(--t-text1)]">{bookSizeLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-[var(--t-muted)]">Parent sheet</dt>
          <dd className="font-medium text-[var(--t-text1)]">{parentSheetLabel}</dd>
        </div>
      </dl>

      {/* Spec tiles */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SpecTile icon="🗞️" label="Plates" value={r.numPlates ?? "—"} sub={plateSub} />
        <SpecTile
          icon="📄"
          label="Paper"
          value={r.paper?.reamsNeeded ? `${r.paper.reamsNeeded} reams` : "—"}
          sub={r.paper ? `${r.paper.sheetsPerCopy} sheets/copy · ${r.paper.pagesPerSheet} pages/sheet` : null}
        />
        <SpecTile icon="🖨️" label="Impressions" value={r.impressions ?? "—"} sub="press runs" />
        <SpecTile icon="📚" label="Binding" value={bindingLabel} />
        {specJob.hasCover && (
          <>
            <SpecTile
              icon="📑"
              label="Cover paper"
              value={r.coverPaper?.reamsNeeded ? `${r.coverPaper.reamsNeeded} reams` : "—"}
              sub={r.coverPaper ? `${r.coverPaper.panelsPerSheet} covers/sheet` : null}
            />
            <SpecTile
              icon="✨"
              label="Cover lamination"
              value={lamLabel}
              sub={`${specJob.coverColours ?? "—"} colour cover`}
            />
          </>
        )}
        <SpecTile icon="🗂️" label="Fold & Collate" value="✓" sub="per copy" />
      </div>
    </div>
  );
}
