/**
 * DeliveryLocations.jsx
 *   MyDeliveryLocations        customer portal: add / edit / remove saved
 *                              delivery locations, pick the default
 *   CustomerDeliveryLocations  staff (customer profile panel): view a
 *                              customer's locations and hand them to a rider
 *   DeliveryLocationPrompt     nudge shown to customers without a location
 *
 * Every location is a map pin saved as latitude / longitude (migration 039),
 * so it can go straight into Bolt / Uber / Yango or Google Maps.
 */
import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import {
  MapPin, Navigation, Plus, Pencil, Trash2, Star, Copy, Check, ExternalLink,
  LocateFixed, Search, Link2, Loader2, Share2,
} from "lucide-react";
import {
  listMyLocations, saveLocation, deleteLocation, setDefaultLocation,
  listCustomerLocations, googleMapsLink, googleDirectionsLink, riderMessage, coordsText,
  parseLocationInput, isShortMapsLink, searchPlaces, currentPosition,
} from "../../lib/deliveryLocations.js";

const LocationPickerMap = lazy(() => import("../LocationPickerMap.jsx"));

const LABELS = ["Home", "Office", "Shop"];

const inp =
  "w-full rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 text-sm text-[var(--t-text1)] " +
  "placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red transition-colors";
const lbl = "block text-xs font-medium text-[var(--t-text2)] mb-1.5";
const card = "rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)]";
const ghostBtn =
  "inline-flex items-center gap-1.5 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2 text-xs font-medium " +
  "text-[var(--t-text2)] hover:text-[var(--t-text1)] hover:border-[var(--t-text2)] transition-colors disabled:opacity-50";

function MapFallback({ height = 280 }) {
  return <div style={{ height }} className="w-full animate-pulse rounded-lg bg-[var(--t-bg)] border border-[var(--t-border)]" />;
}

function useCopy() {
  const [copied, setCopied] = useState("");
  const copy = useCallback(async (key, text) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(""), 1800); }
    catch { window.prompt("Copy this:", text); }
  }, []);
  return [copied, copy];
}

