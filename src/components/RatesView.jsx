/**
 * RatesView.jsx
 * Public price list (items marked "Show on Rates"), grouped by category in a
 * masonry layout. Shown in the customer portal's Rates tab and in the landing
 * page's Rates window; readable without signing in (migration 025).
 */
import { useEffect, useState } from "react";
import { listPublicItems } from "../lib/items.js";

function fmtGHS(n) {
  return "GH₵ " + Number(n || 0).toLocaleString("en-GH", {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });
}

export function RatesView() {
  const [items,   setItems]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    listPublicItems()
      .then(setItems)
      .catch((err) => setError(err.message ?? "Could not load rates."))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ columns: "2 160px", gap: "12px" }}>
        {[1,2,3,4,5,6].map((i) => (
          <div key={i} className="rounded-xl bg-gray-200 dark:bg-white/10 animate-pulse"
            style={{ height: i % 2 === 0 ? 200 : 140, breakInside: "avoid", marginBottom: 12 }} />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm px-4 py-3">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12 space-y-2">
        <div className="text-4xl">🏷️</div>
        <p className="text-sm font-medium text-[var(--t-text2)]">No rates published yet.</p>
        <p className="text-xs text-[var(--t-muted)] max-w-xs mx-auto">
          Our team will publish pricing information here soon.
        </p>
      </div>
    );
  }

  // Group by category
  const grouped = items.reduce((acc, item) => {
    const key = item.category || "General";
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category}>
          <div className="text-xs font-bold uppercase tracking-widest text-brand-red mb-4 border-b border-[var(--t-border)] pb-2">
            {category}
          </div>

          {/* Masonry grid */}
          <div style={{ columns: "2 160px", gap: "12px" }}>
            {catItems.map((item) => (
              <div
                key={item.id}
                className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] overflow-hidden hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200"
                style={{ breakInside: "avoid", marginBottom: "12px" }}
              >
                {/* Thumbnail */}
                {item.thumbnail_url ? (
                  <div className="w-full aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-white/5">
                    <img
                      src={item.thumbnail_url}
                      alt={item.name}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div className="w-full h-24 bg-gradient-to-br from-brand-red/10 to-brand-red/5 flex items-center justify-center">
                    <span className="text-3xl opacity-40">🏷️</span>
                  </div>
                )}

                {/* Content */}
                <div className="p-3">
                  <p className="font-semibold text-[var(--t-text1)] text-sm leading-snug">{item.name}</p>
                  {item.description && (
                    <p className="text-xs text-[var(--t-muted)] mt-0.5 leading-relaxed">{item.description}</p>
                  )}
                  {item.item_type === "print" && item.print_specs && (
                    <div className="mt-1.5 space-y-0.5">
                      {item.print_specs.material && (
                        <p className="text-[10px] text-[var(--t-muted)]">🖨️ {item.print_specs.material}</p>
                      )}
                      {item.print_specs.size && (
                        <p className="text-[10px] text-[var(--t-muted)]">📐 {item.print_specs.size}</p>
                      )}
                    </div>
                  )}

                  {/* Price strip */}
                  <div className="mt-3 pt-2.5 border-t border-[var(--t-border)] flex items-baseline justify-between gap-2">
                    <span className="font-bold text-brand-red text-sm whitespace-nowrap">
                      {fmtGHS(item.unit_price)}
                    </span>
                    <span className="text-[10px] text-[var(--t-muted)] shrink-0">per {item.unit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <p className="text-center text-xs text-[var(--t-muted)] px-4 pb-2">
        Prices are subject to change. Contact us for a formal quotation tailored to your job.
      </p>
    </div>
  );
}
