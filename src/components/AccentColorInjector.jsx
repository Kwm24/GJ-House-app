/**
 * AccentColorInjector.jsx
 * Renders nothing — on mount it reads accent_color from Supabase settings
 * and injects it as two CSS custom properties on <html>:
 *   --c-accent  "R G B"   (space-separated, for Tailwind opacity modifiers)
 *   --br        "#RRGGBB" (hex, for inline styles: color: var(--br,#C0392B))
 */
import { useEffect } from "react";
import { getSettings } from "../lib/settings.js";

function hexToRgbParts(hex) {
  const h = (hex || "").replace("#", "");
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return isNaN(r + g + b) ? null : { rgb: `${r} ${g} ${b}`, hex: `#${h}` };
}

export function applyAccentHex(hex) {
  const parts = hexToRgbParts(hex);
  if (!parts) return;
  document.documentElement.style.setProperty("--c-accent", parts.rgb);
  document.documentElement.style.setProperty("--br", parts.hex);
}

export function AccentColorInjector() {
  useEffect(() => {
    getSettings()
      .then((data) => {
        if (data?.accent_color) applyAccentHex(data.accent_color);
      })
      .catch(() => {
        // Silently ignore — index.css fallback covers unauthenticated state
      });
  }, []);
  return null;
}
