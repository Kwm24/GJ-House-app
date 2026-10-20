import { useState, useEffect, useCallback, useRef } from "react";
import { Image, Trash2, ExternalLink, Upload, Eye, EyeOff } from "lucide-react";
import { getSettings, updateSettings, uploadLandingImage, uploadServiceImage, uploadCompanyLogo, uploadFavicon, applyFavicon } from "../../lib/settings.js";

const DEFAULT_LANDING = {
  hero: {
    headline: "Premium Print Solutions for Ghanaian Businesses",
    subhead: "From digital prints to large-format banners — delivered fast, crafted with precision.",
  },
  stats: [
    { value: "500+", label: "Jobs Completed" },
    { value: "200+", label: "Happy Clients" },
    { value: "48hr", label: "Avg. Turnaround" },
    { value: "100%", label: "Quality Guarantee" },
  ],
  services: [
    { name: "Digital Printing",    description: "Sharp, vibrant prints for flyers, brochures, business cards and more.", image_url: "" },
    { name: "Offset Printing",     description: "High-volume, cost-effective printing with consistent colour accuracy.", image_url: "" },
    { name: "Labels & Stickers",   description: "Custom labels and stickers for products, packaging and branding.",     image_url: "" },
    { name: "Branded Merchandise", description: "T-shirts, bags, mugs and souvenirs with your logo and identity.",     image_url: "" },
  ],
  features: [
    {
      title: "Track Your Order Live",
      description: "Log in to your personal portal and watch your job move through every stage — design, production, finishing and dispatch — in real time. No calls needed, no guessing.",
    },
    {
      title: "Approve Artwork Online",
      description: "We upload your proof design straight to your portal. Review it, leave a note, or approve it with one tap — whenever it's convenient for you, from any device.",
    },
    {
      title: "WhatsApp-First Communication",
      description: "Have a quick question or need an update? Reach us on WhatsApp for quotes, changes and confirmations. Fast replies on a channel you already use every day.",
    },
    {
      title: "Door-to-Door Delivery",
      description: "Your finished prints come to you. We deliver to offices, homes and businesses across Accra and beyond. Skip the trip — your order arrives when and where you need it.",
    },
  ],
  steps: [
    { number: "01", title: "Get a Quote",     description: "Sign up and submit your job details. We'll review and send you a quote within the hour." },
    { number: "02", title: "Pay Deposit",     description: "Approve your quote and pay a 60% deposit to get your order started."                      },
    { number: "03", title: "Review Design",   description: "Our team creates your artwork. Review and approve before we go to print."                 },
    { number: "04", title: "Collect & Enjoy", description: "Your finished prints are ready. Pick up or we deliver straight to you."                  },
  ],
  cta: {
    headline: "Ready to bring your brand to life?",
    subhead: "Create your account in 2 minutes and get your first quote today.",
  },
  contact: { address: "Accra, Ghana", phone: "", email: "" },
  global_styles: {
    text_color:     "#0A0A0A",
    text_secondary: "#6B6B6B",
    accent_color:   "#6366F1",
    button_color:   "",
    nav_bg:         "#FFFFFF",
    nav_text:       "#0A0A0A",
  },
  section_styles: {
    hero:     { bg_color: "#FFFFFF", bg_image_url: "", bg_overlay: 0.5, hidden: false, text_color: "", text_secondary: "" },
    stats:    { bg_color: "#FFFFFF", bg_image_url: "",                  hidden: false, text_color: "", text_secondary: "" },
    services: { bg_color: "#FAFAFA", bg_image_url: "", bg_overlay: 0.5, hidden: false, text_color: "", text_secondary: "" },
    features: { bg_color: "#FFFFFF", bg_image_url: "", bg_overlay: 0.5, hidden: false, text_color: "", text_secondary: "" },
    steps:    { bg_color: "#FAFAFA", bg_image_url: "", bg_overlay: 0.5, hidden: false, text_color: "", text_secondary: "" },
    cta:      { bg_color: "#F4F4FF", bg_image_url: "", bg_overlay: 0.4, hidden: false, text_color: "", text_secondary: "" },
    footer:   { bg_color: "#FFFFFF", bg_image_url: "",                  hidden: false, text_color: "", text_secondary: "" },
  },
};

