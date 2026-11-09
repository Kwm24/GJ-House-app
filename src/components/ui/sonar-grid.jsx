/**
 * sonar-grid.jsx
 * SonarGrid: a decorative dot field that answers taps with expanding rings.
 * Canvas-based; idles when no ring is alive, pauses off-screen and in hidden
 * tabs, and renders a still grid under `prefers-reduced-motion`. Children
 * render on top of the field.
 *
 * Adapted from the 21st.dev SonarGrid (TypeScript + shadcn) for this plain-JS
 * Vite app, with one addition: `colors`. Each new ring takes the next colour
 * in the list (e.g. CMYK inks), and where rings cross, the dots overprint
 * with `multiply` like ink on paper (cyan + magenta = blue).
 *
 * Props
 *   spacing      distance between dots (px)                     26
 *   dotRadius    resting dot radius (px)                        1.4
 *   baseOpacity  resting dot opacity (0–1)                      0.28
 *   color        resting dot colour (any CSS colour)            currentColor of the canvas
 *   colors       ring colours, used in turn                     [color]
 *   blend        canvas composite for ring dots                 "multiply"
 *   pingEvery    seconds between ambient pings (0 = off)        2.4
 *   speed        wavefront speed (px/s)                         260
 *   ringWidth    wavefront thickness (px)                       90
 *   amplitude    dot growth at the wave peak                    2.2
 *   interactive  ping where the user taps / clicks              true
 *   maxRings     max simultaneous rings                         6
 *   seedPing     start with one ring mid-expansion              true
 *   pingArea     spawn area as fractions [x0, y0, x1, y1]       [0.15, 0.2, 0.85, 0.8]
 */
import { useCallback, useEffect, useRef } from "react";

const MAX_DPR = 2;
const TAU = Math.PI * 2;

