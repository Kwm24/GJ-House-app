import { useState, useEffect } from "react";
import { loadSavedQuotes, deleteSavedQuote } from "../../lib/quoteStorage.js";

const sCard = {
  background: "#F0EAE0",
  borderRadius: 8,
  padding: "10px 14px",
  display: "flex",
  alignItems: "center",
  gap: 10,
};
const sBtnSm = {
  padding: "4px 12px",
  fontSize: 12,
  borderRadius: 6,
  border: "1px solid #C8C2BA",
  background: "#fff",
  cursor: "pointer",
  fontFamily: "inherit",
};

export function SavedQuotesPanel({ onLoad }) {
  const [quotes, setQuotes] = useState([]);

  useEffect(() => {
    setQuotes(loadSavedQuotes());
  }, []);

  const del = (ref) => {
    setQuotes(deleteSavedQuote(ref));
  };

  if (!quotes.length) {
    return (
      <p style={{ fontSize: 13, color: "#888", textAlign: "center", padding: "24px 0" }}>
        No saved quotes yet. Click "Create Quote" to start one.
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {quotes.map((q) => (
        <div key={q.ref} style={sCard}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#1C1C1E" }}>
              {q.jobTitle || "Untitled"}
            </div>
            <div style={{ fontSize: 11, color: "#888" }}>
              {q.ref} · {q.clientName || "No client"} · {q.date}
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            <button style={sBtnSm} onClick={() => onLoad(q)}>
              Load
            </button>
            <button
              style={{ ...sBtnSm, color: "#C0392B", borderColor: "#C0392B" }}
              onClick={() => del(q.ref)}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
