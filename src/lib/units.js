/**
 * units.js
 * Length units shared by every quoter (Offset, Digital, Live Quote).
 *
 * The quoters keep storing sizes in the unit they always priced in (offset:
 * inches, digital page sizes: millimetres), so pricing and saved quotes are
 * unchanged. The unit picker only changes how sizes are SHOWN and TYPED:
 * values are converted on the way in and out.
 */

// mm per unit. `decimals` = how precisely a converted value is shown.
export const UNITS = {
  mm: { label: "mm", name: "Millimetres", mm: 1,      decimals: 1, step: "1"     },
  cm: { label: "cm", name: "Centimetres", mm: 10,     decimals: 2, step: "0.1"   },
  m:  { label: "m",  name: "Metres",      mm: 1000,   decimals: 4, step: "0.001" },
  in: { label: "in", name: "Inches",      mm: 25.4,   decimals: 2, step: "0.01"  },
  ft: { label: "ft", name: "Feet",        mm: 304.8,  decimals: 3, step: "0.01"  },
};

export const UNIT_KEYS = Object.keys(UNITS);

// Metres per unit — used by the banner/sticker area pricing.
export const UNIT_TO_M = Object.fromEntries(UNIT_KEYS.map((u) => [u, UNITS[u].mm / 1000]));

const unitOf = (u) => UNITS[u] || UNITS.mm;

// Trim float noise and pointless trailing zeros (148.0000001 → 148, 0.2000 → 0.2).
export function roundFor(value, unit) {
  const n = Number(value);
  if (!isFinite(n)) return 0;
  const f = 10 ** unitOf(unit).decimals;
  return Math.round(n * f) / f;
}

export function convertLength(value, from, to) {
  const n = Number(value);
  if (!isFinite(n)) return 0;
  if (from === to) return n;
  return roundFor((n * unitOf(from).mm) / unitOf(to).mm, to);
}

// "148mm"
export function fmtLength(value, unit) {
  return `${roundFor(value, unit).toLocaleString("en-GH", { maximumFractionDigits: unitOf(unit).decimals })}${unitOf(unit).label}`;
}

// "148mm × 210mm" from a size stored in `baseUnit`, shown in `displayUnit`.
export function fmtDims(w, h, baseUnit, displayUnit = baseUnit) {
  return `${fmtLength(convertLength(w, baseUnit, displayUnit), displayUnit)} × ${fmtLength(convertLength(h, baseUnit, displayUnit), displayUnit)}`;
}

// "A5 (148mm × 210mm)": a preset's name with its size in the display unit.
export function presetLabel(name, w, h, baseUnit, displayUnit = baseUnit) {
  return `${name} (${fmtDims(w, h, baseUnit, displayUnit)})`;
}
