import { useState, useEffect, useCallback } from "react";
import { getDashboardData } from "../../lib/dashboard.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";
import { formatGHS as GHS } from "../../lib/currency.js";

const STATUS_PIPELINE = [
  { status: "approved",         label: "Approved",         color: "bg-blue-100 text-blue-800" },
  { status: "ready_for_design", label: "Ready for Design", color: "bg-purple-100 text-purple-800" },
  { status: "design_ready",     label: "Design Ready",     color: "bg-indigo-100 text-indigo-800" },
  { status: "in_production",    label: "In Production",    color: "bg-amber-100 text-amber-800" },
  { status: "at_finishing",     label: "At Finishing",     color: "bg-orange-100 text-orange-800" },
  { status: "ready_for_pickup", label: "Ready for Pickup", color: "bg-teal-100 text-teal-800" },
  { status: "delivered",        label: "Delivered",        color: "bg-green-100 text-green-800" },
];

const PAYMENT_TYPE_COLORS = {
  deposit: "bg-blue-100 text-blue-800",
  balance: "bg-green-100 text-green-800",
};

function StatCard({ label, value, sub, accent, highlight }) {
  let bg = "border border-gray-200 bg-white";
  if (accent)     bg = "bg-brand-dark text-brand-cream";
  if (highlight === "green")  bg = "border border-green-200 bg-green-50";
  if (highlight === "orange") bg = "border border-orange-200 bg-orange-50";

  return (
    <div className={`rounded-lg p-5 ${bg}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${accent ? "text-brand-cream/60" : "text-gray-500"}`}>
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${
        accent ? "text-brand-cream"
        : highlight === "green"  ? "text-green-700"
        : highlight === "orange" ? "text-orange-600"
        : "text-brand-dark"
      }`}>
        {value}
      </p>
      {sub && <p className={`mt-1 text-xs ${accent ? "text-brand-cream/50" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

// Per-job helpers (mirrors lib/jobs.js but works on the partial job shape
// returned by getDashboardData — no need to import the full jobs lib here).
function jobGrandTotal(job) {
  const qty = job.quote?.resultQtys?.[0];
  return job.quote?.results?.[qty]?.grandTotal ?? 0;
}
function jobTotalPaid(job) {
  return Math.round(
    (job.payments ?? []).reduce((sum, p) => sum + Number(p.amount || 0), 0) * 100
  ) / 100;
}
function jobOutstanding(job) {
  return Math.round((jobGrandTotal(job) - jobTotalPaid(job)) * 100) / 100;
}

export function AdminDashboardTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await getDashboardData());
    } catch (err) {
      setError(err.message ?? "Could not load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 rounded-full border-2 border-brand-cream/30 border-t-brand-red animate-spin" aria-label="Loading" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      </div>
    );
  }

  const { jobs, expenditures, profiles, payments } = data;

  // ── Financial totals ──────────────────────────────────────────────────────
  const totalRevenue      = jobs.reduce((sum, j) => sum + jobGrandTotal(j), 0);
  const totalCashReceived = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalOutstanding  = jobs.reduce((sum, j) => sum + Math.max(0, jobOutstanding(j)), 0);
  const totalExpenditure  = expenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netMargin         = totalRevenue - totalExpenditure;

  // ── Pipeline counts ───────────────────────────────────────────────────────
  const byStatus = {};
  for (const j of jobs) byStatus[j.status] = (byStatus[j.status] || 0) + 1;

  // ── Active staff ──────────────────────────────────────────────────────────
  const activeStaff = profiles.filter((p) => p.is_active !== false && p.role !== "customer").length;

  // ── Recent jobs (newest 5) ────────────────────────────────────────────────
  const recentJobs = [...jobs]
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">

      {/* ── Top stat row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Quoted revenue"   value={GHS(totalRevenue)}      sub="approved jobs" />
        <StatCard label="Cash received"    value={GHS(totalCashReceived)} sub="actual payments" highlight="green" />
        <StatCard label="Outstanding"      value={GHS(totalOutstanding)}  sub="unpaid balance"  highlight="orange" />
        <StatCard label="Expenditure"      value={GHS(totalExpenditure)}  sub="all roles" />
        <StatCard label="Net margin"       value={GHS(Math.abs(netMargin))} sub={netMargin < 0 ? "loss" : "profit"} accent />
        <StatCard label="Active jobs"      value={jobs.length}            sub={`${activeStaff} staff`} />
      </div>

      {/* ── Payments + pipeline side by side ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent payments */}
        <div className="rounded-xl bg-brand-cream p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-dark">Recent payments</h2>
          {payments.length === 0 ? (
            <p className="mt-4 text-sm text-gray-500">No payments recorded yet.</p>
          ) : (
            <div className="mt-4 space-y-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2.5 gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-brand-dark truncate">
                      {p.jobs?.job_title || p.jobs?.quote_ref || "No job linked"}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      {p.jobs?.client_name && <span>{p.jobs.client_name} · </span>}
                      {p.method} · {p.date}
                    </div>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <div className="text-sm font-bold text-brand-dark">{GHS(p.amount)}</div>
                    <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${PAYMENT_TYPE_COLORS[p.type] ?? "bg-gray-100 text-gray-700"}`}>
                      {p.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pipeline breakdown */}
        <div className="rounded-xl bg-brand-cream p-5 sm:p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-dark">Job pipeline</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {STATUS_PIPELINE.map(({ status, label, color }) => (
              <div key={status} className="rounded-lg border border-gray-200 bg-white p-3 text-center">
                <div className="text-2xl font-bold text-brand-dark">{byStatus[status] ?? 0}</div>
                <span className={`mt-1.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${color}`}>
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent jobs with payment status ── */}
      <div className="rounded-xl bg-brand-cream p-5 sm:p-8">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-brand-dark">Recent jobs</h2>
        {recentJobs.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No jobs yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-gray-500 border-b border-gray-300">
                  <th className="py-2 pr-4">Job</th>
                  <th className="py-2 pr-4">Client</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4 text-right">Total</th>
                  <th className="py-2 pr-4 text-right">Deposit due</th>
                  <th className="py-2 pr-4 text-right">Paid</th>
                  <th className="py-2 pr-4 text-right">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => {
                  const total       = jobGrandTotal(job);
                  const totalPaid   = jobTotalPaid(job);
                  const outstanding = jobOutstanding(job);
                  return (
                    <tr key={job.id} className="border-b border-gray-200">
                      <td className="py-2.5 pr-4 text-brand-dark font-medium">{job.job_title || "Untitled"}</td>
                      <td className="py-2.5 pr-4 text-gray-600">{job.client_name || "—"}</td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
                          {jobStatusLabel(job.status)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-medium text-brand-dark whitespace-nowrap">
                        {GHS(total)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-gray-500 whitespace-nowrap">
                        {GHS(job.deposit_amount)}
                      </td>
                      <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                        <span className={totalPaid > 0 ? "font-medium text-green-700" : "text-gray-400"}>
                          {GHS(totalPaid)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-medium whitespace-nowrap">
                        <span className={outstanding <= 0 ? "text-green-700" : "text-brand-red"}>
                          {outstanding <= 0 ? "✓ Settled" : GHS(outstanding)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
