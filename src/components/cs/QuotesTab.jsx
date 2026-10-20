import { useState, useEffect } from "react";
import PrintQuoteGH from "../PrintQuoteGH.jsx";
import DigitalPrintQuoteGH from "../DigitalPrintQuoteGH.jsx";
import { SavedQuotesPanel } from "./SavedQuotesPanel.jsx";
import { loadDigitalQuotes, deleteDigitalQuote } from "../../lib/quoteStorage.js";
import { formatGHS } from "../../lib/currency.js";

export function QuotesTab() {
  const [quoteType, setQuoteType] = useState("offset"); // "offset" | "digital"
  const [mode, setMode]           = useState("list");    // "list" | "create"
  const [loadedQuote, setLoadedQuote] = useState(null);

  const [digitalQuotes, setDigitalQuotes] = useState([]);

  useEffect(() => {
    if (quoteType === "digital") setDigitalQuotes(loadDigitalQuotes());
  }, [quoteType, mode]);

  function handleCreate() {
    setLoadedQuote(null);
    setMode("create");
  }

  function handleLoad(snapshot) {
    setLoadedQuote(snapshot);
    setMode("create");
  }

  function handleDeleteDigital(ref) {
    setDigitalQuotes(deleteDigitalQuote(ref));
  }

  // When switching quote type, reset to list mode
  function switchType(type) {
    setQuoteType(type);
    setMode("list");
    setLoadedQuote(null);
  }

  // ── Offset: create mode ──────────────────────────────────────────────────────
  if (quoteType === "offset" && mode === "create") {
    return (
      <div>
        <div className="no-print mx-auto max-w-[980px] px-4 pt-6 sm:px-6">
          <button
            type="button"
            onClick={() => setMode("list")}
            className="text-sm font-medium text-brand-cream/70 hover:text-brand-cream transition-colors"
          >
            ← Back to quotes
          </button>
        </div>
        <PrintQuoteGH embedded csMode initialQuote={loadedQuote} />
      </div>
    );
  }

  // ── Digital: create/edit mode ────────────────────────────────────────────────
  if (quoteType === "digital" && mode === "create") {
    return (
      <DigitalPrintQuoteGH
        initialQuote={loadedQuote}
        onBack={() => { setMode("list"); setLoadedQuote(null); }}
      />
    );
  }

  // ── List mode ────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">

      {/* ── Type toggle ── */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-center p-1 rounded-xl bg-[var(--t-surface)] border border-[var(--t-border)] gap-1">
          {[
            { id: "offset",  label: "Offset Print" },
            { id: "digital", label: "Digital Print" },
          ].map(({ id, label }) => (
            <button
              key={id}
              type="button"
              onClick={() => switchType(id)}
              className={[
                "px-4 py-2 rounded-lg text-sm font-medium transition-all",
                quoteType === id
                  ? "bg-brand-red text-white shadow-sm"
                  : "text-[var(--t-muted)] hover:text-[var(--t-text1)] hover:bg-[var(--t-bg)]",
              ].join(" ")}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={handleCreate}
          className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 transition-colors"
        >
          + Create Quote
        </button>
      </div>

      {/* ── Offset: list of saved quotes ── */}
      {quoteType === "offset" && (
        <>
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--t-text1)] mb-4">Saved quotes</h2>
          <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
            <SavedQuotesPanel onLoad={handleLoad} />
          </div>
        </>
      )}

      {/* ── Digital: saved quotes list ── */}
      {quoteType === "digital" && (
        <>
          <h2 className="text-lg sm:text-xl font-semibold text-[var(--t-text1)] mb-4">Saved digital quotes</h2>

          {digitalQuotes.length === 0 ? (
            <div className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-10 text-center">
              <p className="text-sm text-[var(--t-muted)]">No saved digital quotes yet.</p>
              <p className="text-xs text-[var(--t-muted)] mt-1">Create a quote and click "Save quote" to keep it here.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {digitalQuotes.map((q) => (
                <div key={q.ref}
                  className="rounded-xl border border-[var(--t-border)] bg-[var(--t-surface)] p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-[var(--t-text1)]">{q.jobTitle || "Digital Quote"}</span>
                      <span className="text-xs font-mono text-[var(--t-muted)]">{q.ref}</span>
                    </div>
                    <p className="text-xs text-[var(--t-text2)] mt-0.5">
                      {q.clientName || "No client"}{q.clientPhone ? ` · ${q.clientPhone}` : ""} · {q.date}
                    </p>
                    {q.result?.description && (
                      <p className="text-xs text-[var(--t-muted)] mt-0.5 truncate">{q.result.description}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 sm:flex-col sm:items-end">
                    <div className="text-right">
                      <p className="text-xs text-[var(--t-muted)]">Charge client</p>
                      <p className="text-sm font-bold text-[var(--t-text1)] tabular-nums">{formatGHS(q.result?.sellPrice ?? 0)}</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleLoad(q)}
                        className="rounded-lg bg-[#6366F1] text-white text-xs font-semibold px-3 py-1.5 hover:bg-[#4F46E5] transition-colors"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteDigital(q.ref)}
                        className="rounded-lg border border-red-300 text-red-600 text-xs font-semibold px-3 py-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
