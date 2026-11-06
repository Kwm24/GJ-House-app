/**
 * LoginBackgroundSettings.jsx
 * Admin → Settings: background image shown behind every sign-in / sign-up
 * screen (staff lobbies + customer). Stored in settings.login_background as
 * { image_url, overlay }.
 */
import { useEffect, useRef, useState } from "react";
import { getSettings, updateSettings, uploadLoginBackground } from "../../lib/settings.js";
import { loadLoginBackground } from "../../lib/loginBackground.js";

const DEFAULT_OVERLAY = 0.55;

export function LoginBackgroundSettings() {
  const fileRef = useRef(null);
  const [imageUrl,  setImageUrl]  = useState("");
  const [overlay,   setOverlay]   = useState(DEFAULT_OVERLAY);
  const [uploading, setUploading] = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [msg,       setMsg]       = useState("");

  useEffect(() => {
    getSettings()
      .then((s) => {
        const bg = s?.login_background;
        if (bg?.image_url) setImageUrl(bg.image_url);
        if (bg?.overlay != null) setOverlay(Number(bg.overlay));
      })
      .catch(() => {});
  }, []);

  async function save(next) {
    setSaving(true);
    setMsg("");
    try {
      await updateSettings({ login_background: next });
      loadLoginBackground({ refresh: true });   // login pages pick it up straight away
      setMsg(next ? "Login background saved." : "Login background removed.");
    } catch (err) {
      const m = err.message ?? "";
      setMsg(m.includes("login_background")
        ? "Run supabase/037_login_background_and_production_rates.sql in Supabase first."
        : (m || "Could not save login background."));
    } finally {
      setSaving(false);
    }
  }

  async function handleFile(file) {
    if (!file) return;
    setUploading(true);
    setMsg("");
    try {
      const url = await uploadLoginBackground(file);
      setImageUrl(url);
      await save({ image_url: url, overlay });
    } catch (err) {
      setMsg(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    if (!window.confirm("Remove the login background image?")) return;
    setImageUrl("");
    await save(null);
  }

  const ok = msg.includes("saved") || msg.includes("removed");

  return (
    <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
      <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Login background</h2>
      <p className="mt-1 text-sm text-gray-600">
        Shown behind every sign-in and sign-up page: staff lobbies and customers. Leave empty for the default dark background.
      </p>

      {msg && (
        <div role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${ok ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {msg}
        </div>
      )}

      <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Live preview: image + overlay + a mock sign-in card */}
        <div className="relative aspect-video overflow-hidden rounded-lg border border-gray-200"
          style={{ background: "linear-gradient(135deg, #1C1C1E 0%, #111113 60%, #1a1020 100%)" }}>
          {imageUrl && <img src={imageUrl} alt="Login background preview" className="absolute inset-0 h-full w-full object-cover" />}
          {imageUrl && <div className="absolute inset-0" style={{ background: `rgba(17,17,19,${overlay})` }} />}
          <div className="absolute left-1/2 top-1/2 w-2/5 -translate-x-1/2 -translate-y-1/2 rounded-md bg-white p-2 shadow-lg">
            <div className="h-1.5 w-1/2 rounded bg-gray-300" />
            <div className="mt-2 h-2.5 rounded border border-gray-200" />
            <div className="mt-1 h-2.5 rounded border border-gray-200" />
            <div className="mt-2 h-2.5 rounded bg-[#6366F1]" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <label className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-brand-red hover:text-brand-red transition-colors">
              {uploading ? "Uploading…" : imageUrl ? "Replace image" : "Upload image"}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={(e) => handleFile(e.target.files?.[0])} />
            </label>
            {imageUrl && (
              <button type="button" onClick={handleRemove} disabled={saving}
                className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
                Remove
              </button>
            )}
          </div>

          <div>
            <label htmlFor="login-overlay" className="block text-xs font-medium text-gray-600 mb-1.5">
              Darkening overlay: {Math.round(overlay * 100)}%
            </label>
            <input id="login-overlay" type="range" min="0" max="0.9" step="0.05"
              value={overlay} disabled={!imageUrl}
              onChange={(e) => setOverlay(Number(e.target.value))}
              className="w-full accent-brand-red disabled:opacity-50" />
            <p className="mt-1 text-xs text-gray-500">Higher keeps the sign-in form easy to read on busy photos.</p>
          </div>

          <button type="button" onClick={() => save({ image_url: imageUrl, overlay })}
            disabled={!imageUrl || saving}
            className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
            {saving ? "Saving…" : "Save overlay"}
          </button>
          <p className="text-xs text-gray-500">Tip: use a wide landscape photo, at least 1920 px across.</p>
        </div>
      </div>
    </div>
  );
}
