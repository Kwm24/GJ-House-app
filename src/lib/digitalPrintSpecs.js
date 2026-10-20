export const DIGITAL_SHEET_NAMES = ['A3 Extra', 'A3', 'A4'];

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
};
