/**
 * LoginBackdrop.jsx
 * Optional admin-set background image for every sign-in / sign-up screen.
 * Set in Admin → Settings → Login background (settings.login_background).
 * Renders nothing when no image is set, so the default dark gradient shows.
 * The parent must be `relative`; place this before the page content.
 */
import { useEffect, useState } from "react";
import { loadLoginBackground } from "../lib/loginBackground.js";

export function LoginBackdrop() {
  const [bg, setBg] = useState(null);

  useEffect(() => {
    let alive = true;
    loadLoginBackground().then((b) => { if (alive) setBg(b); });
    return () => { alive = false; };
  }, []);

  if (!bg?.image_url) return null;
  const overlay = Math.min(0.9, Math.max(0, Number(bg.overlay ?? 0.55)));

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <img src={bg.image_url} alt="" className="h-full w-full object-cover" />
      {/* Dark overlay keeps the white form card and light text readable */}
      <div className="absolute inset-0" style={{ background: `rgba(17,17,19,${overlay})` }} />
    </div>
  );
}
