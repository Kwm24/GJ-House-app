import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { getDashboardData } from "../../lib/dashboard.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { TrendingUp, Banknote, Briefcase, AlertCircle, BarChart2, Search } from "lucide-react";
import { PeriodPicker, filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";

// ── Chart palette — 8 categorical hues, fixed order, CVD-separated ───────────
// Each status maps to a distinct hue; not cycled, not rank-dependent.
const CHART_STATUSES = [
  { status: "approved",         label: "Approved",         color: "#3B82F6" },
  { status: "ready_for_design", label: "Ready for Design", color: "#A855F7" },
  { status: "design_ready",     label: "Design Ready",     color: "#EC4899" },
  { status: "in_production",    label: "In Production",    color: "#F59E0B" },
  { status: "at_finishing",     label: "At Finishing",     color: "#F97316" },
  { status: "ready_for_pickup", label: "Ready for Pickup", color: "#14B8A6" },
  { status: "delivered",        label: "Delivered",        color: "#22C55E" },
  { status: "completed",        label: "Completed",        color: "#0EA5E9" },
];

const PAYMENT_TYPE_COLORS = {
  deposit: "bg-indigo-50 text-[#6366F1] dark:bg-indigo-900/20 dark:text-indigo-300",
  balance: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300",
};

// ── SVG donut — pure math, no library ────────────────────────────────────────
const CX = 100, CY = 100, R = 62, SW = 26;
const CIRC = 2 * Math.PI * R;

function DonutChart({ slices }) {
  const [hovered, setHovered] = useState(null);
  const total = slices.reduce((s, sl) => s + sl.value, 0);

  if (total === 0) {
    return (
      <div className="flex items-center justify-center h-[200px]">
        <p className="text-sm text-gray-400 italic">No job data yet</p>
      </div>
    );
  }

  // Build segment geometry
  let cumulative = 0;
  const segments = slices
    .filter((sl) => sl.value > 0)
    .map((sl) => {
      const ratio  = sl.value / total;
      const len    = ratio * CIRC - 2; // 2px gap between segments
      const offset = CIRC - (cumulative / total) * CIRC;
      cumulative  += sl.value;
      return { ...sl, ratio, dasharray: `${Math.max(0, len)} ${CIRC}`, dashoffset: offset };
    });

  const hoveredSeg = segments.find((s) => s.label === hovered);

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      {/* Donut */}
      <div className="relative shrink-0">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          role="img"
          aria-label="Job status distribution donut chart"
        >
          {/* Background ring */}
          <circle
            cx={CX} cy={CY} r={R}
            fill="none"
            stroke="#f3f4f6"
            strokeWidth={SW}
          />
          {/* Segments */}
          {segments.map((seg) => (
            <circle
              key={seg.label}
              cx={CX} cy={CY} r={R}
              fill="none"
              stroke={seg.color}
              strokeWidth={hovered === seg.label ? SW + 5 : SW}
              strokeDasharray={seg.dasharray}
              strokeDashoffset={seg.dashoffset}
              strokeLinecap="butt"
              transform={`rotate(-90 ${CX} ${CY})`}
              style={{ transition: "stroke-width 0.15s ease", cursor: "pointer" }}
              onMouseEnter={() => setHovered(seg.label)}
              onMouseLeave={() => setHovered(null)}
            />
          ))}
          {/* Center — total or hovered value */}
          {hoveredSeg ? (
            <>
              <text
                x={CX} y={CY - 10}
                textAnchor="middle"
                style={{ fontSize: 28, fontWeight: 700, fill: hoveredSeg.color, fontFamily: "inherit" }}
              >
                {hoveredSeg.value}
              </text>
              <text
                x={CX} y={CY + 10}
                textAnchor="middle"
                style={{ fontSize: 10, fill: "#6b7280", fontFamily: "inherit" }}
              >
                {hoveredSeg.label}
              </text>
              <text
                x={CX} y={CY + 24}
                textAnchor="middle"
                style={{ fontSize: 10, fill: "#9ca3af", fontFamily: "inherit" }}
              >
                {(hoveredSeg.ratio * 100).toFixed(0)}%
              </text>
            </>
          ) : (
            <>
              <text
                x={CX} y={CY - 8}
                textAnchor="middle"
                style={{ fontSize: 30, fontWeight: 700, fill: "#1a1a1a", fontFamily: "inherit" }}
              >
                {total}
              </text>
              <text
                x={CX} y={CY + 14}
                textAnchor="middle"
                style={{ fontSize: 11, fill: "#9ca3af", fontFamily: "inherit" }}
              >
                total jobs
              </text>
            </>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="flex-1 grid grid-cols-1 gap-1.5 w-full">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`flex items-center gap-2.5 rounded-lg px-3 py-2 cursor-default transition-colors ${
              hovered === seg.label ? "bg-gray-100 dark:bg-white/10" : "hover:bg-gray-50 dark:hover:bg-white/5"
            }`}
            onMouseEnter={() => setHovered(seg.label)}
            onMouseLeave={() => setHovered(null)}
          >
            <span
              className="w-3 h-3 rounded-full shrink-0"
              style={{ backgroundColor: seg.color }}
            />
            <span className="flex-1 text-xs text-[var(--t-text2)] truncate">{seg.label}</span>
            <span className="text-xs font-bold text-[var(--t-text1)] tabular-nums">{seg.value}</span>
            <span className="text-[10px] text-[var(--t-muted)] w-8 text-right tabular-nums">
              {(seg.ratio * 100).toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Genesis KPI stat card ──────────────────────────────────────────────────────
function StatCard({ label, value, sub, Icon, iconBg, iconColor }) {
  return (
    <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 flex items-start gap-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover">
      {Icon && (
        <div
          className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: iconBg ?? "#EEF2FF", color: iconColor ?? "#6366F1" }}
        >
          <Icon size={18} />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--t-muted)]">{label}</p>
        <p className="mt-1 text-base font-bold font-display -tracking-tight text-[var(--t-text1)] leading-tight">{value}</p>
        {sub && <p className="mt-0.5 text-xs text-[var(--t-muted)]">{sub}</p>}
      </div>
    </div>
  );
}

// ── Finance bar chart — horizontal bars, magnitude comparison ────────────────
function FinanceBar({ label, value, max, color, sub }) {
  const pct = max > 0 ? Math.max((value / max) * 100, value > 0 ? 2 : 0) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="font-bold tabular-nums" style={{ color }}>{sub}</span>
      </div>
      <div className="h-3 w-full rounded-full bg-gray-100 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function FinanceChart({ totalRevenue, totalCashReceived, totalOutstanding, totalExpenditure, netMargin, GHSfmt }) {
  const max = Math.max(totalRevenue, totalCashReceived, totalExpenditure, 1);
  const bars = [
    { label: "Quoted revenue",    value: totalRevenue,       color: "#6366F1", sub: GHSfmt(totalRevenue) },
    { label: "Cash received",     value: totalCashReceived,  color: "#10B981", sub: GHSfmt(totalCashReceived) },
    { label: "Outstanding",       value: totalOutstanding,   color: "#F59E0B", sub: GHSfmt(totalOutstanding) },
    { label: "Expenditure",       value: totalExpenditure,   color: "#EF4444", sub: GHSfmt(totalExpenditure) },
    { label: netMargin >= 0 ? "Net profit" : "Net loss",
      value: Math.abs(netMargin),
      color: netMargin >= 0 ? "#10B981" : "#EF4444",
      sub: GHSfmt(Math.abs(netMargin)) },
  ];

  return (
    <div className="space-y-4">
      {bars.map((b) => (
        <FinanceBar key={b.label} {...b} max={max} />
      ))}
    </div>
  );
}

// ── Registered customers section ──────────────────────────────────────────────
const INITIAL_SHOW = 5;

function CustomersSection({ customers }) {
  const shown = customers.slice(0, INITIAL_SHOW);

  return (
    <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-sm font-semibold text-[var(--t-text1)]">Registered Customers</h2>
          <p className="text-xs text-[var(--t-muted)] mt-0.5">
            {customers.length} account{customers.length !== 1 ? "s" : ""}
          </p>
        </div>
        {customers.length > 0 && (
          <Link
            to="/admin?section=users"
            className="text-xs font-semibold text-[#6366F1] hover:underline"
          >
            View all →
          </Link>
        )}
      </div>

      {customers.length === 0 ? (
        <p className="text-sm text-[var(--t-muted)] italic">No customers registered yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            {shown.map((c) => (
              <div
                key={c.user_id}
                className="flex items-center gap-3 rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <div className="h-9 w-9 rounded-full bg-[#6366F1] flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-white">
                    {(c.full_name || "?").charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--t-text1)] truncate">
                    {c.full_name || "—"}
                  </p>
                  <p className="text-xs text-[var(--t-muted)] truncate">
                    {c.phone || c.email || "No contact info"}
                  </p>
                </div>
                <p className="text-xs text-[var(--t-muted)] shrink-0 whitespace-nowrap">
                  {new Date(c.created_at).toLocaleDateString("en-GH", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </div>
            ))}
          </div>

          {customers.length > INITIAL_SHOW && (
            <Link
              to="/admin?section=users"
              className="mt-3 block text-center text-xs font-semibold text-[#6366F1] hover:underline"
            >
              + {customers.length - INITIAL_SHOW} more · View all in Users
            </Link>
          )}
        </>
      )}
    </div>
  );
}

// ── Per-job financial helpers ─────────────────────────────────────────────────
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


// ── Main tab ──────────────────────────────────────────────────────────────────
export function AdminDashboardTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [jobSearch, setJobSearch] = useState("");
  const [period, setPeriod] = useState(defaultPeriod());

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
        <div
          className="h-8 w-8 rounded-full border-2 border-brand-cream/30 border-t-brand-red animate-spin"
          aria-label="Loading"
        />
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

  const { jobs: allJobs, expenditures: allExpenditures, profiles, payments: allPayments, customers } = data;

  // ── Period filtering ──────────────────────────────────────────────────────
  const jobs         = filterByPeriod(allJobs,         period, "created_at");
  const payments     = filterByPeriod(allPayments,     period, "date");
  const expenditures = filterByPeriod(allExpenditures, period, "date");

  // ── Financial totals ──────────────────────────────────────────────────────
  const totalRevenue      = jobs.reduce((sum, j) => sum + jobGrandTotal(j), 0);
  const totalCashReceived = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const totalOutstanding  = jobs.reduce((sum, j) => sum + Math.max(0, jobOutstanding(j)), 0);
  const totalExpenditure  = expenditures.reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const netMargin         = totalRevenue - totalExpenditure;

  // ── Staff count ───────────────────────────────────────────────────────────
  const activeStaff = profiles.filter(
    (p) => p.is_active !== false && p.role !== "customer"
  ).length;

  // ── Chart slices from CHART_STATUSES ──────────────────────────────────────
  const byStatus = {};
  for (const j of jobs) byStatus[j.status] = (byStatus[j.status] || 0) + 1;

  const chartSlices = CHART_STATUSES.map((cs) => ({
    ...cs,
    value: byStatus[cs.status] ?? 0,
  }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 space-y-6">

      {/* ── Period filter ── */}
      <PeriodPicker period={period} onChange={setPeriod} accentColor="#6366F1" bgVar="--t-bg" />

      {/* ── Top KPI row — 3×2 desktop, 2×3 phone ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <StatCard label="Quoted Revenue"   value={GHS(totalRevenue)}        sub="from all jobs"    Icon={BarChart2}   iconBg="#EEF2FF" iconColor="#6366F1" />
        <StatCard label="Cash Received"    value={GHS(totalCashReceived)}   sub="actual payments"  Icon={Banknote}    iconBg="#ECFDF5" iconColor="#10B981" />
        <StatCard label="Outstanding"      value={GHS(totalOutstanding)}    sub="unpaid balance"   Icon={AlertCircle} iconBg="#FFFBEB" iconColor="#F59E0B" />
        <StatCard label="Expenditure"      value={GHS(totalExpenditure)}    sub="all roles"        Icon={TrendingUp}  iconBg="#FFF1F2" iconColor="#EF4444" />
        <StatCard label="Net Margin"       value={GHS(Math.abs(netMargin))} sub={netMargin < 0 ? "net loss" : "net profit"} Icon={TrendingUp} iconBg={netMargin >= 0 ? "#ECFDF5" : "#FFF1F2"} iconColor={netMargin >= 0 ? "#10B981" : "#EF4444"} />
        <StatCard label="Active Jobs"      value={jobs.length}              sub={`${activeStaff} staff`} Icon={Briefcase} iconBg="#F5F3FF" iconColor="#8B5CF6" />
      </div>

      {/* ── Row 1: Donut + Finance charts ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Donut chart — job status distribution */}
        <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-[var(--t-text1)] mb-0.5">Jobs by status</h2>
          <p className="text-xs text-[var(--t-muted)] mb-4">Hover a segment or legend row for details.</p>
          <DonutChart slices={chartSlices} />
        </div>

        {/* Finance bar chart */}
        <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 sm:p-6">
          <h2 className="text-sm font-semibold text-[var(--t-text1)] mb-0.5">Financial overview</h2>
          <p className="text-xs text-[var(--t-muted)] mb-5">Revenue, collections, expenditure &amp; margin.</p>
          <FinanceChart
            totalRevenue={totalRevenue}
            totalCashReceived={totalCashReceived}
            totalOutstanding={totalOutstanding}
            totalExpenditure={totalExpenditure}
            netMargin={netMargin}
            GHSfmt={GHS}
          />
        </div>
      </div>

      {/* ── Row 2: Recent payments + Registered customers ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent payments */}
        <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-[var(--t-text1)]">Recent payments</h2>
            {payments.length > 0 && (
              <Link
                to="/accounts?tab=payments"
                className="text-xs font-semibold text-[#6366F1] hover:underline"
              >
                View all →
              </Link>
            )}
          </div>
          {payments.length === 0 ? (
            <p className="text-sm text-[var(--t-muted)]">No payments recorded yet.</p>
          ) : (
            <>
              <div className="space-y-2">
                {payments.slice(0, 5).map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border border-[var(--t-border)] bg-[var(--t-bg)] px-3 py-2.5 gap-3 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--t-text1)] truncate">
                        {p.jobs?.job_title || p.jobs?.quote_ref || "No job linked"}
                      </div>
                      <div className="text-xs text-[var(--t-muted)] mt-0.5">
                        {p.jobs?.client_name && <span>{p.jobs.client_name} · </span>}
                        {p.method} · {p.date}
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <div className="text-sm font-bold text-[var(--t-text1)]">{GHS(p.amount)}</div>
                      <span className={`mt-0.5 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${PAYMENT_TYPE_COLORS[p.type] ?? "bg-gray-100 text-gray-700 dark:bg-white/10 dark:text-gray-300"}`}>
                        {p.type}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {payments.length > 5 && (
                <Link
                  to="/accounts?tab=payments"
                  className="mt-3 block text-center text-xs font-semibold text-[#6366F1] hover:underline"
                >
                  + {payments.length - 5} more · View all in Accounts
                </Link>
              )}
            </>
          )}
        </div>

        {/* Registered customers */}
        <CustomersSection customers={customers ?? []} />
      </div>

      {/* ── Jobs table with search ── */}
      <div className="bg-[var(--t-surface)] rounded-xl border border-[var(--t-border)] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[var(--t-text1)]">Jobs</h2>
            <p className="text-xs text-[var(--t-muted)] mt-0.5">
              {jobs.length} job{jobs.length !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--t-muted)]" />
          <input
            type="text"
            placeholder="Search by job title, client or ref…"
            value={jobSearch}
            onChange={(e) => setJobSearch(e.target.value)}
            className="w-full rounded-xl border border-[var(--t-border)] bg-[var(--t-bg)] pl-9 pr-4 py-2.5 text-sm text-[var(--t-text1)] placeholder:text-[var(--t-muted)] focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 focus:border-[#6366F1] transition-colors"
          />
        </div>

        {jobs.length === 0 ? (
          <p className="text-sm text-[var(--t-muted)]">No jobs yet.</p>
        ) : (() => {
          const q = jobSearch.toLowerCase().trim();
          const allSorted = [...jobs].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
          const filtered = q
            ? allSorted.filter((j) =>
                (j.job_title ?? "").toLowerCase().includes(q) ||
                (j.client_name ?? "").toLowerCase().includes(q) ||
                (j.quote_ref ?? "").toLowerCase().includes(q))
            : allSorted.slice(0, 10);
          return filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-[var(--t-muted)]">No jobs match your search.</p>
          ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-[var(--t-muted)] border-b border-[var(--t-border)]">
                  <th className="py-2 pr-4 font-bold">Job</th>
                  <th className="py-2 pr-4 font-bold">Client</th>
                  <th className="py-2 pr-4 font-bold">Status</th>
                  <th className="py-2 pr-4 text-right font-bold">Total</th>
                  <th className="py-2 pr-4 text-right font-bold">Deposit due</th>
                  <th className="py-2 pr-4 text-right font-bold">Paid</th>
                  <th className="py-2 pr-4 text-right font-bold">Outstanding</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((job) => {
                  const total       = jobGrandTotal(job);
                  const totalPaid   = jobTotalPaid(job);
                  const outstanding = jobOutstanding(job);
                  return (
                    <tr key={job.id} className="border-b border-[var(--t-border)] hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                      <td className="py-2.5 pr-4 font-medium text-[var(--t-text1)]">
                        {job.job_title || "Untitled"}
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--t-text2)]">{job.client_name || "—"}</td>
                      <td className="py-2.5 pr-4">
                        <span className="rounded-full bg-indigo-50 dark:bg-indigo-900/20 px-2.5 py-0.5 text-[10px] font-semibold text-[#6366F1] dark:text-indigo-300">
                          {jobStatusLabel(job.status)}
                        </span>
                        {job.deadline && new Date(job.deadline) < new Date() && !["delivered","completed"].includes(job.status) && (
                          <span className="ml-1.5 rounded-full bg-red-50 dark:bg-red-900/20 px-2 py-0.5 text-[10px] font-semibold text-red-600 dark:text-red-400">
                            Overdue
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-medium text-[var(--t-text1)] whitespace-nowrap">
                        {GHS(total)}
                      </td>
                      <td className="py-2.5 pr-4 text-right text-[var(--t-muted)] whitespace-nowrap">
                        {GHS(job.deposit_amount)}
                      </td>
                      <td className="py-2.5 pr-4 text-right whitespace-nowrap">
                        <span className={totalPaid > 0 ? "font-medium text-emerald-600" : "text-[var(--t-muted)]"}>
                          {GHS(totalPaid)}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-medium whitespace-nowrap">
                        <span className={outstanding <= 0 ? "text-emerald-600" : "text-brand-red"}>
                          {outstanding <= 0 ? "Settled" : GHS(outstanding)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {!q && jobs.length > 10 && (
              <p className="mt-2 text-xs text-[var(--t-muted)] text-center">
                Showing 10 most recent. Search to find any job.
              </p>
            )}
          </div>
          );
        })()}
      </div>

    </div>
  );
}