// ═════════════════════════════════════════════════════════════════════════════
// Customer: manage own locations
// ═════════════════════════════════════════════════════════════════════════════
export function MyDeliveryLocations({ accent = "#C0392B", defaultPhone = "" }) {
  const [locations, setLocations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [editing,   setEditing]   = useState(null);   // null | {} (new) | location
  const [busyId,    setBusyId]    = useState(null);

  const load = useCallback(async () => {
    setError("");
    try { setLocations(await listMyLocations()); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function handleDelete(loc) {
    if (!window.confirm(`Remove "${loc.label}"?`)) return;
    setBusyId(loc.id);
    try {
      await deleteLocation(loc.id);
      // Keep a default if there's anything left
      const rest = locations.filter((l) => l.id !== loc.id);
      if (loc.is_default && rest.length) await setDefaultLocation(rest[0].id);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  }

  async function handleDefault(loc) {
    setBusyId(loc.id);
    try { await setDefaultLocation(loc.id); await load(); }
    catch (e) { setError(e.message); }
    finally { setBusyId(null); }
  }

  if (editing) {
    return (
      <LocationEditor
        initial={editing}
        accent={accent}
        defaultPhone={defaultPhone}
        isFirst={!locations.length}
        onCancel={() => setEditing(null)}
        onSaved={async () => { setEditing(null); await load(); }}
      />
    );
  }

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>}

      {loading ? (
        <div className="h-28 animate-pulse rounded-xl bg-gray-200 dark:bg-white/10" />
      ) : locations.length === 0 ? (
        <div className={`${card} p-6 text-center`}>
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `${accent}1A`, color: accent }}>
            <MapPin size={22} aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-[var(--t-text1)]">No delivery location yet</p>
          <p className="mx-auto mt-1 max-w-sm text-xs text-[var(--t-muted)]">
            Drop a pin where you want your orders delivered. We send it to the rider (Bolt, Uber, Yango…) so they find you easily.
          </p>
          <button type="button" onClick={() => setEditing({})}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
            style={{ background: accent }}>
            <Plus size={16} aria-hidden="true" /> Add delivery location
          </button>
        </div>
      ) : (
        <>
          <ul className="space-y-3">
            {locations.map((loc) => (
              <li key={loc.id} className={`${card} p-4`}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: `${accent}1A`, color: accent }}>
                    <MapPin size={17} aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--t-text1)]">
                      {loc.label}
                      {loc.is_default && (
                        <span className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white" style={{ background: accent }}>Default</span>
                      )}
                    </p>
                    {loc.address && <p className="mt-0.5 text-xs text-[var(--t-text2)]">{loc.address}</p>}
                    {loc.landmark && <p className="mt-0.5 text-xs text-[var(--t-muted)]">{loc.landmark}</p>}
                    <p className="mt-1 text-[11px] text-[var(--t-muted)] tabular-nums">
                      {loc.gps_code ? `${loc.gps_code} · ` : ""}{coordsText(loc)}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={googleMapsLink(loc)} target="_blank" rel="noreferrer" className={ghostBtn}>
                    <ExternalLink size={13} aria-hidden="true" /> View on Google Maps
                  </a>
                  <button type="button" className={ghostBtn} onClick={() => setEditing(loc)} disabled={busyId === loc.id}>
                    <Pencil size={13} aria-hidden="true" /> Edit
                  </button>
                  {!loc.is_default && (
                    <button type="button" className={ghostBtn} onClick={() => handleDefault(loc)} disabled={busyId === loc.id}>
                      <Star size={13} aria-hidden="true" /> Make default
                    </button>
                  )}
                  <button type="button" className={`${ghostBtn} hover:!text-red-600 hover:!border-red-300`} onClick={() => handleDelete(loc)} disabled={busyId === loc.id}>
                    <Trash2 size={13} aria-hidden="true" /> Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {locations.length < 5 && (
            <button type="button" onClick={() => setEditing({})}
              className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90"
              style={{ background: accent }}>
              <Plus size={16} aria-hidden="true" /> Add another location
            </button>
          )}
          <p className="text-[11px] text-[var(--t-muted)]">We deliver to your <b>default</b> location unless you tell us otherwise.</p>
        </>
      )}
    </div>
  );
}

