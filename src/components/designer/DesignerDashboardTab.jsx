/**
 * DesignerDashboardTab.jsx
 * Personal dashboard for a Designer account: jobs assigned to this designer by
 * design stage, designs awaiting the customer's approval, approvals won, and
 * design files uploaded.
 */
import { useEffect, useMemo, useState } from "react";
import { getMyDesignerStats } from "../../lib/myStats.js";
import { jobStatusLabel } from "../../lib/jobStatus.js";
import { filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";
import { DashboardShell, StatGrid, StatTile, Panel, CountBars, RowList } from "../dashboard/DashboardKit.jsx";
import { startOfToday, fmtShortDate, periodLabel } from "../../lib/dashboardUtils.js";
import { useAuth } from "../AuthProvider.jsx";

const DONE = ["delivered", "completed"];

// Where a job sits from the designer's point of view
function designStage(j) {
  if (j.design_approved) return "approved";
  if (j.status === "ready_for_design") return "to_design";
  if (j.status === "design_ready") return "with_customer";
  return "other";
}

export function DesignerDashboardTab({ onOpenJob }) {
  const { profile } = useAuth();
  const [period,  setPeriod]  = useState(defaultPeriod);
  const [data,    setData]    = useState({ jobs: [], uploads: [] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    getMyDesignerStats()
      .then(setData)
      .catch((err) => setError(err.message ?? "Could not load your stats."))
      .finally(() => setLoading(false));
  }, []);

  const s = useMemo(() => {
    const today = startOfToday();
    const due   = (j) => (j.deadline ? new Date(`${j.deadline}T00:00:00`) : null);
    const open  = data.jobs.filter((j) => !DONE.includes(j.status) && !j.design_approved);

    const toDesign     = data.jobs.filter((j) => designStage(j) === "to_design");
    const withCustomer = data.jobs.filter((j) => designStage(j) === "with_customer");
    const overdue      = open.filter((j) => due(j) && due(j) < today);

    const periodJobs = filterByPeriod(data.jobs, period);
    const uploads    = filterByPeriod(data.uploads, period);

    const queue = [...toDesign, ...withCustomer]
      .sort((a, b) => (due(a) ?? Infinity) - (due(b) ?? Infinity))
      .slice(0, 8);

    return {
      toDesign, withCustomer, overdue, queue, today,
      received: periodJobs.length,
      approved: periodJobs.filter((j) => j.design_approved).length,
      uploads:  uploads.length,
      uploadJobs: new Set(uploads.map((u) => u.job_id)).size,
      byStage: [
        { label: "To design",      value: toDesign.length },
        { label: "With customer",  value: withCustomer.length },
        { label: "Approved",       value: data.jobs.filter((j) => designStage(j) === "approved").length },
      ],
    };
  }, [data, period]);

  const when = periodLabel(period);

  return (
    <DashboardShell
      title={profile?.full_name ? `${profile.full_name.split(" ")[0]}'s design stats` : "Your design stats"}
      subtitle={`Design jobs assigned to you · ${when}`}
      period={period} onPeriodChange={setPeriod}
      loading={loading} error={error}
    >
      <StatGrid>
        <StatTile label="To design" value={s.toDesign.length} sub="Waiting for your artwork" />
        <StatTile label="With customer" value={s.withCustomer.length} sub="Awaiting their approval" />
        <StatTile label="Overdue" value={s.overdue.length} sub="Open jobs past deadline"
          alert={s.overdue.length ? "Needs attention" : null} />
        <StatTile label="Files uploaded" value={s.uploads}
          sub={`Across ${s.uploadJobs} job${s.uploadJobs === 1 ? "" : "s"} · ${when}`} />
      </StatGrid>

      <StatGrid>
        <StatTile label="Jobs received" value={s.received} sub={`Assigned · ${when}`} />
        <StatTile label="Designs approved" value={s.approved}
          sub={s.received ? `${Math.round((s.approved / s.received) * 100)}% of jobs received` : `Of jobs received · ${when}`} />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Your design jobs by stage · all time">
          <CountBars rows={s.byStage} emptyText="No design jobs assigned to you yet." />
        </Panel>

        <Panel title="Your queue">
          <RowList
            items={s.queue}
            empty="Queue clear. Nothing to design or chase."
            render={(j) => {
              const late = j.deadline && new Date(`${j.deadline}T00:00:00`) < s.today;
              return (
                <button type="button" onClick={() => onOpenJob?.(j.id)} disabled={!onOpenJob}
                  className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-gray-50 disabled:cursor-default dark:hover:bg-white/5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-[var(--t-text1)]">{j.job_title || "Design job"}</p>
                    <p className="truncate text-xs text-[var(--t-text2)]">
                      {j.client_name || "No client"} · {designStage(j) === "to_design" ? "To design" : jobStatusLabel(j.status)}
                    </p>
                  </div>
                  <p className={`shrink-0 text-xs font-medium tabular-nums ${late ? "text-red-600 dark:text-red-400" : "text-[var(--t-text2)]"}`}>
                    {j.deadline ? `${late ? "Overdue · " : ""}${fmtShortDate(j.deadline)}` : "No deadline"}
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
