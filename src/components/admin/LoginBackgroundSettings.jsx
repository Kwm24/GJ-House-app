/**
 * LoginBackgroundSettings.jsx
 * Admin → Settings: the animated "ethereal shadow" background behind every
 * sign-in / sign-up screen (staff lobbies + customers). Saved in
 * settings.login_background (see lib/loginBackground.js).
 */
import { useEffect, useState } from "react";
import { getSettings, updateSettings } from "../../lib/settings.js";
import {
  DEFAULT_LOGIN_BACKGROUND, LOGIN_BACKGROUND_PRESETS, normalizeLoginBackground, loadLoginBackground,
} from "../../lib/loginBackground.js";
import { ShadowScene } from "../LoginBackdrop.jsx";

const hexInput =
  "w-24 rounded-lg border border-gray-300 bg-white px-2.5 py-2 text-sm font-mono text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red";

function ColourField({ id, label, hint, value, onChange }) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);
  return (
    <div>
      <label htmlFor={id} className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input id={id} type="color" value={value} onChange={(e) => onChange(e.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer rounded-lg border border-gray-300 bg-white p-1" />
        <input type="text" value={text} maxLength={7} aria-label={`${label} hex code`} className={hexInput}
          onChange={(e) => {
            const v = e.target.value.trim();
            setText(v);
            if (/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v)) onChange(v);
          }} />
      </div>
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

function Slider({ id, label, value, min, max, step, onChange, display, hint }) {
  return (
    <div>
      <label htmlFor={id} className="flex justify-between text-xs font-medium text-gray-600 mb-1.5">
        <span>{label}</span><span className="tabular-nums text-gray-500">{display}</span>
      </label>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))} className="w-full accent-brand-red" />
      {hint && <p className="mt-1 text-[11px] text-gray-500">{hint}</p>}
    </div>
  );
}

export function LoginBackgroundSettings() {
  const [cfg,    setCfg]    = useState(DEFAULT_LOGIN_BACKGROUND);
  const [saved,  setSaved]  = useState(DEFAULT_LOGIN_BACKGROUND);
  const [saving, setSaving] = useState(false);
  const [msg,    setMsg]    = useState(null);

  useEffect(() => {
    getSettings()
      .then((s) => { const c = normalizeLoginBackground(s?.login_background); setCfg(c); setSaved(c); })
      .catch(() => {});
  }, []);

  const set = (k, v) => { setCfg((c) => ({ ...c, [k]: v })); setMsg(null); };
  const dirty = JSON.stringify(cfg) !== JSON.stringify(saved);

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await updateSettings({ login_background: cfg });
      loadLoginBackground({ refresh: true });   // sign-in pages pick it up straight away
      setSaved(cfg);
      setMsg({ ok: true, text: "Login background saved. Open a sign-in page to see it." });
    } catch (err) {
      const m = err.message ?? "";
      setMsg({ ok: false, text: m.includes("login_background")
        ? "Run supabase/037_login_background_and_production_rates.sql in Supabase first."
        : (m || "Could not save the login background.") });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
      <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Login background</h2>
      <p className="mt-1 text-sm text-gray-600">
        The moving shadow behind every sign-in and sign-up page (staff lobbies and customers). Changes show in the preview straight away. Click <b>Save</b> to apply them.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Live preview with a mock glass sign-in card */}
        <div className="relative aspect-video overflow-hidden rounded-xl border border-gray-300 bg-black">
          <ShadowScene config={cfg} washSize="16rem 11rem" />
          <div className="absolute left-1/2 top-1/2 w-2/5 -translate-x-1/2 -translate-y-1/2 space-y-1.5 text-center">
            <div className="mx-auto h-2 w-1/3 rounded bg-white/90" />
            <div className="rounded-lg border border-white/50 bg-white/85 p-2.5 shadow-xl backdrop-blur-md">
              <div className="h-1.5 w-1/2 rounded bg-gray-400" />
              <div className="mt-2 h-3 rounded border border-gray-200 bg-white" />
              <div className="mt-1 h-3 rounded border border-gray-200 bg-white" />
              <div className="mt-2 h-3 rounded bg-[#6366F1]" />
            </div>
          </div>
          <span className="absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] font-medium text-white">Live preview</span>
        </div>

        <div className="space-y-5">
          {/* Presets */}
          <div>
            <p className="block text-xs font-medium text-gray-600 mb-1.5">Quick looks</p>
            <div className="flex flex-wrap gap-2">
              {LOGIN_BACKGROUND_PRESETS.map((p) => {
                const on = p.color.toLowerCase() === cfg.color.toLowerCase() && p.background.toLowerCase() === cfg.background.toLowerCase();
                return (
                  <button key={p.name} type="button" aria-pressed={on}
                    onClick={() => { setCfg((c) => ({ ...c, color: p.color, background: p.background })); setMsg(null); }}
                    className={`inline-flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5 text-xs font-medium transition-colors ${on ? "border-brand-red text-brand-red" : "border-gray-300 text-gray-700 hover:border-gray-400"}`}>
                    <span className="flex h-4 w-6 overflow-hidden rounded border border-black/10" aria-hidden="true">
                      <span className="w-1/2" style={{ background: p.background }} />
                      <span className="w-1/2" style={{ background: p.color }} />
                    </span>
                    {p.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <ColourField id="lb-color" label="Shadow colour" value={cfg.color} onChange={(v) => set("color", v)}
              hint="The moving smoke / shadow." />
            <ColourField id="lb-bg" label="Background colour" value={cfg.background} onChange={(v) => set("background", v)}
              hint="Behind the shadow. Darker keeps white headings readable." />
          </div>

          <Slider id="lb-warp" label="Ripple" min={0} max={100} step={1}
            value={cfg.warp} onChange={(v) => set("warp", v)}
            display={cfg.warp === 0 ? "Off (still shape)" : cfg.warp < 40 ? "Gentle" : cfg.warp < 75 ? "Medium" : "Strong"} />
          <Slider id="lb-speed" label="Speed" min={1} max={100} step={1}
            value={cfg.speed} onChange={(v) => set("speed", v)}
            display={cfg.speed < 35 ? "Slow" : cfg.speed < 75 ? "Normal" : "Fast"} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Slider id="lb-grain" label="Film grain" min={0} max={1} step={0.05}
              value={cfg.grain} onChange={(v) => set("grain", v)}
              display={cfg.grain === 0 ? "Off" : `${Math.round(cfg.grain * 100)}%`} />
            <Slider id="lb-grainsize" label="Grain size" min={0.5} max={2} step={0.1}
              value={cfg.grainSize} onChange={(v) => set("grainSize", v)}
              display={`${cfg.grainSize.toFixed(1)}×`} />
          </div>
          <Slider id="lb-wash" label="Darken behind the form" min={0} max={0.95} step={0.05}
            value={cfg.wash} onChange={(v) => set("wash", v)}
            display={`${Math.round(cfg.wash * 100)}%`}
            hint="Keeps the headings and links above and below the form easy to read." />

          {msg && (
            <div role="status" className={`rounded-lg border px-4 py-3 text-sm ${msg.ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
              {msg.text}
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            <button type="button" onClick={handleSave} disabled={saving || !dirty}
              className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
              {saving ? "Saving…" : dirty ? "Save" : "Saved"}
            </button>
            <button type="button" onClick={() => { setCfg(DEFAULT_LOGIN_BACKGROUND); setMsg(null); }}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
              Reset to default
            </button>
            {dirty && (
              <button type="button" onClick={() => { setCfg(saved); setMsg(null); }}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:text-gray-900">
                Undo changes
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