// ── Add / edit one location ────────────────────────────────────────────────
function LocationEditor({ initial, accent, defaultPhone, isFirst, onCancel, onSaved }) {
  const isNew = !initial.id;
  const [label,    setLabel]    = useState(initial.label || "Home");
  const [pin,      setPin]      = useState(initial.id ? { lat: initial.lat, lng: initial.lng } : null);
  const [center,   setCenter]   = useState(null);     // where the map should fly to
  const [address,  setAddress]  = useState(initial.address || "");
  const [landmark, setLandmark] = useState(initial.landmark || "");
  const [gpsCode,  setGpsCode]  = useState(initial.gps_code || "");
  const [phone,    setPhone]    = useState(initial.contact_phone || (isNew ? defaultPhone : "") || "");
  const [msg,      setMsg]      = useState("");
  const [locating, setLocating] = useState(false);
  const [accuracy, setAccuracy] = useState(null);
  const [saving,   setSaving]   = useState(false);

  const [query,    setQuery]    = useState("");
  const [results,  setResults]  = useState(null);
  const [searching, setSearching] = useState(false);

  const [pasted,   setPasted]   = useState("");

  function placePin(p) { setPin(p); setCenter(p); setMsg(""); }

  async function useMyLocation() {
    setLocating(true); setMsg("");
    try {
      const p = await currentPosition();
      placePin({ lat: p.lat, lng: p.lng });
      setAccuracy(Math.round(p.accuracy));
    } catch (e) { setMsg(e.message); }
    finally { setLocating(false); }
  }

  async function runSearch(e) {
    e.preventDefault();
    setSearching(true); setMsg(""); setResults(null);
    try {
      const list = await searchPlaces(query);
      setResults(list);
      if (list.length === 1) { placePin(list[0]); setResults(null); if (!address) setAddress(shortName(list[0].name)); }
    } catch (err) { setMsg(err.message); }
    finally { setSearching(false); }
  }

  function applyPasted(text) {
    setPasted(text);
    if (!text.trim()) return;
    const p = parseLocationInput(text);
    if (p) { placePin(p); setAccuracy(null); setMsg(""); return; }
    setMsg(isShortMapsLink(text)
      ? "Short Google Maps links (maps.app.goo.gl) can't be read here. Open the link, then copy the coordinates shown in Google Maps (e.g. 5.6037, -0.1870) and paste them instead."
      : "Couldn't find a location in that. Paste a Google Maps link or coordinates like 5.6037, -0.1870.");
  }

  async function handleSave() {
    if (!pin) { setMsg("Drop the pin on your delivery spot first."); return; }
    setSaving(true); setMsg("");
    try {
      await saveLocation({ id: initial.id, label, lat: pin.lat, lng: pin.lng, address, landmark, gps_code: gpsCode, contact_phone: phone });
      await onSaved();
    } catch (e) { setMsg(e.message); setSaving(false); }
  }

  const isCustomLabel = !LABELS.includes(label);

  return (
    <div className={`${card} p-4 sm:p-5 space-y-5`}>
      <div>
        <h3 className="text-sm font-semibold text-[var(--t-text1)]">{isNew ? "Add delivery location" : `Edit "${initial.label}"`}</h3>
        <p className="mt-0.5 text-xs text-[var(--t-muted)]">Put the pin exactly where the rider should bring your package.</p>
      </div>

      {/* Name */}
      <div>
        <p className={lbl}>Name this place</p>
        <div className="flex flex-wrap gap-2">
          {[...LABELS, "Other"].map((l) => {
            const on = l === "Other" ? isCustomLabel : label === l;
            return (
              <button key={l} type="button" aria-pressed={on}
                onClick={() => setLabel(l === "Other" ? (isCustomLabel ? label : "") : l)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${on ? "text-white border-transparent" : "border-[var(--t-border)] text-[var(--t-text2)] bg-[var(--t-bg)]"}`}
                style={on ? { background: accent } : {}}>
                {l}
              </button>
            );
          })}
        </div>
        {isCustomLabel && (
          <input type="text" className={`${inp} mt-2 sm:max-w-xs`} value={label} maxLength={60}
            onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Mum's house" aria-label="Location name" />
        )}
      </div>

      {/* Find the spot */}
      <div className="space-y-3">
        <p className={lbl + " !mb-0"}>Find the spot</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={useMyLocation} disabled={locating}
            className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60"
            style={{ background: accent }}>
            {locating ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <LocateFixed size={14} aria-hidden="true" />}
            {locating ? "Finding you…" : "Use my current location"}
          </button>
        </div>

        <form onSubmit={runSearch} className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" aria-hidden="true" />
            <input type="search" className={`${inp} !pl-8`} value={query} onChange={(e) => setQuery(e.target.value)}
              placeholder="Search a place, e.g. Accra Mall, East Legon" aria-label="Search a place" />
          </div>
          <button type="submit" className={ghostBtn} disabled={searching || query.trim().length < 3}>
            {searching ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : "Search"}
          </button>
        </form>
        {results && (
          <ul className="overflow-hidden rounded-lg border border-[var(--t-border)] divide-y divide-[var(--t-border)]">
            {results.length === 0 && <li className="px-3 py-2.5 text-xs text-[var(--t-muted)]">No places found. Try another name, or drop the pin on the map.</li>}
            {results.map((r) => (
              <li key={`${r.lat},${r.lng}`}>
                <button type="button" className="w-full px-3 py-2.5 text-left text-xs text-[var(--t-text2)] hover:bg-[var(--t-bg)]"
                  onClick={() => { placePin(r); setResults(null); setAccuracy(null); if (!address) setAddress(shortName(r.name)); }}>
                  {r.name}
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="relative">
          <Link2 size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" aria-hidden="true" />
          <input type="text" className={`${inp} !pl-8`} value={pasted} onChange={(e) => applyPasted(e.target.value)}
            placeholder="Or paste a Google Maps link / coordinates" aria-label="Paste a Google Maps link or coordinates" />
        </div>

        <Suspense fallback={<MapFallback />}>
          <LocationPickerMap value={pin} center={center} accent={accent}
            onChange={(p) => { setPin(p); setAccuracy(null); setMsg(""); }} />
        </Suspense>
        <p className="text-[11px] text-[var(--t-muted)]">
          {pin
            ? <>Pin at <span className="tabular-nums">{coordsText(pin)}</span>{accuracy ? ` (accurate to about ${accuracy} m)` : ""}. Drag it or tap the map to adjust.</>
            : "Tap the map to drop your pin."}
          {accuracy > 100 && " Your phone's location is rough. Zoom in and drag the pin to your exact spot."}
        </p>
      </div>

      {/* Details for the rider */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className={lbl} htmlFor="loc-address">Area / street / building</label>
          <input id="loc-address" type="text" className={inp} value={address} maxLength={300}
            onChange={(e) => setAddress(e.target.value)} placeholder="e.g. Adjiringanor, near the Total filling station" />
        </div>
        <div className="sm:col-span-2">
          <label className={lbl} htmlFor="loc-landmark">Directions for the rider (optional)</label>
          <textarea id="loc-landmark" rows={2} className={inp} value={landmark} maxLength={500}
            onChange={(e) => setLandmark(e.target.value)} placeholder="e.g. Blue gate, 2nd house after the church. Call when you arrive." />
        </div>
        <div>
          <label className={lbl} htmlFor="loc-gps">GhanaPost GPS address (optional)</label>
          <input id="loc-gps" type="text" className={`${inp} uppercase`} value={gpsCode} maxLength={20}
            onChange={(e) => setGpsCode(e.target.value)} placeholder="GA-123-4567" />
        </div>
        <div>
          <label className={lbl} htmlFor="loc-phone">Phone for the rider</label>
          <input id="loc-phone" type="tel" className={inp} value={phone} maxLength={30}
            onChange={(e) => setPhone(e.target.value)} placeholder="+233 XX XXX XXXX" />
        </div>
      </div>

      {msg && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-900/20 dark:text-amber-200">{msg}</p>}

      <div className="flex flex-wrap justify-end gap-2">
        <button type="button" onClick={onCancel} className={ghostBtn + " !py-2.5 !px-4 !text-sm"}>Cancel</button>
        <button type="button" onClick={handleSave} disabled={saving || !label.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
          style={{ background: accent }}>
          {saving ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
          {saving ? "Saving…" : isFirst ? "Save location" : "Save"}
        </button>
      </div>
    </div>
  );
}

// "Accra Mall, Spintex Road, Accra, Greater Accra Region, Ghana" → first 3 parts
function shortName(name = "") {
  return name.split(",").map((s) => s.trim()).filter((s) => s && s !== "Ghana").slice(0, 3).join(", ");
}

// ═════════════════════════════════════════════════════════════════════════════
// Staff: a customer's locations, ready for a rider
// ═════════════════════════════════════════════════════════════════════════════
export function CustomerDeliveryLocations({ customerId, customerName = "", customerPhone = "" }) {
  const [locations, setLocations] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [shown,     setShown]     = useState(null);   // id of the location whose map is open
  const [copied, copy] = useCopy();

  useEffect(() => {
    if (!customerId) return;
    let cancelled = false;
    setLoading(true); setError("");
    listCustomerLocations(customerId)
      .then((l) => { if (!cancelled) { setLocations(l); setShown(l[0]?.id ?? null); } })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [customerId]);

  if (loading) return <div className="h-24 animate-pulse rounded-xl bg-gray-200 dark:bg-white/10" />;
  if (error) return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>;
  if (!locations.length) {
    return (
      <div className={`${card} p-5 text-center`}>
        <MapPin size={20} className="mx-auto text-[var(--t-muted)]" aria-hidden="true" />
        <p className="mt-2 text-sm text-[var(--t-text2)]">No delivery location saved yet.</p>
        <p className="mt-1 text-xs text-[var(--t-muted)]">The customer can add one from their portal under <b>Delivery</b>.</p>
      </div>
    );
  }

  const who = { name: customerName, phone: customerPhone };
  return (
    <ul className="space-y-3">
      {locations.map((loc) => {
        const text = riderMessage(loc, who);
        return (
          <li key={loc.id} className={`${card} p-4 space-y-3`}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[var(--t-text1)]">
                  {loc.label}
                  {loc.is_default && <span className="rounded-full bg-[#6366F1] px-2 py-0.5 text-[10px] font-semibold text-white">Default</span>}
                </p>
                {loc.address && <p className="mt-0.5 text-xs text-[var(--t-text2)]">{loc.address}</p>}
                {loc.landmark && <p className="mt-0.5 text-xs text-[var(--t-muted)]">{loc.landmark}</p>}
                <p className="mt-1 text-[11px] text-[var(--t-muted)] tabular-nums">
                  {loc.gps_code ? `${loc.gps_code} · ` : ""}{coordsText(loc)}
                  {(loc.contact_phone || customerPhone) ? ` · ☎ ${loc.contact_phone || customerPhone}` : ""}
                </p>
              </div>
              <button type="button" className={ghostBtn + " shrink-0"} onClick={() => setShown(shown === loc.id ? null : loc.id)}
                aria-expanded={shown === loc.id}>
                <MapPin size={13} aria-hidden="true" /> {shown === loc.id ? "Hide map" : "Map"}
              </button>
            </div>

            {shown === loc.id && (
              <Suspense fallback={<MapFallback height={200} />}>
                <LocationPickerMap value={{ lat: loc.lat, lng: loc.lng }} readOnly height={200} accent="#6366F1" />
              </Suspense>
            )}

            <div className="flex flex-wrap gap-2">
              <a href={googleDirectionsLink(loc)} target="_blank" rel="noreferrer" className={ghostBtn}>
                <Navigation size={13} aria-hidden="true" /> Directions
              </a>
              <button type="button" className={ghostBtn} onClick={() => copy(`c-${loc.id}`, coordsText(loc))}>
                {copied === `c-${loc.id}` ? <Check size={13} className="text-green-600" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                {copied === `c-${loc.id}` ? "Copied" : "Copy coordinates"}
              </button>
              <button type="button" className={ghostBtn} onClick={() => copy(`r-${loc.id}`, text)}>
                {copied === `r-${loc.id}` ? <Check size={13} className="text-green-600" aria-hidden="true" /> : <Copy size={13} aria-hidden="true" />}
                {copied === `r-${loc.id}` ? "Copied" : "Copy for rider"}
              </button>
              <a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noreferrer" className={ghostBtn}>
                <Share2 size={13} aria-hidden="true" /> Send via WhatsApp
              </a>
            </div>
          </li>
        );
      })}
      <p className="text-[11px] text-[var(--t-muted)]">
        In Bolt / Uber / Yango, paste the coordinates into the destination search, or open the Google Maps link and share it.
      </p>
    </ul>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
// Nudge for customers with no location saved
// ═════════════════════════════════════════════════════════════════════════════
export function DeliveryLocationPrompt({ onAdd, accent = "#C0392B" }) {
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    let cancelled = false;
    listMyLocations()
      .then((l) => { if (!cancelled) setMissing(l.length === 0); })
      .catch(() => {});   // table not set up yet: say nothing
    return () => { cancelled = true; };
  }, []);
  if (!missing) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3"
      style={{ borderColor: `${accent}40`, background: `${accent}0D` }}>
      <MapPin size={18} style={{ color: accent }} className="shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 text-xs text-[var(--t-text2)]">
        <b className="text-[var(--t-text1)]">Want your orders delivered?</b> Add your delivery location so our rider can find you.
      </p>
      <button type="button" onClick={onAdd}
        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90" style={{ background: accent }}>
        Add location
      </button>
    </div>
  );
}
