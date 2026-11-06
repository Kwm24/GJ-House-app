/**
 * ProductionDashboardTab.jsx
 * Personal dashboard for a Production account: the jobs assigned to this
 * producer (workload, overdue, due soon, by stage) and expenses they recorded.
 */
import { useEffect, useMemo, useState } from "react";
import { getMyProductionStats } from "../../lib/myStats.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";
import { DashboardShell, StatGrid, StatTile, Panel, CountBars, RowList } from "../dashboard/DashboardKit.jsx";
import { startOfToday, fmtShortDate, periodLabel } from "../../lib/dashboardUtils.js";
import { useAuth } from "../AuthProvider.jsx";

const DONE = ["delivered", "completed"];
const STAGES = ["approved", "in_production", "at_finishing", "ready_for_pickup"];

export function ProductionDashboardTab({ onOpenJob }) {
  const { profile } = useAuth();
  const [period,  setPeriod]  = useState(defaultPeriod);
  const [data,    setData]    = useState({ jobs: [], expenditures: [] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    getMyProductionStats()
      .then(setData)
      .catch((err) => setError(err.message ?? "Could not load your stats."))
      .finally(() => setLoading(false));
  }, []);

  const s = useMemo(() => {
    const today  = startOfToday();
    const week   = new Date(today.getTime() + 7 * 86400000);
    const active = data.jobs.filter((j) => !DONE.includes(j.status));
    const due    = (j) => (j.deadline ? new Date(`${j.deadline}T00:00:00`) : null);
    const overdue = active.filter((j) => due(j) && due(j) < today);
    const soon    = active.filter((j) => due(j) && due(j) >= today && due(j) <= week);

    const periodJobs = filterByPeriod(data.jobs, period);
    const periodExp  = filterByPeriod(data.expenditures, period, "date");

    const upcoming = active
      .filter((j) => j.deadline)
      .sort((a, b) => due(a) - due(b))
      .slice(0, 8);

    return {
      active, overdue, soon, upcoming,
      assigned:  periodJobs.length,
      finished:  periodJobs.filter((j) => DONE.includes(j.status)).length,
      expTotal:  periodExp.reduce((t, e) => t + Number(e.amount || 0), 0),
      expCount:  periodExp.length,
      byStage:   STAGES.map((st) => ({ label: jobStatusLabel(st), value: active.filter((j) => j.status === st).length })),
      today,
    };
  }, [data, period]);

  const when = periodLabel(period);

  return (
    <DashboardShell
      title={profile?.full_name ? `${profile.full_name.split(" ")[0]}'s production stats` : "Your production stats"}
      subtitle={`Jobs assigned to you · ${when}`}
      period={period} onPeriodChange={setPeriod}
      loading={loading} error={error}
    >
      <StatGrid>
        <StatTile label="Active jobs" value={s.active.length} sub="On your bench now" />
        <StatTile label="Overdue" value={s.overdue.length} sub="Past their deadline"
          alert={s.overdue.length ? "Needs attention" : null} />
        <StatTile label="Due in 7 days" value={s.soon.length} sub="Deadlines this week" />
        <StatTile label="Expenses recorded" value={GHS(s.expTotal)} sub={`${s.expCount} entr${s.expCount === 1 ? "y" : "ies"} · ${when}`} />
      </StatGrid>

      <StatGrid>
        <StatTile label="Jobs assigned" value={s.assigned} sub={`Received · ${when}`} />
        <StatTile label="Collected or completed" value={s.finished} sub={`Of the jobs received · ${when}`} />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Active jobs by stage">
          <CountBars rows={s.byStage} emptyText="No active jobs. You're all caught up." />
        </Panel>

        <Panel title="Upcoming deadlines">
          <RowList
            items={s.upcoming}
            empty="No deadlines set on your active jobs."
            render={(j) => {
              const late = new Date(`${j.deadline}T00:00:00`) < s.today;
              return (
                <button type="button" onClick={() => onOpenJob?.(j.id)} disabled={!onOpenJob}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-gray-50 disabled:cursor-default dark:hover:bg-white/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--t-text1)]">{j.job_title || "Print job"}</p>
                    <p className="truncate text-xs text-[var(--t-text2)]">
                      {j.client_name || "No client"} · {jobStatusLabel(j.status)}
                    </p>
                  </div>
                  <p className={`shrink-0 text-xs font-medium tabular-nums ${late ? "text-red-600 dark:text-red-400" : "text-[var(--t-text2)]"}`}>
                    {late ? "Overdue · " : ""}{fmtShortDate(j.deadline)}
                  </p>
                </button>
              );
            }}
          />
        </Panel>
      </div>
    </DashboardShell>
  );
}
