/**
 * LocationPickerMap.jsx
 * A map with one draggable pin (Leaflet + OpenStreetMap tiles; free, no API
 * key). Tap the map or drag the pin to move it; `onChange({ lat, lng })`.
 * Pass `readOnly` to just show a pin. Loaded lazily (Leaflet is ~40 kB).
 */
import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// A CSS pin, so we don't depend on Leaflet's marker images (which bundlers break)
function pinIcon(color) {
  return L.divIcon({
    className: "",
    iconSize: [30, 42],
    iconAnchor: [15, 41],
    html: `<svg width="30" height="42" viewBox="0 0 30 42" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M15 1C7.3 1 1 7.2 1 14.9 1 25.3 15 41 15 41s14-15.7 14-26.1C29 7.2 22.7 1 15 1z" fill="${color}" stroke="#fff" stroke-width="2"/>
      <circle cx="15" cy="15" r="5.5" fill="#fff"/></svg>`,
  });
}

export default function LocationPickerMap({ value, center, onChange, readOnly = false, accent = "#C0392B", height = 280, zoom = 16 }) {
  const elRef     = useRef(null);
  const mapRef    = useRef(null);
  const markerRef = useRef(null);
  const cbRef     = useRef(onChange);
  useEffect(() => { cbRef.current = onChange; });

  // Create the map once
  useEffect(() => {
    const start = value || center || { lat: 5.6037, lng: -0.187 };
    const map = L.map(elRef.current, {
      center: [start.lat, start.lng],
      zoom: value ? zoom : 12,
      scrollWheelZoom: false,          // don't hijack page scrolling
      dragging: !L.Browser.mobile || !readOnly,
    });
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    if (!readOnly) {
      map.on("click", (e) => cbRef.current?.({ lat: e.latlng.lat, lng: e.latlng.lng }));
    }
    mapRef.current = map;

    // The map is often created inside something that's still animating open
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(elRef.current);
    return () => { ro.disconnect(); map.remove(); mapRef.current = null; markerRef.current = null; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly]);

  // Keep the pin in sync with `value`
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    const ll = [value.lat, value.lng];
    if (!markerRef.current) {
      const m = L.marker(ll, { icon: pinIcon(accent), draggable: !readOnly, keyboard: !readOnly, title: "Delivery location" }).addTo(map);
      if (!readOnly) m.on("dragend", () => { const p = m.getLatLng(); cbRef.current?.({ lat: p.lat, lng: p.lng }); });
      markerRef.current = m;
      map.setView(ll, Math.max(map.getZoom(), zoom));
    } else {
      markerRef.current.setLatLng(ll);
      if (!map.getBounds().pad(-0.15).contains(ll)) map.panTo(ll);
    }
  }, [value, accent, readOnly, zoom]);

  // Fly to a new centre (e.g. search result / GPS) when asked
  useEffect(() => {
    if (center && mapRef.current) mapRef.current.setView([center.lat, center.lng], Math.max(mapRef.current.getZoom(), zoom));
  }, [center, zoom]);

  return (
    <div ref={elRef} style={{ height }} role="application"
      aria-label={readOnly ? "Map showing the delivery location" : "Map: tap to place the delivery pin, or drag the pin"}
      className="relative z-0 w-full overflow-hidden rounded-lg border border-[var(--t-border)]" />
  );
}
