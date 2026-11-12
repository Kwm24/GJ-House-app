/**
 * LoginBackdrop.jsx
 * Background for every sign-in / sign-up screen: the animated "ethereal
 * shadow", with a dark wash in the middle so the glass form card and the
 * white headings stay readable. Colours, movement and grain come from
 * Admin → Settings → Login background.
 * The parent must be `relative`; place this before the page content.
 */
import { useEffect, useState } from "react";
import { EtherealShadow } from "./ui/ethereal-shadow.jsx";
import {
  DEFAULT_LOGIN_BACKGROUND, loadLoginBackground, washColour, hexToRgba,
} from "../lib/loginBackground.js";

// The background itself, from a config (also used by the settings preview)
export function ShadowScene({ config, className = "absolute inset-0", washSize = "38rem 30rem" }) {
  const wash = washColour(config);
  return (
    <div className={`overflow-hidden ${className}`} aria-hidden="true">
      <EtherealShadow
        className="absolute inset-0"
        color={config.color}
        background={config.background}
        animation={{ scale: config.warp, speed: config.speed }}
        noise={{ opacity: config.grain, scale: config.grainSize }}
        sizing="fill"
      />
      {config.wash > 0 && (
        <div className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse ${washSize} at 50% 50%, ${hexToRgba(wash, config.wash)} 0%, ${hexToRgba(wash, config.wash * 0.75)} 45%, ${hexToRgba(wash, 0)} 100%)` }} />
      )}
    </div>
  );
}

export function LoginBackdrop() {
  const [config, setConfig] = useState(DEFAULT_LOGIN_BACKGROUND);

  useEffect(() => {
    let alive = true;
    loadLoginBackground().then((c) => { if (alive && c) setConfig(c); });
    return () => { alive = false; };
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0" aria-hidden="true">
      <ShadowScene config={config} />
    </div>
  );
}
