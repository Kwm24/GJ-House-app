/**
 * CustomerProfile.jsx
 *   CustomerProfile   the customer's Profile page (header button next to the
 *                     notification bell): contact details staff use to reach
 *                     them, delivery locations, sign-in & security.
 *   ProfilePrompts    nudges on My Jobs when the WhatsApp number or a
 *                     delivery location is missing; each opens the Profile.
 */
import { useEffect, useState } from "react";
import {
  ArrowLeft, Check, Loader2, MapPin, Phone, Mail, ShieldCheck,
  KeyRound, LogOut, UserRound, Building2,
} from "lucide-react";
import { useAuth } from "../AuthProvider.jsx";
import { WhatsAppIcon } from "../ui/whatsapp-icon.jsx";
import {
  getMyProfile, updateMyProfile, signInMethods, changeSignInEmail, setPassword, signOutEverywhere,
} from "../../lib/customerProfile.js";
import { listMyLocations } from "../../lib/deliveryLocations.js";
import { MyDeliveryLocations } from "../delivery/DeliveryLocations.jsx";

const inp =
  "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 text-sm text-[var(--t-text1)] " +
  "placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-colors disabled:opacity-60";
const lbl  = "block text-xs font-medium text-[var(--t-text2)] mb-1.5";
const card = "rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4 sm:p-5";

function SectionTitle({ icon: Icon, title, sub }) {
  return (
    <div className="mb-4 flex items-start gap-3">
      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-red/10 text-brand-red">
        <Icon size={16} aria-hidden="true" />
      </span>
      <div>
        <h3 className="text-sm font-semibold text-[var(--t-text1)]">{title}</h3>
        {sub && <p className="mt-0.5 text-xs text-[var(--t-muted)]">{sub}</p>}
      </div>
    </div>
  );
}

function Notice({ msg }) {
  if (!msg) return null;
  const ok = msg.ok;
  return (
    <p role={ok ? "status" : "alert"}
      className={`rounded-lg border px-3 py-2.5 text-xs ${ok
        ? "border-green-200 bg-green-50 text-green-800 dark:border-green-500/30 dark:bg-green-900/20 dark:text-green-300"
        : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300"}`}>
      {msg.text}
    </p>
  );
}

const PREFS = [
  { value: "whatsapp", label: "WhatsApp", Icon: WhatsAppIcon },
  { value: "phone",    label: "Phone call", Icon: Phone },
  { value: "email",    label: "Email", Icon: Mail },
];

