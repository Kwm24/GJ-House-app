import { useState } from "react";
import PrintQuoteGH from "../PrintQuoteGH.jsx";
import { SavedQuotesPanel } from "./SavedQuotesPanel.jsx";

export function QuotesTab() {
  const [mode, setMode] = useState("list"); // "list" | "create"
  const [loadedQuote, setLoadedQuote] = useState(null);

  function handleCreate() {
    setLoadedQuote(null);
    setMode("create");
  }

  function handleLoad(snapshot) {
    setLoadedQuote(snapshot);
    setMode("create");
  }

  if (mode === "create") {
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg sm:text-xl font-semibold text-brand-cream">
          Saved quotes
        </h2>
        <button
          type="button"
          onClick={handleCreate}
          className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 transition-colors"
        >
          + Create Quote
        </button>
      </div>
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <SavedQuotesPanel onLoad={handleLoad} />
      </div>
    </div>
  );
}
