/**
 * DigitalRatesEditor.jsx
 * The Digital Print Quoter's cost settings (sheets, paper, lamination, binding,
 * banners/stickers, per-piece products, global settings). Used in two places with the same UI:
 *   - Admin → Settings                 (saves directly)
 *   - Production lobby → Digital rates (only for production accounts the admin
 *     has allowed; saves through the update_digital_rates() database function,
 *     which can change nothing else in Settings)
 */
import { useEffect, useState } from "react";
import { getSettings, saveDigitalRates } from "../lib/settings.js";
import {
  DEFAULT_DIGITAL_RATES, DIGITAL_SHEET_NAMES, DIGITAL_STOCK_NAMES,
  UNIT_JOB_TYPES, UNIT_JOB_LABELS, mergeDigitalRates, hasPrintSides,
} from "../lib/digitalPrintSpecs.js";
import { Plus, Trash2 } from "lucide-react";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red";

export function DigitalRatesEditor({ asProduction = false, onSaved }) {
  const [dRates, setDRates] = useState(structuredClone(DEFAULT_DIGITAL_RATES));
  const [savingDRates, setSavingDRates] = useState(false);
  const [dRatesMsg, setDRatesMsg] = useState("");

  useEffect(() => {
    getSettings()
      .then((data) => {
        if (data?.digital_quote_rates) setDRates((r) => mergeDigitalRates(data.digital_quote_rates, r));
      })
      .catch((err) => setDRatesMsg(err.message ?? "Could not load digital rates."));
  }, []);

  function setDSheetRate(sheet, field, value) {
    setDRates((r) => ({ ...r, sheets: { ...r.sheets, [sheet]: { ...r.sheets[sheet], [field]: Number(value) } } }));
  }
  function setDStockRate(stock, sheet, value) {
    setDRates((r) => ({ ...r, stocks: { ...r.stocks, [stock]: { ...r.stocks[stock], [sheet]: Number(value) } } }));
  }
  function setDGlobal(key, value) {
    setDRates((r) => ({ ...r, [key]: typeof r[key] === 'number' ? Number(value) : value }));
  }
  function setDLfRate(type, mat, value) {
    setDRates((r) => ({ ...r, lf: { ...r.lf, [type]: { ...r.lf[type], [mat]: Number(value) } } }));
  }
  function setDLamRate(type, sheet, value) {
    setDRates((r) => ({
      ...r,
      lamination: { ...r.lamination, [type]: { ...(r.lamination?.[type] || {}), [sheet]: Number(value) } },
    }));
  }
  function setDBind(name, value) {
    setDRates((r) => ({ ...r, bind: { ...r.bind, [name]: Number(value) } }));
  }

  // Per-piece item lists: [{ name, cost }]
  function setUnitList(type, fn) {
    setDRates((r) => ({ ...r, unit: { ...(r.unit || {}), [type]: fn([...(r.unit?.[type] || [])]) } }));
  }
  function setUnitItem(type, i, field, value) {
    setUnitList(type, (list) => { list[i] = { ...list[i], [field]: field === "name" ? value : Number(value) }; return list; });
  }
  function addUnitItem(type) {
    setUnitList(type, (list) => [...list, hasPrintSides(type) ? { name: "", cost: 0, backCost: 0 } : { name: "", cost: 0 }]);
  }
  function removeUnitItem(type, i) {
    setUnitList(type, (list) => list.filter((_, j) => j !== i));
  }

  async function handleSaveDigitalRates() {
    setDRatesMsg("");
    // Item names identify the item in saved quotes, so they must be filled in and unique
    for (const type of UNIT_JOB_TYPES) {
      const names = (dRates.unit?.[type] || []).map((i) => (i.name || "").trim());
      if (names.some((n) => !n)) { setDRatesMsg(`${UNIT_JOB_LABELS[type]}: every item needs a name (or remove the empty row).`); return; }
      const dup = names.find((n, i) => names.indexOf(n) !== i);
      if (dup) { setDRatesMsg(`${UNIT_JOB_LABELS[type]}: "${dup}" is listed twice.`); return; }
    }
    const toSave = {
      ...dRates,
      unit: Object.fromEntries(UNIT_JOB_TYPES.map((t) => [t, (dRates.unit?.[t] || []).map((i) => ({
        name: i.name.trim(),
        cost: Number(i.cost) || 0,
        ...(hasPrintSides(t) ? { backCost: Number(i.backCost) || 0 } : {}),
      }))])),
    };
    setSavingDRates(true);
    try {
      await saveDigitalRates(toSave, { asProduction });
      setDRates(toSave);
      onSaved?.(toSave);
      setDRatesMsg("Digital print rates saved.");
    } catch (err) {
      const m = err.message ?? "";
      setDRatesMsg(m.includes("update_digital_rates")
        ? "Run supabase/037_login_background_and_production_rates.sql in Supabase first."
        : (m || "Could not save digital rates."));
    } finally {
      setSavingDRates(false);
    }
  }
  return (
    <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
      <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Digital print rate defaults</h2>
      <p className="mt-1 text-sm text-gray-600">Costs used by the Digital Print Quoter. All amounts in GH₵.</p>

      {dRatesMsg && (
        <div role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${dRatesMsg.includes("saved") ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          {dRatesMsg}
        </div>
      )}

      {/* Print cost per parent sheet */}
      <h3 className="mt-5 text-xs font-semibold uppercase tracking-wide text-brand-red border-b border-gray-300 pb-1.5 mb-3">Print cost per parent sheet (GH₵)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Sheet</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Single-sided</th>
              <th className="text-right py-2 px-2 text-xs font-medium text-gray-500">Double-sided</th>
            </tr>
          </thead>
          <tbody>
            {DIGITAL_SHEET_NAMES.map((name) => (
              <tr key={name} className="border-t border-gray-200">
                <td className="py-2 px-2 text-sm font-medium text-brand-dark">{name}</td>
                {['p1', 'p2'].map((f) => (
                  <td key={f} className="py-2 px-2">
                    <input
                      type="number" step="0.01" min="0"
                      value={dRates.sheets[name]?.[f] ?? 0}
                      onChange={(e) => setDSheetRate(name, f, e.target.value)}
                      className={inputClass}
                      style={{ maxWidth: 90 }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paper cost per stock per sheet */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-brand-red border-b border-gray-300 pb-1.5 mb-3">Paper cost per parent sheet by stock (GH₵)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Stock</th>
              {DIGITAL_SHEET_NAMES.map((n) => (
                <th key={n} className="text-right py-2 px-2 text-xs font-medium text-gray-500">{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DIGITAL_STOCK_NAMES.map((stock) => (
              <tr key={stock} className="border-t border-gray-200">
                <td className="py-2 px-2 text-sm font-medium text-brand-dark">{stock}</td>
                {DIGITAL_SHEET_NAMES.map((sheet) => (
                  <td key={sheet} className="py-2 px-2">
                    <input
                      type="number" step="0.01" min="0"
                      value={dRates.stocks[stock]?.[sheet] ?? 0}
                      onChange={(e) => setDStockRate(stock, sheet, e.target.value)}
                      className={inputClass}
                      style={{ maxWidth: 80 }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Lamination per parent sheet per side */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-brand-red border-b border-gray-300 pb-1.5 mb-3">Lamination per parent sheet, per side (GH₵)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 px-2 text-xs font-medium text-gray-500">Lamination</th>
              {DIGITAL_SHEET_NAMES.map((n) => (
                <th key={n} className="text-right py-2 px-2 text-xs font-medium text-gray-500">{n}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Object.keys(dRates.lamination || {}).map((type) => (
              <tr key={type} className="border-t border-gray-200">
                <td className="py-2 px-2 text-sm font-medium text-brand-dark">{type}</td>
                {DIGITAL_SHEET_NAMES.map((sheet) => (
                  <td key={sheet} className="py-2 px-2">
                    <input
                      type="number" step="0.01" min="0"
                      value={dRates.lamination[type]?.[sheet] ?? 0}
                      onChange={(e) => setDLamRate(type, sheet, e.target.value)}
                      className={inputClass}
                      style={{ maxWidth: 80 }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Binding rates */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-brand-red border-b border-gray-300 pb-1.5 mb-3">Binding (per copy, GH₵)</h3>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {Object.keys(dRates.bind).filter((b) => b !== 'None').map((name) => (
          <div key={name}>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{name}</label>
            <input type="number" step="0.01" min="0" value={dRates.bind[name]} onChange={(e) => setDBind(name, e.target.value)} className={inputClass} />
          </div>
        ))}
      </div>

      {/* Large format rates */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-brand-red border-b border-gray-300 pb-1.5 mb-3">Banner rates (per sq ft)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.keys(dRates.lf.banner).map((mat) => (
          <div key={mat}>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{mat}</label>
            <input type="number" step="0.01" min="0" value={dRates.lf.banner[mat]} onChange={(e) => setDLfRate('banner', mat, e.target.value)} className={inputClass} />
          </div>
        ))}
      </div>
      <h3 className="mt-4 text-xs font-semibold uppercase tracking-wide text-brand-red border-b border-gray-300 pb-1.5 mb-3">Sticker rates (per sq ft)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {Object.keys(dRates.lf.sticker).map((mat) => (
          <div key={mat}>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{mat}</label>
            <input type="number" step="0.01" min="0" value={dRates.lf.sticker[mat]} onChange={(e) => setDLfRate('sticker', mat, e.target.value)} className={inputClass} />
          </div>
        ))}
      </div>

      {/* Per-piece products */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-brand-red border-b border-gray-300 pb-1.5 mb-1">Priced per piece: cost per piece (GH₵)</h3>
      <p className="mb-3 text-xs text-gray-600">
        Roll-up banners, T-shirts and souvenirs are priced as cost per piece × quantity, plus the per-piece markup below.
        Renaming an item doesn&apos;t change quotes already saved.
      </p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {UNIT_JOB_TYPES.map((type) => {
          const list = dRates.unit?.[type] || [];
          return (
            <div key={type} className="rounded-lg border border-gray-200 bg-white/60 p-3">
              <p className="mb-2 text-sm font-semibold text-brand-dark">{UNIT_JOB_LABELS[type]}</p>
              {hasPrintSides(type) && (
                <p className="-mt-1 mb-2 text-[11px] text-gray-500">Name · cost with <b>front</b> print · <b>extra</b> to also print the back</p>
              )}
              <div className="space-y-2">
                {list.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input type="text" value={item.name} placeholder="Item name"
                      aria-label={`${UNIT_JOB_LABELS[type]} item ${i + 1} name`}
                      onChange={(e) => setUnitItem(type, i, "name", e.target.value)}
                      className={inputClass + " min-w-0 flex-1"} />
                    <input type="number" step="0.01" min="0" value={item.cost}
                      aria-label={`${item.name || "Item"} cost${hasPrintSides(type) ? " (front print)" : ""}`}
                      title={hasPrintSides(type) ? "Cost with front print" : "Cost per piece"}
                      onChange={(e) => setUnitItem(type, i, "cost", e.target.value)}
                      className={inputClass} style={{ maxWidth: 90 }} />
                    {hasPrintSides(type) && (
                      <input type="number" step="0.01" min="0" value={item.backCost ?? 0}
                        aria-label={`${item.name || "Item"} extra cost to print the back`}
                        title="Extra cost per piece to also print the back"
                        onChange={(e) => setUnitItem(type, i, "backCost", e.target.value)}
                        className={inputClass} style={{ maxWidth: 80 }} />
                    )}
                    <button type="button" onClick={() => removeUnitItem(type, i)}
                      aria-label={`Remove ${item.name || "item"}`}
                      className="shrink-0 rounded-md p-2 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
                {list.length === 0 && <p className="text-xs text-gray-500">No items. Customers won&apos;t see this product until you add one.</p>}
              </div>
              <button type="button" onClick={() => addUnitItem(type)}
                className="mt-2 inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-semibold text-brand-red hover:bg-brand-red/10 transition-colors">
                <Plus size={14} /> Add item
              </button>
            </div>
          );
        })}
      </div>

      {/* Global settings */}
      <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide text-brand-red border-b border-gray-300 pb-1.5 mb-3">Global settings</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {[
          { key: 'margin',     label: 'Non-print margin (mm)' },
          { key: 'gutter',     label: 'Gap between pieces (mm)' },
          { key: 'wasteFixed', label: 'Fixed waste sheets' },
          { key: 'wastePct',   label: 'Extra waste (%)' },
          { key: 'markup',     label: 'Markup (%)' },
          { key: 'setup',      label: 'Setup fee (GH₵)' },
          { key: 'fold',       label: 'Folding per copy (GH₵)' },
          { key: 'bannerFin',  label: 'Banner hem & eyelets (GH₵)' },
          { key: 'stickerCut', label: 'Sticker cutting (GH₵)' },
          { key: 'lfMin',      label: 'Min. banner/sticker charge (GH₵)' },
          { key: 'lfMarkup',   label: 'Banner/sticker markup (%)' },
          { key: 'unitMarkup', label: 'Per-piece products markup (%)' },
        ].map(({ key, label }) => (
          <div key={key}>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
            <input type="number" step="0.01" min="0" value={dRates[key] ?? 0} onChange={(e) => setDGlobal(key, e.target.value)} className={inputClass} />
          </div>
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-3">
        <button type="button" onClick={() => setDRates(structuredClone(DEFAULT_DIGITAL_RATES))}
          className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors">
          Reset to defaults
        </button>
        <button type="button" onClick={handleSaveDigitalRates} disabled={savingDRates}
          className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
          {savingDRates ? "Saving…" : "Save digital rates"}
        </button>
      </div>
    </div>
  );
}
