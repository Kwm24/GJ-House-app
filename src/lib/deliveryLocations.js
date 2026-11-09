/**
 * deliveryLocations.js
 * Customers' saved delivery locations (migration 039): a map pin saved as
 * latitude / longitude plus optional directions, so staff can hand it to a
 * delivery rider (Bolt, Uber, Yango…) as a Google Maps link or coordinates.
 */
import { supabase } from "./supabase.js";

const COLS = "id, customer_id, label, lat, lng, address, landmark, gps_code, contact_phone, is_default, created_at, updated_at";

// Accra: where the map opens when there's no pin yet
export const DEFAULT_CENTER = { lat: 5.6037, lng: -0.187 };

function friendly(error) {
  const m = error?.message || "";
  if (error?.code === "42P01" || error?.code === "PGRST205" || m.includes("delivery_locations")) {
    return new Error("Delivery locations aren't set up yet. Run supabase/039_delivery_locations.sql in Supabase.");
  }
  return error;
}

// ── Customer: own locations ──────────────────────────────────────────────────
export async function listMyLocations() {
  const { data, error } = await supabase
    .from("delivery_locations")
    .select(COLS)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw friendly(error);
  return data ?? [];
}

// Insert (no id) or update (with id). The first location becomes the default.
export async function saveLocation(loc) {
  const row = {
    label:         (loc.label || "Home").trim().slice(0, 60),
    lat:           Number(loc.lat),
    lng:           Number(loc.lng),
    address:       loc.address?.trim()       || null,
    landmark:      loc.landmark?.trim()      || null,
    gps_code:      loc.gps_code?.trim().toUpperCase() || null,
    contact_phone: loc.contact_phone?.trim() || null,
  };
  if (!isValidCoord(row.lat, row.lng)) throw new Error("Pick a point on the map first.");

  if (loc.id) {
    const { data, error } = await supabase.from("delivery_locations").update(row).eq("id", loc.id).select(COLS).single();
    if (error) throw friendly(error);
    return data;
  }
  const { count, error: countErr } = await supabase
    .from("delivery_locations").select("id", { count: "exact", head: true });
  if (countErr) throw friendly(countErr);
  const { data, error } = await supabase
    .from("delivery_locations").insert({ ...row, is_default: !count }).select(COLS).single();
  if (error) throw friendly(error);
  return data;
}

export async function deleteLocation(id) {
  const { error } = await supabase.from("delivery_locations").delete().eq("id", id);
  if (error) throw friendly(error);
}

export async function setDefaultLocation(id) {
  const { error } = await supabase.rpc("set_default_delivery_location", { location_id: id });
  if (error) throw friendly(error);
}

// ── Staff: a customer's locations ────────────────────────────────────────────
export async function listCustomerLocations(customerId) {
  const { data, error } = await supabase
    .from("delivery_locations")
    .select(COLS)
    .eq("customer_id", customerId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });
  if (error) throw friendly(error);
  return data ?? [];
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function isValidCoord(lat, lng) {
  return Number.isFinite(lat) && Number.isFinite(lng)
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
    && !(lat === 0 && lng === 0);
}

export const fmtCoord = (n) => Number(n).toFixed(6);
export const coordsText = (loc) => `${fmtCoord(loc.lat)}, ${fmtCoord(loc.lng)}`;

// Opens the pin in Google Maps (app on phones). Riders' apps accept this link
// or the plain "lat, lng" text in their destination search.
export function googleMapsLink(loc) {
  return `https://www.google.com/maps/search/?api=1&query=${fmtCoord(loc.lat)},${fmtCoord(loc.lng)}`;
}

export function googleDirectionsLink(loc) {
  return `https://www.google.com/maps/dir/?api=1&destination=${fmtCoord(loc.lat)},${fmtCoord(loc.lng)}`;
}

// Everything a rider needs, ready to paste into WhatsApp / a delivery app note.
export function riderMessage(loc, { name, phone } = {}) {
  return [
    name ? `Delivery for: ${name}` : null,
    (loc.contact_phone || phone) ? `Phone: ${loc.contact_phone || phone}` : null,
    loc.address  ? `Address: ${loc.address}` : null,
    loc.gps_code ? `GhanaPost GPS: ${loc.gps_code}` : null,
    loc.landmark ? `Directions: ${loc.landmark}` : null,
    `Coordinates: ${coordsText(loc)}`,
    `Map: ${googleMapsLink(loc)}`,
  ].filter(Boolean).join("\n");
}

/**
 * Coordinates from what a customer pastes: a Google Maps link
 * (…/@5.6037,-0.187,17z · ?q=5.6,-0.18 · …!3d5.6!4d-0.18) or plain
 * "5.6037, -0.1870". Returns { lat, lng } or null.
 * Short links (maps.app.goo.gl/…) can't be read from the browser — the
 * caller should ask for the full link or the coordinates instead.
 */
export function parseLocationInput(text) {
  const s = decodeURIComponent(String(text || "").trim());
  if (!s) return null;
  const num = String.raw`(-?\d{1,3}(?:\.\d+)?)`;
  const patterns = [
    new RegExp(String.raw`!3d${num}!4d${num}`),                 // place pin (most exact)
    new RegExp(String.raw`[?&](?:q|query|ll|destination|daddr|center)=${num}\s*,\s*${num}`),
    new RegExp(String.raw`@${num},${num}`),                     // map view centre
    new RegExp(String.raw`^${num}\s*[,\s]\s*${num}$`),          // plain "lat, lng"
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const lat = parseFloat(m[1]), lng = parseFloat(m[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

export const isShortMapsLink = (text) => /(maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(String(text || ""));

// Place search (OpenStreetMap Nominatim, free, no key). Biased to Ghana.
export async function searchPlaces(query) {
  const q = String(query || "").trim();
  if (q.length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&countrycodes=gh&q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error("Place search is unavailable right now. Drop the pin on the map instead.");
  const list = await res.json();
  return list.map((p) => ({ name: p.display_name, lat: parseFloat(p.lat), lng: parseFloat(p.lon) }));
}

// Browser GPS. Resolves { lat, lng, accuracy } (accuracy in metres).
export function currentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("This browser can't share your location. Drop the pin on the map instead.")); return; }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (err) => reject(new Error(
        err.code === 1 ? "Location permission was denied. Allow location for this site in your browser settings, or drop the pin on the map."
        : err.code === 3 ? "Finding your location took too long. Try again outdoors or drop the pin on the map."
        : "Couldn't find your location. Drop the pin on the map instead.")),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
