/**
 * dithered-shader-background.jsx
 * Animated simplex-noise field rendered with ordered (Bayer 32×32) dithering:
 * a 1-bit "halftone" look that suits a print shop. Fills its parent
 * (position it absolutely, e.g. `absolute inset-0`).
 *
 * Adapted from the 21st.dev "dithered shader background" (p5.js + TypeScript)
 * to plain WebGL, so it needs no extra library (p5 is ~1 MB). Additions:
 *   - colours: `ink` (the "on" dots) and `paper` (the background), any CSS hex
 *   - renders one still frame under prefers-reduced-motion
 *   - pauses when off-screen / tab hidden; caps device pixel ratio
 *   - if WebGL is unavailable it simply shows the `paper` colour
 *
 * Props: className, scale (dot size; smaller = bigger dots, default 0.5),
 *        speed (default 0.5), ink, paper
 */
import { useEffect, useRef } from "react";

const VERT = `
attribute vec2 aPosition;
void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
`;

const FRAG = `
#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform vec2  u_resolution;
uniform float u_time;
uniform float uScale;
uniform vec3  u_ink;
uniform vec3  u_paper;

// Simplex noise (Ashima Arts)
vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x,289.0);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0,1.0/3.0);
  const vec4 D = vec4(0.0,0.5,1.0,2.0);
  vec3 i = floor(v + dot(v,C.yyy));
  vec3 x0 = v - i + dot(i,C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod(i,289.0);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0,i1.z,i2.z,1.0))
    + i.y + vec4(0.0,i1.y,i2.y,1.0))
    + i.x + vec4(0.0,i1.x,i2.x,1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ *ns.x + ns.yyyy;
  vec4 y = y_ *ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}

// Bayer ordered dithering
float Bayer2(vec2 a) { a = floor(a); return fract(a.x/2.0 + a.y*a.y*0.75); }
#define Bayer4(a)  (Bayer2(0.5*(a))*0.25 + Bayer2(a))
#define Bayer8(a)  (Bayer4(0.5*(a))*0.25 + Bayer2(a))
#define Bayer16(a) (Bayer8(0.5*(a))*0.25 + Bayer2(a))
#define Bayer32(a) (Bayer16(0.5*(a))*0.25 + Bayer2(a))

void main() {
  vec2 uv = gl_FragCoord.xy / u_resolution;
  uv.x *= u_resolution.x / u_resolution.y;
  float t = u_time * 0.5;
  float n1 = snoise(vec3(uv, t));
  float n2 = snoise(vec3(uv + 5.0, t * 1.2));
  float gray = mix(n1, n2, 0.5) * 0.5 + 0.5;
  float d = step(Bayer32(gl_FragCoord.xy * uScale), gray);
  gl_FragColor = vec4(mix(u_paper, u_ink, d), 1.0);
}
`;

function hexToRgb(hex) {
  const h = String(hex || "").replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.padEnd(6, "0").slice(0, 6);
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("[shader]", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

export function DitheredShaderBackground({
  className = "",
  scale = 0.5,
  speed = 0.5,
  ink = "#7C7C94",
  paper = "#0E0E11",
}) {
  const wrapRef   = useRef(null);
  const canvasRef = useRef(null);
  const opts      = useRef({ scale, speed, ink, paper });
  opts.current = { scale, speed, ink, paper };

  useEffect(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const gl = canvas.getContext("webgl", { antialias: false, premultipliedAlpha: false, powerPreference: "low-power" })
            || canvas.getContext("experimental-webgl");
    if (!gl) return;   // no WebGL: the wrapper's background colour shows

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { console.warn("[shader]", gl.getProgramInfoLog(prog)); return; }
    gl.useProgram(prog);

    // Full-screen quad (two triangles)
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, "aPosition");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uRes   = gl.getUniformLocation(prog, "u_resolution");
    const uTime  = gl.getUniformLocation(prog, "u_time");
    const uScale = gl.getUniformLocation(prog, "uScale");
    const uInk   = gl.getUniformLocation(prog, "u_ink");
    const uPaper = gl.getUniformLocation(prog, "u_paper");

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const timeOffset = Math.random() * 100;
    let raf = 0;
    let visible = true;
    let dpr = 1;
    const start = performance.now();

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(wrap.clientWidth * dpr));
      const h = Math.max(1, Math.round(wrap.clientHeight * dpr));
      if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
      gl.viewport(0, 0, w, h);
      draw(performance.now());
    };

    const draw = (now) => {
      const o = opts.current;
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.uniform1f(uTime, ((now - start) / 1000) * (o.speed / 0.5) + timeOffset);
      // Scale is in CSS pixels, so dots look the same size on retina screens
      gl.uniform1f(uScale, o.scale / dpr);
      gl.uniform3fv(uInk, hexToRgb(o.ink));
      gl.uniform3fv(uPaper, hexToRgb(o.paper));
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };

    const tick = (now) => {
      raf = 0;
      if (!visible || document.hidden) return;
      draw(now);
      if (!reduceMotion.matches) raf = requestAnimationFrame(tick);
    };
    const wake = () => { if (!raf) raf = requestAnimationFrame(tick); };

    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    const io = new IntersectionObserver(([e]) => { visible = e?.isIntersecting ?? true; if (visible) wake(); });
    io.observe(wrap);
    const onVis = () => { if (!document.hidden) wake(); };
    document.addEventListener("visibilitychange", onVis);
    reduceMotion.addEventListener("change", wake);

    resize();
    wake();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      reduceMotion.removeEventListener("change", wake);
      gl.deleteBuffer(buf);
      gl.deleteProgram(prog);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div ref={wrapRef} className={`overflow-hidden ${className}`} style={{ background: paper }} aria-hidden="true">
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  );
}

export default DitheredShaderBackground;
