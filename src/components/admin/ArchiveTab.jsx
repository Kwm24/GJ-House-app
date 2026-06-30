import { useState, useCallback } from "react";
import { supabase } from "../../lib/supabase.js";
import { exportToCsv } from "../../lib/csvExport.js";

const CONFIRM_PHRASE = "DELETE ALL DATA";

async function fetchTable(name, select = "*") {
  const { data, error } = await supabase
    .from(name)
    .select(select)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Could not fetch ${name}: ${error.message}`);
  return data ?? [];
}

// Downloads a separate .csv file for each table that has data.
async function exportAllTables() {
  const date = new Date().toISOString().slice(0, 10);
  const tables = [
    { name: "jobs", label: "jobs" },
    { name: "expenditures", label: "expenditures" },
    { name: "payments", label: "payments" },
    { name: "notifications", label: "notifications" },
    { name: "job_files", label: "job-files" },
    { name: "profiles", label: "profiles" },
  ];

  let downloaded = 0;
  for (const { name, label } of tables) {
    const rows = await fetchTable(name);
    if (rows.length > 0) {
      const flat = rows.map((row) => {
        const out = {};
        for (const [k, v] of Object.entries(row)) {
          out[k] = typeof v === "object" && v !== null ? JSON.stringify(v) : v;
        }
        return out;
      });
      exportToCsv(`printpress-${label}-${date}.csv`, flat);
      downloaded++;
      await new Promise((r) => setTimeout(r, 150));
    }
  }
  if (downloaded === 0) throw new Error("No data found to export.");
  return downloaded;
}

export function ArchiveTab() {
  const [exporting, setExporting] = useState(false);
  const [exportDone, setExportDone] = useState(false);
  const [exportError, setExportError] = useState("");
  const [exportedCount, setExportedCount] = useState(0);

  const [confirmText, setConfirmText] = useState("");
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState("");
  const [clearDone, setClearDone] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError("");
    setExportDone(false);
    try {
      const count = await exportAllTables();
      setExportedCount(count);
      setExportDone(true);
    } catch (err) {
      setExportError(err.message ?? "Export failed.");
    } finally {
      setExporting(false);
    }
  }, []);

  const handleClear = useCallback(async () => {
    if (confirmText !== CONFIRM_PHRASE) return;
    setClearing(true);
    setClearError("");
    setClearDone(false);
    try {
      const { data, error } = await supabase.functions.invoke("clear-database", {
        body: { confirm: CONFIRM_PHRASE },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setClearDone(true);
      setConfirmText("");
    } catch (err) {
      setClearError(err.message ?? "Clear failed.");
    } finally {
      setClearing(false);
    }
  }, [confirmText]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <h2 className="text-lg sm:text-xl font-semibold text-brand-dark">Export database</h2>
        <p className="mt-1 text-sm text-gray-600">
          Downloads each table as a separate CSV file — ready to open in Excel or Google Sheets.
        </p>
        <p className="mt-2 text-xs text-gray-500">
          Exports: Jobs, Expenditures, Payments, Notifications, Job files, Profiles.
          JSON columns (quote data, line items) are stringified inline.
        </p>

        {exportError && (
          <div role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {exportError}
          </div>
        )}
        {exportDone && (
          <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            {exportedCount} CSV file{exportedCount !== 1 ? "s" : ""} downloaded. Keep them somewhere safe before clearing.
          </div>
        )}

        <button
          type="button"
          onClick={handleExport}
          disabled={exporting}
          className="mt-5 rounded-lg bg-brand-dark text-brand-cream text-sm font-semibold px-5 py-2.5 hover:bg-brand-dark/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
        >
          {exporting ? "Exporting…" : "⬇ Export as CSV files"}
        </button>
      </div>

      <div className="rounded-xl border-2 border-red-200 bg-red-50 p-5 sm:p-8">
        <h2 className="text-lg sm:text-xl font-semibold text-red-900">Clear database</h2>
        <p className="mt-1 text-sm text-red-700">
          Permanently deletes all jobs, expenditures, payments, notifications, and job
          file records — for a clean start to a new financial year.
          Staff accounts and app settings are <strong>not</strong> deleted.
        </p>
        <p className="mt-2 text-sm font-semibold text-red-800">
          This cannot be undone. Export first.
        </p>

        {clearError && (
          <div role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-100 px-4 py-3 text-sm text-red-900">
            {clearError}
          </div>
        )}
        {clearDone && (
          <div role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            Database cleared. Ready for the new year.
          </div>
        )}

        <div className="mt-5">
          <label className="block text-sm font-medium text-red-800 mb-2">
            Type <strong>{CONFIRM_PHRASE}</strong> to unlock the clear button
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => { setConfirmText(e.target.value); setClearError(""); setClearDone(false); }}
            placeholder={CONFIRM_PHRASE}
            className="w-full rounded-lg border border-red-300 bg-white px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-500 font-mono"
          />
        </div>

        <button
          type="button"
          onClick={handleClear}
          disabled={confirmText !== CONFIRM_PHRASE || clearing}
          className="mt-4 rounded-lg bg-red-600 text-white text-sm font-semibold px-5 py-2.5 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {clearing ? "Clearing…" : "Clear all business data"}
        </button>
      </div>
    </div>
  );
}
