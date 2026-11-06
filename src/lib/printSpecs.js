import { presetLabel, fmtDims } from "./units.js";

export const PARENT_SHEETS = {
  standard: { w: 30,   h: 40,   label: 'Standard (30in × 40in)' },
  nigeria:  { w: 24,   h: 30,   label: 'Nigeria (24in × 30in)' },
  sra1:     { w: 25.2, h: 35.4, label: 'SRA1 (25.2in × 35.4in)' },
  quarto:   { w: 25,   h: 38,   label: 'Quarto (25in × 38in)' },
  demy:     { w: 22.5, h: 35,   label: 'Demy (22.5in × 35in)' },
};

export const BOOK_SIZES = {
  A5: { w: 148 / 25.4, h: 210 / 25.4, label: 'A5 (148mm × 210mm)' },   // exact ISO size, stored in inches
  A4: { w: 210 / 25.4, h: 297 / 25.4, label: 'A4 (210mm × 297mm)' },
  A3: { w: 297 / 25.4, h: 420 / 25.4, label: 'A3 (297mm × 420mm)' },
  Custom: { w: 0, h: 0, label: "Custom" },
};

// Offset sizes are stored in inches. These helpers show them in any unit:
// offsetBookLabel(job, "mm") → "A5 (148.1mm × 210.1mm)" / "Custom (150mm × 200mm)"
export function offsetBookLabel(job = {}, unit = "in") {
  const preset = BOOK_SIZES[job.bookSize];
  if (preset && job.bookSize !== "Custom") return presetLabel(job.bookSize, preset.w, preset.h, "in", unit);
  return `Custom (${fmtDims(job.bookW, job.bookH, "in", unit)})`;
}

// A parent sheet ({ w, h, label }) in any unit: "Standard (30in × 40in)".
export function offsetSheetLabel(sheet, unit = "in") {
  if (!sheet) return "";
  const name = String(sheet.label || "Custom").split(" (")[0];
  return presetLabel(name, sheet.w, sheet.h, "in", unit);
}

// Lamination types — each with its own rate key
export const LAM_TYPES = [
  { value: "none", label: "None", rateKey: null },
  { value: "gloss_s", label: "Gloss — Single-sided", rateKey: "lamGlossSingle" },
  { value: "gloss_d", label: "Gloss — Double-sided", rateKey: "lamGlossDouble" },
  { value: "matte_s", label: "Matte — Single-sided", rateKey: "lamMatteSingle" },
  { value: "matte_d", label: "Matte — Double-sided", rateKey: "lamMatteDouble" },
  { value: "soft_touch", label: "Soft Touch", rateKey: "lamSoftTouch" },
];

// Binding types — each with its own rate key
export const BINDING_TYPES = [
  { value: "saddle_stitch", label: "Saddle Stitch (staple)", rateKey: "bindSaddleStitch" },
  { value: "perfect", label: "Perfect Binding", rateKey: "bindPerfect" },
  { value: "spiral", label: "Spiral / Comb Binding", rateKey: "bindSpiral" },
  { value: "case", label: "Case Binding (hardcover)", rateKey: "bindCase" },
  { value: "thermal", label: "Thermal Binding", rateKey: "bindThermal" },
  { value: "sewn", label: "Sewn Binding", rateKey: "bindSewn" },
];

// Built-in fallback rates, used until the Admin Settings page saves a
// quote_rates row, and as the floor merged under whatever's saved (so new
// rate fields added later always have a value even for old saved settings).
export const DEFAULT_RATES = {
  plateRate: 750,
  paperRate: 350,
  impressionRate: 120,
  coverPlateRate: 750,
  coverPaperRate: 350,
  coverReamSize: 100,
  foldCollateRate: 0.6,
  trimRate: 0.4,
  // Binding rates per copy by type
  bindSaddleStitch: 0.5,
  bindPerfect: 0.9,
  bindSpiral: 1.2,
  bindCase: 2.5,
  bindThermal: 1.0,
  bindSewn: 1.5,
  // Lamination rates per copy by type
  lamGlossSingle: 1.2,
  lamGlossDouble: 2.0,
  lamMatteSingle: 1.4,
  lamMatteDouble: 2.4,
  lamSoftTouch: 2.8,
  profitMargin: 25,
};

export const RATE_GROUPS = [
  {
    group: "Press & Paper",
    fields: [
      { key: "plateRate", label: "Plate rate (per plate)" },
      { key: "paperRate", label: "Paper rate (per ream)" },
      { key: "impressionRate", label: "Impression rate (per run)" },
      { key: "coverPlateRate", label: "Cover plate (per plate)" },
      { key: "coverPaperRate", label: "Cover paper (per ream)" },
      { key: "coverReamSize",  label: "Cover stock: sheets per ream" },
      { key: "foldCollateRate", label: "Fold & collate (per copy)" },
      { key: "trimRate",       label: "Trimming (per copy)" },
    ],
  },
  {
    group: "Binding (per copy)",
    fields: [
      { key: "bindSaddleStitch", label: "Saddle stitch" },
      { key: "bindPerfect", label: "Perfect binding" },
      { key: "bindSpiral", label: "Spiral / comb" },
      { key: "bindCase", label: "Case binding (hardcover)" },
      { key: "bindThermal", label: "Thermal binding" },
      { key: "bindSewn", label: "Sewn binding" },
    ],
  },
  {
    group: "Lamination (per copy)",
    fields: [
      { key: "lamGlossSingle", label: "Gloss single-sided" },
      { key: "lamGlossDouble", label: "Gloss double-sided" },
      { key: "lamMatteSingle", label: "Matte single-sided" },
      { key: "lamMatteDouble", label: "Matte double-sided" },
      { key: "lamSoftTouch", label: "Soft touch" },
    ],
  },
];
