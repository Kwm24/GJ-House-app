/**
 * DigitalRatesEditor.jsx
 * The Digital Print Quoter's cost settings (sheets, paper, lamination, binding,
 * banners/stickers, global settings). Used in two places with the same UI:
 *   - Admin → Settings                 (saves directly)
 *   - Production lobby → Digital rates (only for production accounts the admin
 *     has allowed; saves through the update_digital_rates() database function,
 *     which can change nothing else in Settings)
 */
import { useEffect, useState } from "react";
import { getSettings, saveDigitalRates } from "../lib/settings.js";
import { DEFAULT_DIGITAL_RATES, DIGITAL_SHEET_NAMES, DIGITAL_STOCK_NAMES } from "../lib/digitalPrintSpecs.js";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red";

export function DigitalRatesEditor({ asProduction = false }) {
  const [dRates, setDRates] = useState(structuredClone(DEFAULT_DIGITAL_RATES));
  const [savingDRates, setSavingDRates] = useState(false);
  const [dRatesMsg, setDRatesMsg] = useState("");

  useEffect(() => {
    getSettings()
      .then((data) => {
        if (data?.digital_quote_rates) setDRates((r) => deepMerge(r, data.digital_quote_rates));
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

  async function handleSaveDigitalRates() {
    setSavingDRates(true);
    setDRatesMsg("");
    try {
      await saveDigitalRates(dRates, { asProduction });
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

function deepMerge(target, source) {
  const out = { ...target };
  for (const k of Object.keys(source)) {
    if (source[k] !== null && typeof source[k] === "object" && !Array.isArray(source[k])) {
      out[k] = deepMerge(target[k] || {}, source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}
