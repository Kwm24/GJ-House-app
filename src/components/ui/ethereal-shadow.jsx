/**
 * ethereal-shadow.jsx
 * Slow, smoky "ethereal shadow" background: a soft shadow shape (an image
 * mask filled with `color`) warped by an animated SVG turbulence +
 * displacement filter, with an optional film-grain layer on top.
 * Fills its parent (position it absolutely, e.g. `absolute inset-0`).
 *
 * Adapted from the 21st.dev "etheral-shadow" component (TypeScript +
 * framer-motion) for this plain-JS app:
 *   - the hue-rotation is driven by requestAnimationFrame (no framer-motion)
 *   - the mask and grain images are served from /public/login/ (no 21st CDN)
 *   - `background` colour behind the shadow; still frame under reduced motion;
 *     pauses when the tab is hidden; fades in once the mask image has loaded
 *   - the demo's centred heading is removed (children render on top instead)
 *
 * Props
 *   color      shadow colour (any CSS colour)          "rgba(128,128,128,1)"
 *   background colour behind the shadow                "#0E0E11"
 *   animation  { scale 0–100 (warp strength), speed 1–100 }  — scale 0 = no warp
 *   noise      { opacity 0–1, scale }                   film grain
 *   sizing     "fill" | "stretch"
 */
import { useEffect, useId, useRef, useState } from "react";

const MASK_URL  = "/login/shadow-mask.png";
const NOISE_URL = "/login/noise.png";

function mapRange(value, fromLow, fromHigh, toLow, toHigh) {
  if (fromLow === fromHigh) return toLow;
  return toLow + ((value - fromLow) / (fromHigh - fromLow)) * (toHigh - toLow);
}

export function EtherealShadow({
  sizing = "fill",
  color = "rgba(128, 128, 128, 1)",
  background = "#0E0E11",
  animation,
  noise,
  style,
  className = "",
  children,
}) {
  const id = `shadowoverlay-${useId().replace(/:/g, "")}`;
  const matrixRef = useRef(null);
  const [maskReady, setMaskReady] = useState(false);

  const animationEnabled = !!animation && animation.scale > 0;
  const displacementScale = animation ? mapRange(animation.scale, 1, 100, 20, 100) : 0;
  const animationDuration = animation ? mapRange(animation.speed, 1, 100, 1000, 50) : 1;

  // Preload the mask so the shadow fades in instead of popping
  useEffect(() => {
    const img = new Image();
    img.onload = () => setMaskReady(true);
    img.onerror = () => setMaskReady(true);
    img.src = MASK_URL;
  }, []);

  // Rotate the turbulence hue 0→360° in a loop (one turn every duration/25 s)
  useEffect(() => {
    if (!animationEnabled) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduce.matches) return;   // still frame
    const periodMs = (animationDuration / 25) * 1000;
    let raf = 0;
    let start = performance.now();
    let pausedAt = null;
    const tick = (now) => {
      if (document.hidden) { pausedAt = pausedAt ?? now; raf = requestAnimationFrame(tick); return; }
      if (pausedAt != null) { start += now - pausedAt; pausedAt = null; }
      const deg = (((now - start) % periodMs) / periodMs) * 360;
      matrixRef.current?.setAttribute("values", String(deg));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [animationEnabled, animationDuration]);

  return (
    <div className={className}
      style={{ overflow: "hidden", position: "relative", width: "100%", height: "100%", background, ...style }}>
      <div style={{
        position: "absolute",
        inset: -displacementScale,
        filter: animationEnabled ? `url(#${id}) blur(4px)` : "none",
        opacity: maskReady ? 1 : 0,
        transition: "opacity 1.2s ease",
      }}>
        {animationEnabled && (
          <svg style={{ position: "absolute", width: 0, height: 0 }} aria-hidden="true">
            <defs>
              <filter id={id}>
                <feTurbulence
                  result="undulation"
                  numOctaves="2"
                  baseFrequency={`${mapRange(animation.scale, 0, 100, 0.001, 0.0005)},${mapRange(animation.scale, 0, 100, 0.004, 0.002)}`}
                  seed="0"
                  type="turbulence"
                />
                <feColorMatrix ref={matrixRef} in="undulation" type="hueRotate" values="180" />
                <feColorMatrix in="dist" result="circulation" type="matrix"
                  values="4 0 0 0 1  4 0 0 0 1  4 0 0 0 1  1 0 0 0 0" />
                <feDisplacementMap in="SourceGraphic" in2="circulation" scale={displacementScale} result="dist" />
                <feDisplacementMap in="dist" in2="undulation" scale={displacementScale} result="output" />
              </filter>
            </defs>
          </svg>
        )}
        <div style={{
          backgroundColor: color,
          maskImage: `url('${MASK_URL}')`,
          WebkitMaskImage: `url('${MASK_URL}')`,
          maskSize: sizing === "stretch" ? "100% 100%" : "cover",
          WebkitMaskSize: sizing === "stretch" ? "100% 100%" : "cover",
          maskRepeat: "no-repeat",
          WebkitMaskRepeat: "no-repeat",
          maskPosition: "center",
          WebkitMaskPosition: "center",
          width: "100%",
          height: "100%",
        }} />
      </div>

      {children}

      {noise && noise.opacity > 0 && (
        <div style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          backgroundImage: `url("${NOISE_URL}")`,
          backgroundSize: noise.scale * 200,
          backgroundRepeat: "repeat",
          opacity: noise.opacity / 2,
        }} />
      )}
    </div>
  );
}

export default EtherealShadow;