// ── Text field ────────────────────────────────────────────────────────────────
function Field({ label, value, onChange, multiline }) {
  const cls = "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors";
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--t-muted)] mb-1.5">{label}</label>
      {multiline
        ? <textarea rows={2} value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
        : <input type="text" value={value} onChange={(e) => onChange(e.target.value)} className={cls} />
      }
    </div>
  );
}

// ── Colour picker row ─────────────────────────────────────────────────────────
function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-[var(--t-muted)] mb-1.5">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="w-9 h-9 rounded-lg border border-[var(--t-border)] cursor-pointer p-0.5 bg-transparent shrink-0"
        />
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#000000"
          className="flex-1 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-sm text-[var(--t-text1)] font-mono focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors"
        />
      </div>
    </div>
  );
}

// ── Section background + image editor ────────────────────────────────────────
function SectionBgEditor({ sectionKey, label, style, onChange, hasOverlay = true }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await uploadLandingImage(sectionKey, file);
      onChange({ ...style, bg_image_url: url });
    } catch (err) {
      setUploadError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  const hasImage = Boolean(style.bg_image_url);

  return (
    <div className="mt-4 pt-4 border-t border-[var(--t-border)]">
      <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--t-muted)] mb-3">
        {label} Section Style
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <ColorField
          label="Background colour"
          value={style.bg_color}
          onChange={(v) => onChange({ ...style, bg_color: v })}
        />

        {hasOverlay && (
          <div>
            <label className="block text-xs font-medium text-[var(--t-muted)] mb-1.5">
              Colour overlay on image{" "}
              <span className="text-[#9C9C9C] font-normal">({Math.round((style.bg_overlay ?? 0) * 100)}%)</span>
            </label>
            <input
              type="range" min={0} max={1} step={0.05}
              value={style.bg_overlay ?? 0}
              onChange={(e) => onChange({ ...style, bg_overlay: parseFloat(e.target.value) })}
              disabled={!hasImage}
              className="w-full accent-[#6366F1] disabled:opacity-30"
            />
            <p className="text-[10px] text-[var(--t-muted)] mt-0.5">
              {hasImage ? "Blends colour over image for readability." : "Upload an image to enable overlay."}
            </p>
          </div>
        )}
      </div>

      {/* Per-section text colour overrides */}
      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[var(--t-muted)]">Primary text colour</label>
            {style.text_color && (
              <button type="button" onClick={() => onChange({ ...style, text_color: "" })} className="text-[10px] text-[var(--t-muted)] hover:text-red-500 transition-colors">
                Reset to global
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.text_color || "#0A0A0A"}
              onChange={(e) => onChange({ ...style, text_color: e.target.value })}
              className="w-9 h-9 rounded-lg border border-[var(--t-border)] cursor-pointer p-0.5 bg-transparent shrink-0"
            />
            <input
              type="text"
              value={style.text_color || ""}
              onChange={(e) => onChange({ ...style, text_color: e.target.value })}
              placeholder="Global default"
              className="flex-1 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-sm text-[var(--t-text1)] font-mono focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors placeholder:text-[var(--t-muted)]"
            />
          </div>
        </div>
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-[var(--t-muted)]">Secondary text colour</label>
            {style.text_secondary && (
              <button type="button" onClick={() => onChange({ ...style, text_secondary: "" })} className="text-[10px] text-[var(--t-muted)] hover:text-red-500 transition-colors">
                Reset to global
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={style.text_secondary || "#6B6B6B"}
              onChange={(e) => onChange({ ...style, text_secondary: e.target.value })}
              className="w-9 h-9 rounded-lg border border-[var(--t-border)] cursor-pointer p-0.5 bg-transparent shrink-0"
            />
            <input
              type="text"
              value={style.text_secondary || ""}
              onChange={(e) => onChange({ ...style, text_secondary: e.target.value })}
              placeholder="Global default"
              className="flex-1 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-sm text-[var(--t-text1)] font-mono focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors placeholder:text-[var(--t-muted)]"
            />
          </div>
        </div>
      </div>

      <div className="mt-3">
        <label className="block text-xs font-medium text-[var(--t-muted)] mb-1.5">Background image</label>
        {hasImage ? (
          <div className="relative rounded-xl overflow-hidden border border-[var(--t-border)]">
            <img src={style.bg_image_url} alt="Preview" className="w-full h-28 object-cover" />
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/40 opacity-0 hover:opacity-100 transition-opacity">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#0A0A0A] hover:bg-gray-100 transition-colors">
                <Upload size={12} /> Replace
              </button>
              <button type="button" onClick={() => onChange({ ...style, bg_image_url: "" })} className="flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 transition-colors">
                <Trash2 size={12} /> Remove
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-[var(--t-border)] bg-[var(--t-bg)] py-6 text-[var(--t-muted)] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors disabled:opacity-50">
            {uploading ? (
              <>
                <div className="w-5 h-5 rounded-full border-2 border-[#6366F1]/30 border-t-[#6366F1] animate-spin" />
                <span className="text-xs">Uploading…</span>
              </>
            ) : (
              <>
                <Image size={20} />
                <span className="text-xs font-medium">Click to upload background image</span>
                <span className="text-[10px]">PNG, JPG, WEBP · recommended 1920×600px</span>
              </>
            )}
          </button>
        )}
        {uploadError && <p className="mt-1.5 text-xs text-red-600">{uploadError}</p>}
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
      </div>
    </div>
  );
}

// ── Service image uploader ────────────────────────────────────────────────────
function ServiceImageUploader({ index, imageUrl, onChange }) {
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError("");
    try {
      const url = await uploadServiceImage(index, file);
      onChange(url);
    } catch (err) {
      setUploadError(err.message ?? "Upload failed.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="mt-2">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium text-[var(--t-muted)]">Card image</label>
        {imageUrl && (
          <button type="button" onClick={() => onChange("")} className="text-[10px] text-red-500 hover:text-red-700 transition-colors flex items-center gap-1">
            <Trash2 size={10} /> Remove
          </button>
        )}
      </div>

      {imageUrl ? (
        <div className="relative rounded-lg overflow-hidden border border-[var(--t-border)]">
          <img src={imageUrl} alt="Service card preview" className="w-full h-20 object-cover" />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 hover:opacity-100 transition-opacity text-white text-xs font-semibold gap-1"
          >
            <Upload size={12} /> Replace
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full flex items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--t-border)] bg-[var(--t-bg)] py-3 text-xs text-[var(--t-muted)] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <><div className="w-3.5 h-3.5 rounded-full border-2 border-[#6366F1]/30 border-t-[#6366F1] animate-spin" /> Uploading…</>
          ) : (
            <><Image size={14} /> Add card image (optional)</>
          )}
        </button>
      )}

      {uploadError && <p className="mt-1 text-[10px] text-red-600">{uploadError}</p>}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />
    </div>
  );
}