// ═════════════════════════════════════════════════════════════════════════════
export function CustomerProfile({ onBack, accent = "#C0392B", whatsappNumber = "", focus = null }) {
  const { user, refreshProfile } = useAuth();
  const methods  = signInMethods(user);
  const isGoogle = methods.includes("google");
  const hasEmailLogin = methods.includes("email");

  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState("");
  const [created, setCreated] = useState(null);

  // Contact details
  const [fullName, setFullName] = useState("");
  const [company,  setCompany]  = useState("");
  const [phone,    setPhone]    = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [waSame,   setWaSame]   = useState(true);
  const [contactEmail, setContactEmail] = useState("");
  const [preferred, setPreferred] = useState("whatsapp");
  const [saving,   setSaving]   = useState(false);
  const [saveMsg,  setSaveMsg]  = useState(null);

  // Security
  const [newEmail, setNewEmail] = useState("");
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailMsg, setEmailMsg] = useState(null);
  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [pwBusy, setPwBusy] = useState(false);
  const [pwMsg, setPwMsg] = useState(null);
  const [outBusy, setOutBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((p) => {
        if (cancelled || !p) return;
        setFullName(p.full_name || "");
        setCompany(p.company_name || "");
        setPhone(p.phone || "");
        setWhatsapp(p.whatsapp || "");
        setWaSame(!p.whatsapp || p.whatsapp === p.phone);
        setContactEmail(p.contact_email || "");
        setPreferred(p.preferred_contact || "whatsapp");
        setCreated(p.created_at || user?.created_at || null);
      })
      .catch((e) => { if (!cancelled) setLoadErr(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [user]);

  // Jump to the section the customer came for (e.g. "Add location")
  useEffect(() => {
    if (loading || !focus) return;
    const el = document.getElementById(`profile-${focus}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [loading, focus]);

  async function handleSave(e) {
    e.preventDefault();
    setSaveMsg(null);
    if (!fullName.trim()) { setSaveMsg({ ok: false, text: "Please enter your name." }); return; }
    const wa = waSame ? phone : whatsapp;
    if (preferred === "whatsapp" && !wa.trim()) { setSaveMsg({ ok: false, text: "Add a WhatsApp number, or choose another way for us to contact you." }); return; }
    if (preferred === "phone" && !phone.trim()) { setSaveMsg({ ok: false, text: "Add a phone number, or choose another way for us to contact you." }); return; }
    if (preferred === "email" && !contactEmail.trim() && !user?.email) { setSaveMsg({ ok: false, text: "Add an email address, or choose another way for us to contact you." }); return; }
    setSaving(true);
    try {
      await updateMyProfile({
        fullName, phone, companyName: company, preferredContact: preferred,
        whatsapp: waSame ? "" : whatsapp,          // empty = same as phone
        contactEmail: contactEmail.trim() && contactEmail.trim().toLowerCase() !== (user?.email || "").toLowerCase() ? contactEmail : "",
      });
      await refreshProfile?.();
      setSaveMsg({ ok: true, text: "Your details are saved." });
    } catch (err) {
      setSaveMsg({ ok: false, text: err.message ?? "Could not save your details." });
    } finally {
      setSaving(false);
    }
  }

  async function handleEmailChange(e) {
    e.preventDefault();
    setEmailMsg(null);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail.trim())) { setEmailMsg({ ok: false, text: "Enter a valid email address." }); return; }
    setEmailBusy(true);
    try {
      await changeSignInEmail(newEmail);
      setEmailMsg({ ok: true, text: `We sent a confirmation link to ${newEmail.trim()}. Your sign-in email changes once you click it.` });
      setNewEmail("");
    } catch (err) { setEmailMsg({ ok: false, text: err.message ?? "Could not change your email." }); }
    finally { setEmailBusy(false); }
  }

  async function handlePassword(e) {
    e.preventDefault();
    setPwMsg(null);
    if (pw1.length < 8) { setPwMsg({ ok: false, text: "Use at least 8 characters." }); return; }
    if (pw1 !== pw2)    { setPwMsg({ ok: false, text: "The two passwords don't match." }); return; }
    setPwBusy(true);
    try {
      await setPassword(pw1);
      setPw1(""); setPw2("");
      setPwMsg({ ok: true, text: hasEmailLogin ? "Password changed." : "Password added. You can now also sign in with your email and this password." });
    } catch (err) { setPwMsg({ ok: false, text: err.message ?? "Could not update your password." }); }
    finally { setPwBusy(false); }
  }

  async function handleSignOutEverywhere() {
    if (!window.confirm("Sign out on every phone and computer, including this one?")) return;
    setOutBusy(true);
    try { await signOutEverywhere(); window.location.assign("/login"); }
    catch { setOutBusy(false); }
  }

  const initials = (fullName || user?.email || "?").trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const waDigits = String(whatsappNumber || "").replace(/\D/g, "");

  return (
    <div className="space-y-5">
      <button type="button" onClick={onBack}
        className="flex items-center gap-1.5 text-xs font-semibold text-brand-red hover:underline">
        <ArrowLeft size={13} aria-hidden="true" /> Back
      </button>

      {/* ── Who you are ── */}
      <div className={`${card} flex items-center gap-4`}>
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-lg font-bold text-white" style={{ background: accent }}>
          {initials}
        </span>
        <div className="min-w-0">
          <h2 className="truncate text-base font-bold text-[var(--t-text1)]">{fullName || "Your profile"}</h2>
          <p className="truncate text-xs text-[var(--t-muted)]">{user?.email}</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {isGoogle && <span className="rounded-full border border-[var(--t-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--t-text2)]">Google sign-in</span>}
            {hasEmailLogin && <span className="rounded-full border border-[var(--t-border)] px-2 py-0.5 text-[10px] font-medium text-[var(--t-text2)]">Email &amp; password</span>}
            {created && <span className="text-[10px] text-[var(--t-muted)]">Customer since {new Date(created).toLocaleDateString("en-GH", { month: "short", year: "numeric" })}</span>}
          </div>
        </div>
      </div>

      {loadErr && <Notice msg={{ ok: false, text: loadErr }} />}

      {/* ── Contact details ── */}
      <form id="profile-contact" onSubmit={handleSave} className={`${card} scroll-mt-24 space-y-4`}>
        <SectionTitle icon={UserRound} title="Your details"
          sub="We use these to send your quotes, designs and order updates, so please keep them current." />

        {loading ? (
          <div className="h-40 animate-pulse rounded-lg bg-[var(--t-bg)]" />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={lbl} htmlFor="pf-name">Full name</label>
                <input id="pf-name" className={inp} value={fullName} maxLength={120} autoComplete="name"
                  onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div>
                <label className={lbl} htmlFor="pf-company"><Building2 size={11} className="mr-1 inline" aria-hidden="true" />Business / organisation (optional)</label>
                <input id="pf-company" className={inp} value={company} maxLength={120} autoComplete="organization"
                  onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Asante Ventures" />
              </div>
              <div>
                <label className={lbl} htmlFor="pf-phone">Phone number</label>
                <input id="pf-phone" type="tel" className={inp} value={phone} maxLength={30} autoComplete="tel"
                  onChange={(e) => setPhone(e.target.value)} placeholder="024 123 4567" />
              </div>
              <div>
                <label className={lbl} htmlFor="pf-wa">WhatsApp number</label>
                <input id="pf-wa" type="tel" className={inp} value={waSame ? phone : whatsapp} maxLength={30}
                  disabled={waSame} onChange={(e) => setWhatsapp(e.target.value)} placeholder="024 123 4567" />
                <label className="mt-1.5 flex items-center gap-2 text-xs text-[var(--t-text2)]">
                  <input type="checkbox" checked={waSame} onChange={(e) => { setWaSame(e.target.checked); if (!e.target.checked && !whatsapp) setWhatsapp(phone); }}
                    className="h-4 w-4 rounded border-[var(--t-border)]" />
                  Same as my phone number
                </label>
              </div>
              <div className="sm:col-span-2">
                <label className={lbl} htmlFor="pf-email">
                  {isGoogle ? "Contact email (optional)" : "Contact email (optional, if different from your sign-in email)"}
                </label>
                <input id="pf-email" type="email" className={inp} value={contactEmail} maxLength={200} autoComplete="email"
                  onChange={(e) => setContactEmail(e.target.value)} placeholder={user?.email || "you@example.com"} />
                <p className="mt-1 text-[11px] text-[var(--t-muted)]">
                  Leave empty to use {user?.email ? <b>{user.email}</b> : "your sign-in email"}.
                  {isGoogle && " Your Google sign-in email itself can only be changed in your Google account."}
                </p>
              </div>
            </div>

            <div>
              <p className={lbl}>How should we contact you?</p>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Preferred contact method">
                {PREFS.map(({ value, label, Icon }) => {
                  const on = preferred === value;
                  return (
                    <button key={value} type="button" role="radio" aria-checked={on} onClick={() => setPreferred(value)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-all ${on ? "border-transparent text-white" : "border-[var(--t-border)] bg-[var(--t-bg)] text-[var(--t-text2)]"}`}
                      style={on ? { background: accent } : {}}>
                      <Icon size={13} aria-hidden="true" /> {label}
                    </button>
                  );
                })}
              </div>
            </div>

            <Notice msg={saveMsg} />
            <div className="flex justify-end">
              <button type="submit" disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                style={{ background: accent }}>
                {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
                {saving ? "Saving…" : "Save details"}
              </button>
            </div>
          </>
        )}
      </form>

      {/* ── Delivery ── */}
      <section id="profile-delivery" className={`${card} scroll-mt-24`}>
        <SectionTitle icon={MapPin} title="Delivery locations"
          sub="Where should we deliver your orders? Your pin is shared with our delivery rider (Bolt, Uber, Yango…)." />
        <MyDeliveryLocations accent={accent} defaultPhone={(waSame ? phone : whatsapp) || phone} />
      </section>

      {/* ── Sign-in & security ── */}
      <section id="profile-security" className={`${card} scroll-mt-24 space-y-5`}>
        <SectionTitle icon={ShieldCheck} title="Sign-in & security" />

        {hasEmailLogin && (
          <form onSubmit={handleEmailChange} className="space-y-2">
            <label className={lbl} htmlFor="pf-newemail">Change sign-in email</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input id="pf-newemail" type="email" className={inp} value={newEmail} onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com" autoComplete="email" />
              <button type="submit" disabled={emailBusy || !newEmail.trim()}
                className="shrink-0 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-4 py-2.5 text-sm font-medium text-[var(--t-text1)] hover:border-[var(--t-text2)] disabled:opacity-50">
                {emailBusy ? "Sending…" : "Change email"}
              </button>
            </div>
            <Notice msg={emailMsg} />
          </form>
        )}

        <form onSubmit={handlePassword} className="space-y-2">
          <p className={lbl + " !mb-0 flex items-center gap-1.5"}><KeyRound size={12} aria-hidden="true" />{hasEmailLogin ? "Change password" : "Add a password"}</p>
          {!hasEmailLogin && (
            <p className="text-[11px] text-[var(--t-muted)]">You sign in with Google. Add a password if you&apos;d also like to sign in with your email ({user?.email}).</p>
          )}
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input type="password" className={inp} value={pw1} onChange={(e) => setPw1(e.target.value)}
              placeholder="New password (8+ characters)" autoComplete="new-password" aria-label="New password" />
            <input type="password" className={inp} value={pw2} onChange={(e) => setPw2(e.target.value)}
              placeholder="Type it again" autoComplete="new-password" aria-label="Confirm new password" />
          </div>
          <Notice msg={pwMsg} />
          <div className="flex justify-end">
            <button type="submit" disabled={pwBusy || !pw1}
              className="rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-4 py-2.5 text-sm font-medium text-[var(--t-text1)] hover:border-[var(--t-text2)] disabled:opacity-50">
              {pwBusy ? "Saving…" : hasEmailLogin ? "Change password" : "Add password"}
            </button>
          </div>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--t-border)] pt-4">
          <p className="text-xs text-[var(--t-muted)]">Lost a phone or used a shared computer?</p>
          <button type="button" onClick={handleSignOutEverywhere} disabled={outBusy}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--t-border)] px-3 py-2 text-xs font-medium text-[var(--t-text2)] hover:border-red-300 hover:text-red-600 disabled:opacity-50">
            <LogOut size={13} aria-hidden="true" /> {outBusy ? "Signing out…" : "Sign out everywhere"}
          </button>
        </div>
      </section>

      <p className="text-center text-[11px] text-[var(--t-muted)]">
        Want to close your account or download your data?{" "}
        {waDigits
          ? <a href={`https://wa.me/${waDigits}?text=${encodeURIComponent("Hi, I'd like help with my customer account.")}`} target="_blank" rel="noreferrer" className="font-medium underline underline-offset-2">Message us on WhatsApp</a>
          : "Contact us"}.
      </p>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Nudges on My Jobs: missing WhatsApp / phone, missing delivery location
