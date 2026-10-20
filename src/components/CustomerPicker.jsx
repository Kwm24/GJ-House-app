/**
 * CustomerPicker.jsx
 * Compact combobox that lets CS staff search for a registered customer
 * and auto-fill the client name + phone fields in any form.
 *
 * Usage:
 *   <CustomerPicker onSelect={({ name, phone }) => { setName(name); setPhone(phone); }} />
 *
 * Works inside both PrintQuoteGH (inline-style form) and InvoiceBuilder
 * (Tailwind form). The trigger button uses inline styles that match the
 * brand-red colour so it reads the same in both contexts.
 */
import { useState, useEffect, useRef } from "react";
import { listCustomers } from "../lib/auth.js";

export function CustomerPicker({ onSelect, className = "" }) {
  const [open,      setOpen]      = useState(false);
  const [query,     setQuery]     = useState("");
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [fetched,   setFetched]   = useState(false);
  const containerRef = useRef(null);
  const searchRef    = useRef(null);

  // Lazy-load the customer list the first time the picker opens.
  async function openPicker() {
    setOpen(true);
    if (!fetched) {
      setLoading(true);
      try {
        setCustomers(await listCustomers());
        setFetched(true);
      } catch { /* silent — list shows empty state */ }
      finally { setLoading(false); }
    }
    // Focus the search box after the dropdown has rendered
    requestAnimationFrame(() => searchRef.current?.focus());
  }

  function closePicker() {
    setOpen(false);
    setQuery("");
  }

  // Close when clicking outside the component
  useEffect(() => {
    if (!open) return;
    function onDown(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        closePicker();
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === "Escape") closePicker(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const filtered = query.trim()
    ? customers.filter((c) =>
        (c.full_name ?? "").toLowerCase().includes(query.toLowerCase()) ||
        (c.phone ?? "").includes(query)
      )
    : customers;

  function pick(customer) {
    onSelect({
      name:   customer.full_name ?? "",
      phone:  customer.phone     ?? "",
      email:  customer.email     ?? "",
      userId: customer.user_id,
    });
    closePicker();
  }

  return (
    <div
      ref={containerRef}
      className={`relative inline-block ${className}`}
      style={{ fontFamily: "inherit" }}
    >
      {/* Trigger button — inline styles so it looks right in both Tailwind and
          inline-style contexts. Matches brand-red #C0392B. */}
      <button
        type="button"
        onClick={open ? closePicker : openPicker}
        style={{
          display:       "inline-flex",
          alignItems:    "center",
          gap:           6,
          padding:       "5px 12px",
          borderRadius:  8,
          border:        "1.5px solid #C0392B",
          background:    open ? "#FAE8E6" : "#fff",
          color:         "#C0392B",
          fontSize:      11,
          fontWeight:    600,
          cursor:        "pointer",
          letterSpacing: 0.3,
          fontFamily:    "inherit",
          transition:    "background .15s",
          whiteSpace:    "nowrap",
        }}
      >
        <span>👤</span>
        {open ? "Close" : "Fill from customer"}
      </button>

      {/* Dropdown */}
      {open && (
        <div
          style={{
            position:   "absolute",
            top:        "calc(100% + 4px)",
            left:       0,
            zIndex:     1000,
            width:      288,
            borderRadius: 12,
            border:     "1.5px solid #E5DFD5",
            background: "#fff",
            boxShadow:  "0 8px 32px rgba(0,0,0,0.12)",
            overflow:   "hidden",
            fontFamily: "inherit",
          }}
        >
          {/* Search input */}
          <div style={{ padding: "8px 8px 6px", borderBottom: "1px solid #F0EBE3" }}>
            <input
              ref={searchRef}
              type="text"
              placeholder="Search by name or phone…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width:        "100%",
                padding:      "6px 10px",
                borderRadius: 7,
                border:       "1.5px solid #D4CFC8",
                background:   "#F9F6F1",
                fontSize:     12,
                color:        "#1C1C1E",
                fontFamily:   "inherit",
                outline:      "none",
                boxSizing:    "border-box",
              }}
            />
          </div>

          {/* Customer list */}
          <ul
            style={{
              listStyle:   "none",
              margin:      0,
              padding:     0,
              maxHeight:   220,
              overflowY:   "auto",
            }}
          >
            {loading ? (
              <li style={{ padding: "14px 12px", fontSize: 12, color: "#888", textAlign: "center" }}>
                Loading customers…
              </li>
            ) : filtered.length === 0 ? (
              <li style={{ padding: "14px 12px", fontSize: 12, color: "#888", textAlign: "center" }}>
                {customers.length === 0
                  ? "No registered customers yet."
                  : "No match — try a different name or number."}
              </li>
            ) : (
              filtered.map((c) => (
                <li key={c.user_id} style={{ borderBottom: "1px solid #F5F0E8" }}>
                  <button
                    type="button"
                    onClick={() => pick(c)}
                    style={{
                      width:      "100%",
                      textAlign:  "left",
                      padding:    "10px 12px",
                      background: "none",
                      border:     "none",
                      cursor:     "pointer",
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = "#FAE8E6"}
                    onMouseLeave={(e) => e.currentTarget.style.background = "none"}
                  >
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1C1C1E", margin: 0 }}>
                      {c.full_name}
                    </p>
                    {(c.phone || c.email) && (
                      <p style={{ fontSize: 11, color: "#888", margin: "2px 0 0", lineHeight: 1.5 }}>
                        {[c.phone, c.email].filter(Boolean).join("  ·  ")}
                      </p>
                    )}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