export function SonarGrid({
  spacing = 26,
  dotRadius = 1.4,
  baseOpacity = 0.28,
  color,
  colors,
  blend = "multiply",
  pingEvery = 2.4,
  speed = 260,
  ringWidth = 90,
  amplitude = 2.2,
  interactive = true,
  maxRings = 6,
  seedPing = true,
  pingArea = [0.15, 0.2, 0.85, 0.8],
  className = "",
  children,
  ref,
  ...rest
}) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const ringsRef = useRef([]);
  const refreshRef = useRef(() => {});

  // The render loop reads props through this ref so changes apply live without restarting it.
  const opts = useRef(null);
  opts.current = { spacing, dotRadius, baseOpacity, colors, blend, pingEvery, speed, ringWidth, amplitude, interactive, maxRings, seedPing, pingArea };

  const setHost = useCallback((node) => {
    hostRef.current = node;
    if (typeof ref === "function") ref(node);
    else if (ref) ref.current = node;
  }, [ref]);

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0;
    let height = 0;
    let raf = 0;
    let timer = 0;
    let visible = true;
    let seeded = false;
    let stroke = "";
    let colorIndex = 0;
    let nextPing = performance.now() + opts.current.pingEvery * 1000;

    const readColor = () => { stroke = getComputedStyle(canvas).color; };

    // Next ink in the rotation (falls back to the resting colour)
    const nextRingColor = () => {
      const list = opts.current.colors;
      if (!list || !list.length) return null;
      const c = list[colorIndex % list.length];
      colorIndex += 1;
      return c;
    };

    const addRing = (x, y, born) => {
      readColor();
      const rings = ringsRef.current;
      rings.push({ x, y, born, color: nextRingColor() });
      while (rings.length > opts.current.maxRings) rings.shift();
    };

    const draw = (now) => {
      const o = opts.current;
      const lifetime = (Math.hypot(width, height) + o.ringWidth) / o.speed; // seconds until a ring leaves the canvas
      ringsRef.current = ringsRef.current.filter((r) => (now - r.born) / 1000 < lifetime);
      const live = ringsRef.current.map((r) => {
        const age = (now - r.born) / 1000;
        const radius = age * o.speed;
        return { x: r.x, y: r.y, radius, reach: radius + o.ringWidth, fade: 1 - age / lifetime, color: r.color || stroke };
      });

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = stroke;

      const cols = Math.ceil(width / o.spacing) + 1;
      const rows = Math.ceil(height / o.spacing) + 1;
      const offsetX = (width - (cols - 1) * o.spacing) / 2;
      const offsetY = (height - (rows - 1) * o.spacing) / 2;

      // Pass 1: every resting dot in a single path and a single fill.
      // Dots on a wavefront are collected with each ring's contribution.
      const hot = [];
      ctx.globalAlpha = o.baseOpacity;
      ctx.beginPath();
      for (let i = 0; i < cols; i++) {
        const cx = offsetX + i * o.spacing;
        for (let j = 0; j < rows; j++) {
          const cy = offsetY + j * o.spacing;
          let parts = null;
          for (const r of live) {
            if (Math.abs(cx - r.x) > r.reach || Math.abs(cy - r.y) > r.reach) continue;
            const dist = Math.abs(Math.hypot(cx - r.x, cy - r.y) - r.radius);
            if (dist >= o.ringWidth) continue;
            const t = 1 - dist / o.ringWidth;
            const k = t * t * (3 - 2 * t) * r.fade; // smoothstep, fading with age
            if (k < 0.01) continue;
            (parts ||= []).push(r.color, k);
          }
          if (!parts) {
            ctx.moveTo(cx + o.dotRadius, cy);
            ctx.arc(cx, cy, o.dotRadius, 0, TAU);
          } else {
            hot.push(cx, cy, parts);
          }
        }
      }
      ctx.fill();

      // Pass 2: wavefront dots, one circle per ring ink, overprinted.
      ctx.globalCompositeOperation = o.blend || "source-over";
      for (let h = 0; h < hot.length; h += 3) {
        const cx = hot[h], cy = hot[h + 1], parts = hot[h + 2];
        for (let p = 0; p < parts.length; p += 2) {
          const k = parts[p + 1];
          ctx.fillStyle = parts[p];
          ctx.globalAlpha = o.baseOpacity + (1 - o.baseOpacity) * k;
          ctx.beginPath();
          ctx.arc(cx, cy, o.dotRadius * (1 + o.amplitude * k), 0, TAU);
          ctx.fill();
        }
      }
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    };

    const resize = () => {
      const rect = host.getBoundingClientRect();
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!seeded) {
        // One ring already mid-expansion inside the ping area, so the first paint shows the idea.
        seeded = true;
        const [x0, y0, x1, y1] = opts.current.pingArea;
        if (opts.current.seedPing && !reduceMotion.matches) {
          addRing(width * (x0 + (x1 - x0) * 0.68), height * (y0 + (y1 - y0) * 0.34), performance.now() - 500);
        }
      }
      draw(performance.now());
    };

    const scheduleIdle = (delay) => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => tick(performance.now()), Math.max(16, delay));
    };

    const tick = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      if (reduceMotion.matches) {
        ringsRef.current = [];
        draw(now);
        return;
      }
      const o = opts.current;
      if (o.pingEvery > 0 && now >= nextPing) {
        const [x0, y0, x1, y1] = o.pingArea;
        addRing(width * (x0 + Math.random() * (x1 - x0)), height * (y0 + Math.random() * (y1 - y0)), now);
        nextPing = now + o.pingEvery * 1000;
      }
      draw(now);
      if (ringsRef.current.length > 0) raf = requestAnimationFrame(tick);
      else if (o.pingEvery > 0) scheduleIdle(nextPing - now);
    };

    const wake = () => {
      if (!raf) {
        window.clearTimeout(timer);
        raf = requestAnimationFrame(tick);
      }
    };

    refreshRef.current = () => {
      readColor();
      nextPing = Math.min(nextPing, performance.now() + opts.current.pingEvery * 1000);
      wake();
    };

    const onDown = (e) => {
      if (!opts.current.interactive || reduceMotion.matches) return;
      const rect = host.getBoundingClientRect();
      addRing(e.clientX - rect.left, e.clientY - rect.top, performance.now());
      wake();
    };
    const onVisibility = () => { if (!document.hidden) wake(); };

    const ro = new ResizeObserver(resize);
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
      if (visible) wake();
    }, { threshold: 0 });
    const mo = new MutationObserver(() => refreshRef.current());

    readColor();
    resize();
    ro.observe(host);
    io.observe(host);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "style", "data-theme"] });
    host.addEventListener("pointerdown", onDown);
    document.addEventListener("visibilitychange", onVisibility);
    reduceMotion.addEventListener("change", wake);
    wake();

    return () => {
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      host.removeEventListener("pointerdown", onDown);
      document.removeEventListener("visibilitychange", onVisibility);
      reduceMotion.removeEventListener("change", wake);
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
      refreshRef.current = () => {};
    };
  }, []);

  // Prop changes while the loop is asleep still repaint immediately.
  const colorsKey = (colors || []).join("|");
  const areaKey = pingArea.join(",");
  useEffect(() => {
    refreshRef.current();
  }, [spacing, dotRadius, baseOpacity, color, colorsKey, blend, pingEvery, speed, ringWidth, amplitude, interactive, maxRings, areaKey]);

  return (
    <div
      ref={setHost}
      data-slot="sonar-grid"
      className={["relative isolate overflow-hidden", className].filter(Boolean).join(" ")}
      {...rest}
    >
      <canvas
        ref={canvasRef}
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full"
        style={color ? { color } : undefined}
      />
      {children}
    </div>
  );
}

export default SonarGrid;
