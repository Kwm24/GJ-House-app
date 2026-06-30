import { PARENT_SHEETS, BOOK_SIZES, LAM_TYPES, BINDING_TYPES } from "../lib/printSpecs.js";

function SpecTile({ icon, label, value, sub }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 flex flex-col items-center text-center gap-1">
      <div className="text-3xl leading-none">{icon}</div>
      <div className="text-base font-bold text-brand-dark leading-tight">{value}</div>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
        {label}
      </div>
      {sub && <div className="text-xs text-gray-400">{sub}</div>}
    </div>
  );
}

// Read-only print-specification infographic — no costs/amounts, just the
// physical specs production/design staff need (plates, paper, binding, etc).
export function SpecSheet({ job }) {
  const quote = job.quote ?? {};
  const specJob = quote.job ?? {};
  const primaryQty = quote.resultQtys?.[0];
  const r = quote.results?.[primaryQty] ?? {};

  const bookSizeLabel = BOOK_SIZES[specJob.bookSize]?.label || `${specJob.bookW}"×${specJob.bookH}"`;
  const parentSheetLabel = PARENT_SHEETS[specJob.parentSheet]?.label ?? "—";
  const bindingLabel = BINDING_TYPES.find((b) => b.value === specJob.bindingType)?.label ?? "—";
  const lamLabel = LAM_TYPES.find((l) => l.value === specJob.laminationType)?.label ?? "—";

  const plateSub = specJob.useManualPlates
    ? "entered manually"
    : r.paper?.pagesPerSheet
    ? `${Math.ceil(specJob.numPages / r.paper.pagesPerSheet)} forms × 2 sides × ${specJob.colours} colour${specJob.colours > 1 ? "s" : ""}`
    : null;

  return (
    <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-brand-red">
        Print specification
      </h3>

      {/* Quantity hero */}
      <div className="mt-4 rounded-lg bg-brand-dark text-brand-cream px-5 py-4 flex items-center justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-brand-cream/60">
            Quantity
          </div>
          <div className="text-2xl font-bold">
            {primaryQty?.toLocaleString() ?? "—"} copies
          </div>
        </div>
        <div className="text-4xl">📦</div>
      </div>

      {/* Job meta */}
      <dl className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm text-gray-700">
        <div>
          <dt className="text-xs text-gray-500">Pages</dt>
          <dd className="font-medium">{specJob.numPages ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Colours</dt>
          <dd className="font-medium">
            {specJob.colours === "1"
              ? "1 colour"
              : specJob.colours === "4"
              ? "Full colour"
              : `${specJob.colours ?? "—"} colours`}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Book size</dt>
          <dd className="font-medium">{bookSizeLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-gray-500">Parent sheet</dt>
          <dd className="font-medium">{parentSheetLabel}</dd>
        </div>
      </dl>

      {/* Spec tiles */}
      <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 gap-3">
        <SpecTile icon="🗞️" label="Plates" value={r.numPlates ?? "—"} sub={plateSub} />
        <SpecTile
          icon="📄"
          label="Paper"
          value={r.paper?.reamsNeeded ? `${r.paper.reamsNeeded} reams` : "—"}
          sub={
            r.paper
              ? `${r.paper.sheetsPerCopy} sheets/copy · ${r.paper.pagesPerSheet} pages/sheet`
              : null
          }
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
