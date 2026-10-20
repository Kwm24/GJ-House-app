import { useState, useEffect, useCallback, useRef } from "react";
import { getSettings, updateSettings, uploadCompanyLogo, uploadQuoterThumbnail } from "../../lib/settings.js";
import { DEFAULT_RATES, RATE_GROUPS } from "../../lib/printSpecs.js";
import { DEFAULT_DIGITAL_RATES, DIGITAL_SHEET_NAMES, DIGITAL_STOCK_NAMES } from "../../lib/digitalPrintSpecs.js";
import { applyAccentHex } from "../AccentColorInjector.jsx";

const inputClass =
  "w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-red/40 focus:border-brand-red";

export function SettingsTab() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const logoInputRef = useRef(null);
  const [companyLogoUrl, setCompanyLogoUrl] = useState("");
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [logoMsg, setLogoMsg] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyVatNo, setCompanyVatNo] = useState("");
  const [termsOfService, setTermsOfService] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  const [companyMsg, setCompanyMsg] = useState("");

  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [momoNumber, setMomoNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState("");

  const [rates, setRates] = useState(DEFAULT_RATES);
  const [savingRates, setSavingRates] = useState(false);
  const [ratesMsg, setRatesMsg] = useState("");

  const [dRates, setDRates] = useState(structuredClone(DEFAULT_DIGITAL_RATES));
  const [savingDRates, setSavingDRates] = useState(false);
  const [dRatesMsg, setDRatesMsg] = useState("");

  const [accentColor, setAccentColor] = useState("#C0392B");
  const [savingBranding, setSavingBranding] = useState(false);
  const [brandingMsg, setBrandingMsg] = useState("");

  const [quoterThumbnails, setQuoterThumbnails] = useState({});
  const [uploadingThumb, setUploadingThumb] = useState({});
  const [thumbMsg, setThumbMsg] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await getSettings();
      if (data) {
        setCompanyLogoUrl(data.company_logo_url || "");
        setCompanyName(data.company_name || "");
        setCompanyAddress(data.company_address || "");
        setCompanyPhone(data.company_phone || "");
        setCompanyEmail(data.company_email || "");
        setCompanyVatNo(data.company_vat_no || "");
        setTermsOfService(data.terms_of_service || "");
        setWhatsappNumber(data.whatsapp_number || "");
        setMomoNumber(data.momo_number || "");
        setBankName(data.bank_name || "");
        setAccountNumber(data.account_number || "");
        setAccountName(data.account_name || "");
        setRates({ ...DEFAULT_RATES, ...(data.quote_rates || {}) });
        if (data.digital_quote_rates) {
          setDRates((r) => deepMergeSettings(r, data.digital_quote_rates));
        }
        setAccentColor(data.accent_color || "#C0392B");
        setQuoterThumbnails(data.instant_quoter_thumbnails || {});
      }
    } catch (err) {
      setError(err.message ?? "Could not load settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setRate(key, value) {
    setRates((r) => ({ ...r, [key]: Number(value) }));
  }

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
  function setDBind(name, value) {
    setDRates((r) => ({ ...r, bind: { ...r.bind, [name]: Number(value) } }));
  }

  async function handleSaveDigitalRates() {
    setSavingDRates(true);
    setDRatesMsg("");
    try {
      await updateSettings({ digital_quote_rates: dRates });
      setDRatesMsg("Digital print rates saved.");
    } catch (err) {
      setDRatesMsg(err.message ?? "Could not save digital rates.");
    } finally {
      setSavingDRates(false);
    }
  }

  async function handleLogoUpload(file) {
    if (!file) return;
    setUploadingLogo(true);
    setLogoMsg("");
    try {
      const url = await uploadCompanyLogo(file);
      setCompanyLogoUrl(url);
      setLogoMsg("Logo uploaded.");
    } catch (err) {
      setLogoMsg(err.message ?? "Could not upload logo.");
    } finally {
      setUploadingLogo(false);
      if (logoInputRef.current) logoInputRef.current.value = "";
    }
  }

  async function handleRemoveLogo() {
    if (!window.confirm("Remove the company logo?")) return;
    setLogoMsg("");
    try {
      await updateSettings({ company_logo_url: null });
      setCompanyLogoUrl("");
      setLogoMsg("Logo removed.");
    } catch (err) {
      setLogoMsg(err.message ?? "Could not remove logo.");
    }
  }

  async function handleSaveCompany() {
    setSavingCompany(true);
    setCompanyMsg("");
    try {
      await updateSettings({
        company_name: companyName.trim() || null,
        company_address: companyAddress.trim() || null,
        company_phone: companyPhone.trim() || null,
        company_email: companyEmail.trim() || null,
        company_vat_no: companyVatNo.trim() || null,
        terms_of_service: termsOfService.trim() || null,
        whatsapp_number: whatsappNumber.trim() || null,
      });
      setCompanyMsg("Company info saved.");
    } catch (err) {
      setCompanyMsg(err.message ?? "Could not save company info.");
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleSavePayment() {
    setSavingPayment(true);
    setPaymentMsg("");
    try {
      await updateSettings({
        momo_number: momoNumber.trim() || null,
        bank_name: bankName.trim() || null,
        account_number: accountNumber.trim() || null,
        account_name: accountName.trim() || null,
      });
      setPaymentMsg("Payment details saved.");
    } catch (err) {
      setPaymentMsg(err.message ?? "Could not save payment details.");
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleSaveBranding() {
    setSavingBranding(true);
    setBrandingMsg("");
    try {
      await updateSettings({ accent_color: accentColor });
      // Apply immediately so the change is visible without a page refresh
      applyAccentHex(accentColor);
      setBrandingMsg("Branding saved.");
    } catch (err) {
      setBrandingMsg(err.message ?? "Could not save branding.");
    } finally {
      setSavingBranding(false);
    }
  }

  async function handleQuoterThumbUpload(jobType, file) {
    if (!file) return;
    setUploadingThumb((s) => ({ ...s, [jobType]: true }));
    setThumbMsg((s) => ({ ...s, [jobType]: "" }));
    try {
      const url = await uploadQuoterThumbnail(jobType, file);
      setQuoterThumbnails((t) => ({ ...t, [jobType]: url }));
      setThumbMsg((s) => ({ ...s, [jobType]: "✓ Uploaded" }));
    } catch (err) {
      setThumbMsg((s) => ({ ...s, [jobType]: err.message ?? "Upload failed" }));
    } finally {
      setUploadingThumb((s) => ({ ...s, [jobType]: false }));
    }
  }

  async function handleRemoveQuoterThumb(jobType) {
    const updated = { ...quoterThumbnails };
    delete updated[jobType];
    try {
      await updateSettings({ instant_quoter_thumbnails: updated });
      setQuoterThumbnails(updated);
    } catch (err) {
      setThumbMsg((s) => ({ ...s, [jobType]: err.message ?? "Could not remove" }));
    }
  }

  async function handleSaveRates() {
    setSavingRates(true);
    setRatesMsg("");
    try {
      await updateSettings({ quote_rates: rates });
      setRatesMsg("Quote rate defaults saved.");
    } catch (err) {
      setRatesMsg(err.message ?? "Could not save rate defaults.");
    } finally {
      setSavingRates(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div
          className="h-8 w-8 rounded-full border-2 border-brand-cream/30 border-t-brand-red animate-spin"
          aria-label="Loading"
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* ── Company information ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Company information</h2>
        <p className="mt-1 text-sm text-gray-600">
          Printed on every quote and payment receipt.
        </p>

        {companyMsg && (
          <div role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${companyMsg.includes("saved") ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {companyMsg}
          </div>
        )}

        {/* Logo upload */}
        <div className="mt-4">
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Company logo</label>
          <div className="flex items-center gap-4 flex-wrap">
            {companyLogoUrl && (
              <img src={companyLogoUrl} alt="Company logo" className="h-14 w-auto object-contain rounded border border-gray-200 bg-white p-1" />
            )}
            <label className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-brand-red hover:text-brand-red transition-colors">
              {uploadingLogo ? "Uploading…" : companyLogoUrl ? "Replace logo" : "Upload logo"}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" disabled={uploadingLogo}
                onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
            </label>
            {companyLogoUrl && (
              <button
                type="button"
                onClick={handleRemoveLogo}
                className="rounded-lg border border-red-200 bg-white px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Remove logo
              </button>
            )}
          </div>
          {logoMsg && (
            <p className={`mt-2 text-sm ${logoMsg.includes("uploaded") ? "text-green-700" : "text-red-700"}`}>
              {logoMsg}
            </p>
          )}
          <p className="mt-1 text-xs text-gray-400">PNG or SVG recommended. Appears at the top of every printed quote.</p>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Press / company name</label>
            <input type="text" value={companyName} onChange={(e) => setCompanyName(e.target.value)} className={inputClass} placeholder="e.g. GJ Press Ghana" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Email</label>
            <input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} className={inputClass} placeholder="e.g. info@gjpress.gh" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Phone</label>
            <input type="text" value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} className={inputClass} placeholder="e.g. +233 24 XXX XXXX" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">VAT registration number</label>
            <input type="text" value={companyVatNo} onChange={(e) => setCompanyVatNo(e.target.value)} className={inputClass} placeholder="e.g. VAT REG: XXXXXXXXX" />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Address</label>
            <input type="text" value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} className={inputClass} placeholder="e.g. 12 High Street, Accra, Ghana" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">WhatsApp contact number</label>
            <input type="text" value={whatsappNumber} onChange={(e) => setWhatsappNumber(e.target.value)} className={inputClass} placeholder="e.g. +233 24 XXX XXXX" />
            <p className="mt-1 text-xs text-gray-400">Shown as a floating chat button on the customer portal.</p>
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Terms of service / conditions</label>
            <textarea
              value={termsOfService}
              onChange={(e) => setTermsOfService(e.target.value)}
              rows={4}
              placeholder="e.g. Payment terms, revision policy, delivery conditions…"
              className={inputClass + " resize-y"}
            />
            <p className="mt-1 text-xs text-gray-400">Appears at the bottom of every printed quotation PDF.</p>
          </div>
        </div>

        <button type="button" onClick={handleSaveCompany} disabled={savingCompany} className="mt-5 rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors">
          {savingCompany ? "Saving…" : "Save company info"}
        </button>
      </div>

      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">
          Company payment details
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          The MoMo and bank details quoted to clients.
        </p>

        {paymentMsg && (
          <div
            role="status"
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              paymentMsg.includes("saved")
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {paymentMsg}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">MoMo number</label>
            <input
              type="text"
              value={momoNumber}
              onChange={(e) => setMomoNumber(e.target.value)}
              className={inputClass}
              placeholder="e.g. 024 XXX XXXX"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Bank name</label>
            <input
              type="text"
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className={inputClass}
              placeholder="e.g. GCB Bank"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Account number
            </label>
            <input
              type="text"
              value={accountNumber}
              onChange={(e) => setAccountNumber(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Account name
            </label>
            <input
              type="text"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <button
          type="button"
          onClick={handleSavePayment}
          disabled={savingPayment}
          className="mt-5 rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {savingPayment ? "Saving…" : "Save payment details"}
        </button>
      </div>

      {/* ── Branding ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Branding</h2>
        <p className="mt-1 text-sm text-gray-600">
          Accent colour used throughout the interface and on printed documents.
          Changes apply immediately without a page refresh.
        </p>

        {brandingMsg && (
          <div role="status" className={`mt-4 rounded-lg border px-4 py-3 text-sm ${brandingMsg.includes("saved") ? "border-green-200 bg-green-50 text-green-800" : "border-red-200 bg-red-50 text-red-800"}`}>
            {brandingMsg}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Accent colour</label>
            <div className="flex items-center gap-3">
              {/* Colour swatch picker */}
              <input
                type="color"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className="h-10 w-14 rounded-lg cursor-pointer border border-gray-300 p-0.5 bg-white"
                title="Pick accent colour"
              />
              {/* Hex text field */}
              <input
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                className={inputClass}
                style={{ width: 120 }}
                placeholder="#C0392B"
              />
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              Enter any hex code — e.g. #C0392B (default red) or #1A6B3E (green)
            </p>
          </div>

          {/* Live preview chips */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-500 font-medium">Preview</span>
            <div className="flex items-center gap-2">
              <span className="rounded-full px-3 py-1 text-xs font-semibold text-white" style={{ backgroundColor: accentColor }}>
                Button
              </span>
              <span className="text-sm font-semibold" style={{ color: accentColor }}>
                Heading text
              </span>
              <span className="rounded-full border-2 px-3 py-1 text-xs font-semibold" style={{ borderColor: accentColor, color: accentColor }}>
                Badge
              </span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setAccentColor("#C0392B")}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Reset to default red
          </button>
          <button
            type="button"
            onClick={handleSaveBranding}
            disabled={savingBranding}
            className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {savingBranding ? "Saving…" : "Save branding"}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">
          Quote rate defaults
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          These load automatically whenever CS opens a new quote.
        </p>

        {ratesMsg && (
          <div
            role="status"
            className={`mt-4 rounded-lg border px-4 py-3 text-sm ${
              ratesMsg.includes("saved")
                ? "border-green-200 bg-green-50 text-green-800"
                : "border-red-200 bg-red-50 text-red-800"
            }`}
          >
            {ratesMsg}
          </div>
        )}

        <div className="mt-4 space-y-6">
          {RATE_GROUPS.map((grp) => (
            <div key={grp.group}>
              <h3 className="text-xs font-semibold uppercase tracking-wide text-brand-red border-b border-gray-300 pb-1.5 mb-3">
                {grp.group}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {grp.fields.map(({ key, label }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1.5">
                      {label}
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={rates[key]}
                      onChange={(e) => setRate(key, e.target.value)}
                      className={inputClass}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="max-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">
              Profit margin (%)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              value={rates.profitMargin}
              onChange={(e) => setRate("profitMargin", e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setRates(DEFAULT_RATES)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Reset to built-in defaults
          </button>
          <button
            type="button"
            onClick={handleSaveRates}
            disabled={savingRates}
            className="rounded-lg bg-brand-red text-white text-sm font-semibold px-4 py-2.5 hover:bg-brand-red/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
          >
            {savingRates ? "Saving…" : "Save rate defaults"}
          </button>
        </div>
      </div>

      {/* ── Digital print rates ── */}
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

      {/* ── Instant Quoter thumbnails ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Instant Quoter — Job Type Images</h2>
        <p className="mt-1 text-sm text-gray-600 mb-5">
          Thumbnail images shown on the Instant Quoter (landing page &amp; customer portal). Square images work best.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { value: 'flyer',    label: 'Flyer / Poster'    },
            { value: 'card',     label: 'Business Card'      },
            { value: 'brochure', label: 'Brochure (bi-fold)' },
            { value: 'trifold',  label: 'Trifold Brochure'   },
            { value: 'book',     label: 'Booklet / Book'     },
            { value: 'banner',   label: 'Banner'             },
            { value: 'sticker',  label: 'Sticker / Label'    },
            { value: 'custom',   label: 'Custom / Other'     },
          ].map(({ value, label }) => (
            <div key={value} className="flex flex-col gap-1.5">
              <p className="text-xs font-semibold text-gray-700">{label}</p>
              <div className="relative w-full aspect-square rounded-xl overflow-hidden border border-gray-200 bg-gray-100 flex items-center justify-center">
                {quoterThumbnails[value] ? (
                  <>
                    <img src={quoterThumbnails[value]} alt={label} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => handleRemoveQuoterThumb(value)}
                      className="absolute top-1 right-1 rounded-full bg-black/50 text-white text-xs w-5 h-5 flex items-center justify-center hover:bg-red-600 transition-colors"
                      title="Remove"
                    >×</button>
                  </>
                ) : (
                  <span className="text-2xl opacity-30">🖼️</span>
                )}
              </div>
              <label className="relative cursor-pointer">
                <span className={[
                  "block text-center rounded-lg border border-gray-300 px-2 py-1.5 text-xs font-medium transition-colors",
                  uploadingThumb[value] ? "opacity-60 bg-gray-100" : "bg-white hover:bg-gray-50",
                ].join(" ")}>
                  {uploadingThumb[value] ? "Uploading…" : "Upload image"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  disabled={!!uploadingThumb[value]}
                  className="sr-only"
                  onChange={(e) => { if (e.target.files?.[0]) handleQuoterThumbUpload(value, e.target.files[0]); e.target.value = ""; }}
                />
              </label>
              {thumbMsg[value] && (
                <p className={`text-[10px] text-center ${thumbMsg[value].startsWith("✓") ? "text-green-700" : "text-red-600"}`}>
                  {thumbMsg[value]}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function deepMergeSettings(target, source) {
  const out = { ...target };
  for (const k of Object.keys(source)) {
    if (source[k] !== null && typeof source[k] === 'object' && !Array.isArray(source[k])) {
      out[k] = deepMergeSettings(target[k] || {}, source[k]);
    } else {
      out[k] = source[k];
    }
  }
  return out;
}