// ═════════════════════════════════════════════════════════════════════════════
export function ProfilePrompts({ onOpenProfile, accent = "#C0392B" }) {
  const [missingContact,  setMissingContact]  = useState(false);
  const [missingLocation, setMissingLocation] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((p) => { if (!cancelled && p) setMissingContact(!p.phone && !p.whatsapp); })
      .catch(() => {});
    listMyLocations()
      .then((l) => { if (!cancelled) setMissingLocation(l.length === 0); })
      .catch(() => {});   // table not set up yet: say nothing
    return () => { cancelled = true; };
  }, []);

  const banner = (Icon, text, action, focus) => (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
      style={{ borderColor: `${accent}40`, background: `${accent}0D` }}>
      <Icon size={18} style={{ color: accent }} className="shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-xs text-[var(--t-text2)]">{text}</p>
      <button type="button" onClick={() => onOpenProfile(focus)}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90" style={{ background: accent }}>
        {action}
      </button>
    </div>
  );

  if (!missingContact && !missingLocation) return null;
  return (
    <div className="mb-4 space-y-2">
      {missingContact && banner(WhatsAppIcon,
        <><b className="text-[var(--t-text1)]">Add your WhatsApp number</b> so we can send your designs and order updates to you.</>,
        "Add number", "contact")}
      {missingLocation && banner(MapPin,
        <><b className="text-[var(--t-text1)]">Want your orders delivered?</b> Add your delivery location so our rider can find you.</>,
        "Add location", "delivery")}
    </div>
  );
}
