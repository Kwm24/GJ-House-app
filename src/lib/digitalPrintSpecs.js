import { presetLabel, fmtDims } from "./units.js";

export const DIGITAL_SHEET_NAMES = ['A3 Extra', 'A3', 'A4'];

// Finished-size presets for digital jobs, in millimetres. The keys are stored
// in saved quotes, so they never change; use digitalSizeLabel() for display.
export const DIGITAL_SIZES = {
  'A6 (105×148)':          [105, 148],
  'DL (99×210)':           [99,  210],
  'A5 (148×210)':          [148, 210],
  'A4 (210×297)':          [210, 297],
  'A3 (297×420)':          [297, 420],
  'Business card (90×55)': [90,   55],
  'A4 flat (297×210)':     [297, 210],
  'A3 flat (420×297)':     [420, 297],
  'Custom':                null,
};

// Size of a saved digital job for spec sheets / invoice lines, in the unit the
// quote was made in: "A5 (148mm × 210mm)", "Custom (10cm × 15cm)", "6ft × 3ft".
export function digitalJobSizeLabel(j = {}) {
  if (isUnitJob(j.jobType)) return j.unitItem || '—';
  if (j.jobType === 'banner' || j.jobType === 'sticker') return `${j.lfWidth}${j.lfUnit} × ${j.lfHeight}${j.lfUnit}`;
  const unit = j.dimUnit || 'mm';
  if (j.sizeKey === 'Custom') return `Custom (${fmtDims(j.customW, j.customH, 'mm', unit)})`;
  return digitalSizeLabel(j.sizeKey, unit);
}

// "A5 (148mm × 210mm)" — preset name with its size in the chosen unit.
export function digitalSizeLabel(key, unit = 'mm') {
  if (key === 'Custom') return 'Custom size';
  const dims = DIGITAL_SIZES[key];
  const name = String(key).split(' (')[0];
  return dims ? presetLabel(name, dims[0], dims[1], 'mm', unit) : String(key ?? '');
}

export const DIGITAL_STOCK_NAMES = [
  '80gsm Bond',
  '130gsm Gloss',
  '170gsm Gloss',
  '250gsm Card',
  '300gsm Card',
];

