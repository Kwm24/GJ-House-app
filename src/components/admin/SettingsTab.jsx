import { useState, useEffect, useCallback, useRef } from "react";
import { getSettings, updateSettings, uploadCompanyLogo } from "../../lib/settings.js";
import { DEFAULT_RATES, RATE_GROUPS } from "../../lib/printSpecs.js";

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

  const [momoNumber, setMomoNumber] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState("");

  const [rates, setRates] = useState(DEFAULT_RATES);
  const [savingRates, setSavingRates] = useState(false);
  const [ratesMsg, setRatesMsg] = useState("");

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
        setMomoNumber(data.momo_number || "");
        setBankName(data.bank_name || "");
        setAccountNumber(data.account_number || "");
        setAccountName(data.account_name || "");
        setRates({ ...DEFAULT_RATES, ...(data.quote_rates || {}) });
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
          <div className="flex items-center gap-4">
            {companyLogoUrl && (
              <img src={companyLogoUrl} alt="Company logo" className="h-14 w-auto object-contain rounded border border-gray-200 bg-white p-1" />
            )}
            <label className="cursor-pointer rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:border-brand-red hover:text-brand-red transition-colors">
              {uploadingLogo ? "Uploading…" : companyLogoUrl ? "Replace logo" : "Upload logo"}
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" disabled={uploadingLogo}
                onChange={(e) => handleLogoUpload(e.target.files?.[0])} />
            </label>
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
    </div>
  );
}
