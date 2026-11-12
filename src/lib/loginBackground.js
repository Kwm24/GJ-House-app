import { getSettings } from "./settings.js";

// Sign-in / sign-up background: the animated "ethereal shadow".
// Admin → Settings → Login background saves it in settings.login_background:
//   { style: "shadow", color, background, warp, speed, grain, grainSize, wash }
//     color       the shadow / smoke colour          (hex)
//     background  colour behind it                   (hex)
//     warp        0 – 100  how much the shadow ripples (0 = still shape)
//     speed       1 – 100  how fast it moves
//     grain       0 – 1    film-grain strength
//     grainSize   0.5 – 2  grain size
//     wash        0 – 0.95 how much the middle is darkened so text stays readable
export const DEFAULT_LOGIN_BACKGROUND = {
  style:      "shadow",
  color:      "#A3A3B5",
  background: "#0E0E11",
  warp:       100,
  speed:      90,
  grain:      1,
  grainSize:  1.2,
  wash:       0.45,
};

// Ready-made looks for the settings screen
export const LOGIN_BACKGROUND_PRESETS = [
  { name: "Grey mist",   color: "#A3A3B5", background: "#0E0E11" },
  { name: "Violet",      color: "#7C3AED", background: "#0B0814" },
  { name: "Cyan ink",    color: "#00AEEF", background: "#04111A" },
  { name: "Magenta ink", color: "#EC008C", background: "#14050F" },
  { name: "Gold",        color: "#C9A227", background: "#120F07" },
  { name: "Brand red",   color: "#C0392B", background: "#120606" },
];

const isHex = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || ""));
const clamp = (n, lo, hi, d) => (n !== null && n !== "" && Number.isFinite(Number(n)) ? Math.min(hi, Math.max(lo, Number(n))) : d);

// Saved value (possibly an older halftone / image setting, or null) → full config
export function normalizeLoginBackground(saved) {
  const s = saved && typeof saved === "object" && saved.style === "shadow" ? saved : {};
  const d = DEFAULT_LOGIN_BACKGROUND;
  return {
    style:      "shadow",
    color:      isHex(s.color)      ? s.color      : d.color,
    background: isHex(s.background) ? s.background : d.background,
    warp:       clamp(s.warp, 0, 100, d.warp),
    speed:      clamp(s.speed, 1, 100, d.speed),
    grain:      clamp(s.grain, 0, 1, d.grain),
    grainSize:  clamp(s.grainSize, 0.5, 2, d.grainSize),
    wash:       clamp(s.wash, 0, 0.95, d.wash),
  };
}

// Cached so moving between login pages doesn't refetch; pass refresh after saving.
let cached = null;
export function loadLoginBackground({ refresh = false } = {}) {
  if (!cached || refresh) {
    cached = getSettings()
      .then((s) => normalizeLoginBackground(s?.login_background))
      .catch(() => normalizeLoginBackground(null));
  }
  return cached;
}

function luminance(hex) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

// Colour of the reading wash behind the form: the background, unless that's
// light (white headings need a dark wash)
export function washColour(cfg) {
  return luminance(cfg.background) > 60 ? "#111113" : cfg.background;
}

export function hexToRgba(hex, alpha) {
  const h = hex.replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