export const DEFAULT_DIGITAL_RATES = {
  sheets: {
    'A3 Extra': { w: 320, h: 450, p1: 3.5, p2: 6.0 },
    'A3':       { w: 297, h: 420, p1: 3.0, p2: 5.0 },
    'A4':       { w: 210, h: 297, p1: 1.0, p2: 1.6 },
  },
  stocks: {
    '80gsm Bond':   { 'A3 Extra': 0.90, 'A3': 0.80, 'A4': 0.40 },
    '130gsm Gloss': { 'A3 Extra': 1.60, 'A3': 1.40, 'A4': 0.70 },
    '170gsm Gloss': { 'A3 Extra': 2.20, 'A3': 1.90, 'A4': 0.95 },
    '250gsm Card':  { 'A3 Extra': 3.40, 'A3': 3.00, 'A4': 1.50 },
    '300gsm Card':  { 'A3 Extra': 4.20, 'A3': 3.70, 'A4': 1.90 },
  },
  lf: {
    banner: {
      'Flex banner 280gsm': 7,
      'Flex banner 440gsm': 9,
      'Mesh banner': 11,
    },
    sticker: {
      'Vinyl – gloss':  12,
      'Vinyl – matt':   12,
      'Clear vinyl':    14,
      'One-way vision': 20,
      'Reflective vinyl': 25,
    },
  },
  // Products priced per piece (cost to us per piece, before markup). Lists,
  // so the admin can add / rename / remove items. See UNIT_JOB_TYPES.
  unit: {
    // One size (80 × 200 cm, with stand); the customer picks the material
    rollup: [
      { name: 'Roll-up banner 80 × 200 cm, Flexy', cost: 350 },
      { name: 'Roll-up banner 80 × 200 cm, PVC',   cost: 450 },
    ],
    tshirt: [
      { name: 'Round-neck T-shirt, front print',          cost: 45 },
      { name: 'Round-neck T-shirt, front & back print',   cost: 60 },
      { name: 'Polo shirt, front print',                  cost: 65 },
      { name: 'Print only (customer brings the shirt)',   cost: 20 },
    ],
    souvenir: [
      { name: 'Ceramic mug',                  cost: 25 },
      { name: 'Magic (colour-changing) mug',  cost: 40 },
      { name: 'Plastic cup',                  cost: 8 },
      { name: 'Paper cup',                    cost: 3 },
      { name: 'Pen',                          cost: 3 },
      { name: 'Key holder',                   cost: 10 },
      { name: 'Notebook / jotter',            cost: 25 },
      { name: 'Tote bag',                     cost: 20 },
      { name: 'Cap',                          cost: 35 },
      { name: 'Water bottle',                 cost: 30 },
      { name: 'Wristband',                    cost: 5 },
      { name: 'Lanyard',                      cost: 8 },
      { name: 'Umbrella',                     cost: 60 },
      { name: 'Flash drive',                  cost: 50 },
    ],
  },
  // Lamination cost per parent sheet, per laminated side (GH₵)
  lamination: {
    'Gloss':               { 'A3 Extra': 2.50, 'A3': 2.20, 'A4': 1.20 },
    'Matt':                { 'A3 Extra': 2.50, 'A3': 2.20, 'A4': 1.20 },
    'Soft-touch (velvet)': { 'A3 Extra': 4.00, 'A3': 3.50, 'A4': 1.90 },
  },
  bind: {
    'None': 0,
    'Saddle stitch': 0.8,
    'Perfect bound': 3.0,
    'Wire-O': 3.5,
  },
  // Global settings
  margin:     5,    // mm non-print margin on each side
  gutter:     3,    // mm gap between pieces
  wasteFixed: 5,    // extra sheets (fixed)
  wastePct:   2,    // extra waste as % of base sheets
  markup:     40,   // selling price markup %
  setup:      0,    // fixed setup fee GHS
  fold:       0.30, // folding per copy GHS
  bannerFin:  5,    // banner hem & eyelets per piece GHS
  stickerCut: 2,    // sticker cutting per piece GHS
  lfMin:      10,   // minimum charge per banner/sticker GHS
  lfMarkup:   40,   // large-format markup % (on top of material cost)
  areaUnit:   'sqft', // 'sqft' | 'sqm'
  unitMarkup: 40,   // markup % on per-piece products (roll-ups, T-shirts, souvenirs)
};

// ── Per-piece products ─────────────────────────────────────────────────────────
// Priced as unit cost × quantity (no sheets / area). Keys are stored in saved
// quotes, so they never change.
export const UNIT_JOB_TYPES = ['rollup', 'tshirt', 'souvenir'];
export const UNIT_JOB_LABELS = {
  rollup:   'Roll-up banner',
  tshirt:   'T-shirt printing',
  souvenir: 'Souvenir branding',
};
export const isUnitJob = (jobType) => UNIT_JOB_TYPES.includes(jobType);

// Key of a per-piece item's Live Quote image in settings.instant_quoter_thumbnails
// ("souvenir:Ceramic mug"). Job types use their plain key ("flyer").
export const unitThumbKey = (jobType, itemName) => `${jobType}:${itemName}`;

// The item list for a per-piece job type ([{ name, cost }]).
export function unitItems(rates, jobType) {
  const list = rates?.unit?.[jobType];
  return Array.isArray(list) ? list.filter((i) => i && i.name) : [];
}

// Saved settings over the defaults. Item lists (arrays) are replaced, not
// merged, so items the admin removed stay removed.
export function mergeDigitalRates(saved, base = DEFAULT_DIGITAL_RATES) {
  return deepMerge(base, saved || {});
}

function deepMerge(target, source) {
  const out = { ...target };
  for (const k of Object.keys(source)) {
    const v = source[k];
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out[k] = deepMerge(target?.[k] || {}, v);
    } else {
      out[k] = v;
    }
  }
  return out;
}

// Lamination options shown in the quoters ('None' is not stored in rates)
export const LAMINATION_NONE = 'None';

export function laminationOptions(rates) {
  return [LAMINATION_NONE, ...Object.keys(rates?.lamination || {})];
}

// Cost to laminate `sheets` parent sheets of `sheetName` on `sides` sides.
export function laminationCost(type, sheetName, sheets, sides, rates) {
  if (!type || type === LAMINATION_NONE || !sheets || !sides) return 0;
  const rate = (rates?.lamination?.[type] || {})[sheetName] || 0;
  return sheets * sides * rate;
}
