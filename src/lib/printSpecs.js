export const PARENT_SHEETS = {
  standard: { w: 30, h: 40, label: 'Standard (30×40")' },
  nigeria: { w: 24, h: 30, label: 'Nigeria (24×30")' },
};

export const BOOK_SIZES = {
  A5: { w: 5.83, h: 8.27, label: 'A5 (5.83 × 8.27")' },
  A4: { w: 8.27, h: 11.69, label: 'A4 (8.27 × 11.69")' },
  A3: { w: 11.69, h: 16.54, label: 'A3 (11.69 × 16.54")' },
  Custom: { w: 0, h: 0, label: "Custom" },
};

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
  foldCollateRate: 0.6,
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
      { key: "foldCollateRate", label: "Fold & collate (per copy)" },
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