// ── Section card with visibility toggle ──────────────────────────────────────
function SectionCard({ title, hidden, onToggleHidden, children }) {
  return (
    <div className={`rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] overflow-hidden transition-opacity ${hidden ? "opacity-60" : ""}`}>
      <div className="px-6 py-4 border-b border-[var(--t-border)] flex items-center justify-between gap-3">
        <h3 className="font-semibold text-[var(--t-text1)] text-sm">{title}</h3>
        {onToggleHidden && (
          <button
            type="button"
            onClick={onToggleHidden}
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
              hidden
                ? "bg-gray-100 dark:bg-white/10 text-[var(--t-muted)] hover:bg-gray-200"
                : "bg-green-50 text-green-700 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-400"
            }`}
            title={hidden ? "Click to show section" : "Click to hide section"}
          >
            {hidden ? <EyeOff size={11} /> : <Eye size={11} />}
            {hidden ? "Hidden" : "Visible"}
          </button>
        )}
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export function LandingPageTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [error, setError]     = useState("");

  // Site identity (stored as top-level settings fields, not inside landing_page JSON)
  const [logoUrl,          setLogoUrl]          = useState("");
  const [faviconUrl,       setFaviconUrl]        = useState("");
  const [uploadingLogo,    setUploadingLogo]     = useState(false);
  const [uploadingFavicon, setUploadingFavicon]  = useState(false);
  const [identityMsg,      setIdentityMsg]       = useState("");
  const logoFileRef    = useRef(null);
  const faviconFileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const settings = await getSettings();
      if (settings?.company_logo_url) setLogoUrl(settings.company_logo_url);
      if (settings?.favicon_url) { setFaviconUrl(settings.favicon_url); applyFavicon(settings.favicon_url); }
      const lp = settings?.landing_page;
      if (lp) {
        setData({
          hero:     { ...DEFAULT_LANDING.hero,     ...lp.hero     },
          stats:    lp.stats    ?? DEFAULT_LANDING.stats,
          services: lp.services ?? DEFAULT_LANDING.services,
          features: (lp.features && lp.features.some(f => f.title === "Fast Turnaround"))
            ? DEFAULT_LANDING.features
            : (lp.features ?? DEFAULT_LANDING.features),
          steps:    lp.steps    ?? DEFAULT_LANDING.steps,
          cta:      { ...DEFAULT_LANDING.cta,      ...lp.cta      },
          contact:  { ...DEFAULT_LANDING.contact,  ...lp.contact  },
          global_styles: { ...DEFAULT_LANDING.global_styles, ...(typeof lp.global_styles === "object" && !Array.isArray(lp.global_styles) ? lp.global_styles : {}) },
          section_styles: Object.fromEntries(
            Object.entries(DEFAULT_LANDING.section_styles).map(([k, def]) => [
              k, { ...def, ...(lp.section_styles?.[k] ?? {}) },
            ])
          ),
        });
      } else {
        setData(structuredClone(DEFAULT_LANDING));
      }
    } catch (err) {
      setError(err.message ?? "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleSave() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      await updateSettings({ landing_page: data });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err.message ?? "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  // Updaters
  const setHero         = (f, v) => setData((d) => ({ ...d, hero:     { ...d.hero,     [f]: v } }));
  const setCta          = (f, v) => setData((d) => ({ ...d, cta:      { ...d.cta,      [f]: v } }));
  const setContact      = (f, v) => setData((d) => ({ ...d, contact:  { ...d.contact,  [f]: v } }));
  const setGlobal       = (f, v) => setData((d) => ({ ...d, global_styles: { ...d.global_styles, [f]: v } }));
  const setStat         = (i, f, v) => setData((d) => ({ ...d, stats:    d.stats.map((s, idx)    => idx === i ? { ...s, [f]: v } : s) }));
  const setService      = (i, f, v) => setData((d) => ({ ...d, services: d.services.map((s, idx) => idx === i ? { ...s, [f]: v } : s) }));
  const setFeature      = (i, f, v) => setData((d) => ({ ...d, features: d.features.map((x, idx) => idx === i ? { ...x, [f]: v } : x) }));
  const setStep         = (i, f, v) => setData((d) => ({ ...d, steps:    d.steps.map((s, idx)    => idx === i ? { ...s, [f]: v } : s) }));
  const setSectionStyle = (key, val) => setData((d) => ({ ...d, section_styles: { ...d.section_styles, [key]: val } }));
  const toggleHidden    = (key) => setSectionStyle(key, { ...data.section_styles[key], hidden: !data.section_styles[key].hidden });

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingLogo(true);
    setIdentityMsg("");
    try {
      const url = await uploadCompanyLogo(file);
      setLogoUrl(url);
      setIdentityMsg("Logo uploaded.");
    } catch (err) {
      setIdentityMsg(err.message ?? "Logo upload failed.");
    } finally {
      setUploadingLogo(false);
      if (logoFileRef.current) logoFileRef.current.value = "";
    }
  }

  async function handleFaviconUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingFavicon(true);
    setIdentityMsg("");
    try {
      const url = await uploadFavicon(file);
      setFaviconUrl(url);
      applyFavicon(url);
      setIdentityMsg("Favicon uploaded.");
    } catch (err) {
      setIdentityMsg(err.message ?? "Favicon upload failed.");
    } finally {
      setUploadingFavicon(false);
      if (faviconFileRef.current) faviconFileRef.current.value = "";
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-[#6366F1]/30 border-t-[#6366F1] animate-spin" />
      </div>
    );
  }

  if (!data) return null;

  const SaveButton = ({ className = "" }) => (
    <button type="button" onClick={handleSave} disabled={saving} className={`rounded-[6px] bg-[#6366F1] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#4F46E5] disabled:opacity-60 disabled:cursor-not-allowed transition-colors ${className}`}>
      {saving ? "Saving…" : saved ? "Saved ✓" : "Save Changes"}
    </button>
  );

  const gs = data.global_styles;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--t-text1)]">Landing Page</h2>
          <p className="text-sm text-[var(--t-muted)] mt-0.5">Manage content, colours and backgrounds for the public landing page.</p>
        </div>
        <div className="flex items-center gap-2">
          <a href="/" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-[6px] border border-[var(--t-border)] px-4 py-2 text-sm font-medium text-[var(--t-text2)] hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
            <ExternalLink size={13} /> Preview
          </a>
          <SaveButton />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {/* ── Site Identity ── */}
      <SectionCard title="Site Identity">
        <p className="text-xs text-[var(--t-muted)] mb-5">Logo and favicon shown across the landing page, footer and browser tab.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">

          {/* Logo */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--t-muted)] mb-3">Site Logo</p>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt="Site logo"
                className="mb-3 max-h-16 max-w-[200px] rounded border border-[var(--t-border)] bg-[var(--t-bg)] p-1.5 object-contain"
              />
            ) : (
              <div className="mb-3 flex h-16 w-[200px] items-center justify-center rounded border-2 border-dashed border-[var(--t-border)]">
                <span className="text-xs text-[var(--t-muted)]">No logo set</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => logoFileRef.current?.click()}
              disabled={uploadingLogo}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--t-border)] bg-[var(--t-bg)] px-4 py-2 text-xs font-medium text-[var(--t-text2)] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors disabled:opacity-50"
            >
              <Upload size={12} />
              {uploadingLogo ? "Uploading…" : logoUrl ? "Replace logo" : "Upload logo"}
            </button>
            <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            <p className="mt-1.5 text-[10px] text-[var(--t-muted)]">PNG or SVG recommended. Shown in the nav and footer.</p>
          </div>

          {/* Favicon */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--t-muted)] mb-3">Favicon</p>
            {faviconUrl ? (
              <img
                src={faviconUrl}
                alt="Favicon"
                className="mb-3 h-10 w-10 rounded border border-[var(--t-border)] bg-[var(--t-bg)] p-1 object-contain"
              />
            ) : (
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded border-2 border-dashed border-[var(--t-border)]">
                <span className="text-[8px] text-[var(--t-muted)]">–</span>
              </div>
            )}
            <button
              type="button"
              onClick={() => faviconFileRef.current?.click()}
              disabled={uploadingFavicon}
              className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--t-border)] bg-[var(--t-bg)] px-4 py-2 text-xs font-medium text-[var(--t-text2)] hover:border-[#6366F1] hover:text-[#6366F1] transition-colors disabled:opacity-50"
            >
              <Upload size={12} />
              {uploadingFavicon ? "Uploading…" : faviconUrl ? "Replace favicon" : "Upload favicon"}
            </button>
            <input ref={faviconFileRef} type="file" accept="image/png,image/x-icon,image/svg+xml,image/webp" className="hidden" onChange={handleFaviconUpload} />
            <p className="mt-1.5 text-[10px] text-[var(--t-muted)]">PNG or ICO, 32×32 px ideal. Browser tab icon.</p>
          </div>
        </div>

        {identityMsg && (
          <p className={`mt-4 text-xs font-medium ${identityMsg.includes("uploaded") || identityMsg.includes("Uploaded") ? "text-green-600" : "text-red-600"}`}>
            {identityMsg}
          </p>
        )}
      </SectionCard>

      {/* ── Global Styles ── */}
      <SectionCard title="Global Styles">
        <p className="text-xs text-[var(--t-muted)] mb-4">These colours apply across the entire landing page.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ColorField label="Primary text colour" value={gs.text_color} onChange={(v) => setGlobal("text_color", v)} />
          <ColorField label="Secondary text colour" value={gs.text_secondary} onChange={(v) => setGlobal("text_secondary", v)} />
          <ColorField label="Accent colour (icons, links)" value={gs.accent_color} onChange={(v) => setGlobal("accent_color", v)} />
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-[var(--t-muted)]">Button colour</label>
              {gs.button_color && (
                <button type="button" onClick={() => setGlobal("button_color", "")} className="text-[10px] text-[var(--t-muted)] hover:text-red-500 transition-colors">
                  Use accent colour
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={gs.button_color || gs.accent_color || "#6366F1"}
                onChange={(e) => setGlobal("button_color", e.target.value)}
                className="w-9 h-9 rounded-lg border border-[var(--t-border)] cursor-pointer p-0.5 bg-transparent shrink-0"
              />
              <input
                type="text"
                value={gs.button_color || ""}
                onChange={(e) => setGlobal("button_color", e.target.value)}
                placeholder="Same as accent"
                className="flex-1 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-sm text-[var(--t-text1)] font-mono focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors placeholder:text-[var(--t-muted)]"
              />
            </div>
          </div>
          <ColorField label="Nav background colour" value={gs.nav_bg} onChange={(v) => setGlobal("nav_bg", v)} />
          <ColorField label="Nav text colour" value={gs.nav_text} onChange={(v) => setGlobal("nav_text", v)} />
        </div>
        {/* Live preview swatch */}
        <div className="mt-5 rounded-xl border border-[var(--t-border)] overflow-hidden">
          <div className="px-4 py-2.5 flex items-center gap-3" style={{ backgroundColor: gs.nav_bg + "CC" }}>
            <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ backgroundColor: gs.accent_color }}>
              <span className="text-white text-[8px] font-bold">P</span>
            </div>
            <span className="text-xs font-semibold" style={{ color: gs.nav_text }}>Your Brand</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px]" style={{ color: gs.nav_text + "99" }}>Services</span>
              <span className="text-[10px] rounded px-2 py-0.5 text-white text-[10px] font-semibold" style={{ backgroundColor: gs.button_color || gs.accent_color }}>Get a Quote</span>
            </div>
          </div>
          <div className="px-4 py-4 bg-white">
            <p className="text-xs font-bold mb-1" style={{ color: gs.text_color }}>Page Heading</p>
            <p className="text-[10px]" style={{ color: gs.text_secondary }}>Body text and descriptions appear in this colour.</p>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-[10px] font-bold" style={{ color: gs.accent_color }}>01</span>
              <span className="text-[10px] underline" style={{ color: gs.accent_color }}>Accent link</span>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Hero ── */}
      <SectionCard title="Hero" hidden={data.section_styles.hero.hidden} onToggleHidden={() => toggleHidden("hero")}>
        <div className="space-y-3">
          <Field label="Headline" value={data.hero.headline} onChange={(v) => setHero("headline", v)} />
          <Field label="Subheading" value={data.hero.subhead} onChange={(v) => setHero("subhead", v)} multiline />
        </div>
        <SectionBgEditor sectionKey="hero" label="Hero" style={data.section_styles.hero} onChange={(v) => setSectionStyle("hero", v)} />
      </SectionCard>

      {/* ── Stats ── */}
      <SectionCard title="Stats Bar" hidden={data.section_styles.stats.hidden} onToggleHidden={() => toggleHidden("stats")}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {data.stats.map((stat, i) => (
            <div key={i} className="rounded-lg border border-[var(--t-border)] p-3 space-y-2">
              <Field label="Value" value={stat.value} onChange={(v) => setStat(i, "value", v)} />
              <Field label="Label" value={stat.label} onChange={(v) => setStat(i, "label", v)} />
            </div>
          ))}
        </div>
        <SectionBgEditor sectionKey="stats" label="Stats" style={data.section_styles.stats} onChange={(v) => setSectionStyle("stats", v)} hasOverlay={false} />
      </SectionCard>

      {/* ── Services ── */}
      <SectionCard title="Services" hidden={data.section_styles.services.hidden} onToggleHidden={() => toggleHidden("services")}>
        <div className="space-y-4">
          {data.services.map((svc, i) => (
            <div key={i} className="rounded-lg border border-[var(--t-border)] p-3 space-y-2">
              <Field label={`Service ${i + 1} Name`} value={svc.name} onChange={(v) => setService(i, "name", v)} />
              <Field label="Description" value={svc.description} onChange={(v) => setService(i, "description", v)} multiline />
              <ServiceImageUploader
                index={i}
                imageUrl={svc.image_url || ""}
                onChange={(url) => setService(i, "image_url", url)}
              />
            </div>
          ))}
        </div>
        <SectionBgEditor sectionKey="services" label="Services" style={data.section_styles.services} onChange={(v) => setSectionStyle("services", v)} />
      </SectionCard>

      {/* ── Why Us ── */}
      <SectionCard title="Why Choose Us" hidden={data.section_styles.features.hidden} onToggleHidden={() => toggleHidden("features")}>
        <div className="space-y-4">
          {data.features.map((feat, i) => (
            <div key={i} className="rounded-lg border border-[var(--t-border)] p-3 space-y-2">
              <Field label={`Feature ${i + 1} Title`} value={feat.title} onChange={(v) => setFeature(i, "title", v)} />
              <Field label="Description" value={feat.description} onChange={(v) => setFeature(i, "description", v)} multiline />
            </div>
          ))}
        </div>
        <SectionBgEditor sectionKey="features" label="Why Us" style={data.section_styles.features} onChange={(v) => setSectionStyle("features", v)} />
      </SectionCard>

      {/* ── How It Works ── */}
      <SectionCard title="How It Works" hidden={data.section_styles.steps.hidden} onToggleHidden={() => toggleHidden("steps")}>
        <div className="space-y-4">
          {data.steps.map((step, i) => (
            <div key={i} className="rounded-lg border border-[var(--t-border)] p-3 space-y-2">
              <Field label={`Step ${i + 1} Title`} value={step.title} onChange={(v) => setStep(i, "title", v)} />
              <Field label="Description" value={step.description} onChange={(v) => setStep(i, "description", v)} multiline />
            </div>
          ))}
        </div>
        <SectionBgEditor sectionKey="steps" label="How It Works" style={data.section_styles.steps} onChange={(v) => setSectionStyle("steps", v)} />
      </SectionCard>

      {/* ── CTA ── */}
      <SectionCard title="Call to Action Banner" hidden={data.section_styles.cta.hidden} onToggleHidden={() => toggleHidden("cta")}>
        <div className="space-y-3">
          <Field label="Headline" value={data.cta.headline} onChange={(v) => setCta("headline", v)} />
          <Field label="Subheading" value={data.cta.subhead} onChange={(v) => setCta("subhead", v)} multiline />
        </div>
        <SectionBgEditor sectionKey="cta" label="CTA" style={data.section_styles.cta} onChange={(v) => setSectionStyle("cta", v)} />
      </SectionCard>

      {/* ── Footer / Contact ── */}
      <SectionCard title="Footer & Contact" hidden={data.section_styles.footer.hidden} onToggleHidden={() => toggleHidden("footer")}>
        <div className="space-y-3">
          <Field label="Address" value={data.contact.address} onChange={(v) => setContact("address", v)} />
          <Field label="Phone number" value={data.contact.phone} onChange={(v) => setContact("phone", v)} />
          <Field label="Email address" value={data.contact.email} onChange={(v) => setContact("email", v)} />
        </div>
        <SectionBgEditor sectionKey="footer" label="Footer" style={data.section_styles.footer} onChange={(v) => setSectionStyle("footer", v)} hasOverlay={false} />
      </SectionCard>

      {/* Bottom save */}
      <div className="flex justify-end pb-4">
        <SaveButton />
      </div>
    </div>
  );
}
