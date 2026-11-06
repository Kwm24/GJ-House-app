/**
 * CSDashboardTab.jsx
 * Personal dashboard for a Customer Service account: the quotations, invoices
 * and saved print quotes this person created, how many got paid, and which
 * sent documents need a follow-up.
 */
import { useEffect, useMemo, useState } from "react";
import { getMyCSStats } from "../../lib/myStats.js";
import { formatGHS as GHS } from "../../lib/currency.js";
import { filterByPeriod, defaultPeriod } from "../PeriodPicker.jsx";
import { DashboardShell, StatGrid, StatTile, Panel, CountBars, RowList } from "../dashboard/DashboardKit.jsx";
import { fmtShortDate, periodLabel } from "../../lib/dashboardUtils.js";
import { useAuth } from "../AuthProvider.jsx";

const FOLLOW_UP_DAYS = 7;
const TYPE_LABEL = { quote: "Quotation", invoice: "Invoice", receipt: "Receipt" };
const STATUS_ROWS = [
  { value: "draft",     label: "Draft" },
  { value: "sent",      label: "Sent" },
  { value: "paid",      label: "Paid" },
  { value: "cancelled", label: "Cancelled" },
];

const sum = (arr) => arr.reduce((s, d) => s + Number(d.total || 0), 0);

export function CSDashboardTab({ onOpenInvoice }) {
  const { profile } = useAuth();
  const [period,  setPeriod]  = useState(defaultPeriod);
  const [data,    setData]    = useState({ documents: [], savedQuotes: [] });
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  useEffect(() => {
    getMyCSStats()
      .then(setData)
      .catch((err) => setError(err.message ?? "Could not load your stats."))
      .finally(() => setLoading(false));
  }, []);

  const s = useMemo(() => {
    const docs    = filterByPeriod(data.documents, period);
    const quotes  = docs.filter((d) => d.type === "quote");
    const invs    = docs.filter((d) => d.type === "invoice");
    const paid    = docs.filter((d) => d.status === "paid");
    const issued  = docs.filter((d) => d.type !== "receipt" && d.status !== "cancelled");
    const saved   = filterByPeriod(data.savedQuotes, period);

    // Follow-ups look at everything, not just this period: sent, unpaid, older than a week
    const cutoff = Date.now() - FOLLOW_UP_DAYS * 86400000;
    const followUps = data.documents
      .filter((d) => d.status === "sent" && new Date(d.created_at).getTime() < cutoff)
      .slice(0, 6);
    const outstanding = data.documents.filter((d) => d.type === "invoice" && d.status === "sent");

    return {
      quotes, invs, paid, saved, followUps, outstanding,
      conversion: issued.length ? Math.round((paid.length / issued.length) * 100) : null,
      byStatus: STATUS_ROWS.map((r) => ({ label: r.label, value: docs.filter((d) => d.status === r.value).length })),
      recent: docs.slice(0, 6),
    };
  }, [data, period]);

  const when = periodLabel(period);

  return (
    <DashboardShell
      title={profile?.full_name ? `${profile.full_name.split(" ")[0]}'s CS stats` : "Your CS stats"}
      subtitle={`Documents and quotes you created · ${when}`}
      period={period} onPeriodChange={setPeriod}
      loading={loading} error={error}
    >
      <StatGrid>
        <StatTile label="Quotations" value={s.quotes.length} sub={GHS(sum(s.quotes))} />
        <StatTile label="Invoices" value={s.invs.length} sub={GHS(sum(s.invs))} />
        <StatTile label="Paid" value={s.paid.length}
          sub={s.conversion == null ? GHS(sum(s.paid)) : `${GHS(sum(s.paid))} · ${s.conversion}% converted`} />
        <StatTile label="Print quotes saved" value={s.saved.length}
          sub={`${s.saved.filter((q) => q.quote_type === "offset").length} offset · ${s.saved.filter((q) => q.quote_type === "digital").length} digital`} />
      </StatGrid>

      <StatGrid>
        <StatTile label="Unpaid invoices" value={s.outstanding.length} sub={`${GHS(sum(s.outstanding))} awaiting payment · all time`} />
        <StatTile label="Need a follow-up" value={s.followUps.length}
          sub={`Sent over ${FOLLOW_UP_DAYS} days ago, still unpaid`}
          alert={s.followUps.length ? "Chase these up" : null} />
      </StatGrid>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title={`Your documents by status · ${when}`}>
          <CountBars rows={s.byStatus} emptyText="No documents in this period." />
        </Panel>

        <Panel title="Follow up">
          <RowList
            items={s.followUps}
            empty="Nothing waiting. Nice work."
            render={(d) => <DocRow d={d} onOpen={onOpenInvoice} />}
          />
        </Panel>
      </div>

      <Panel title={`Recent documents · ${when}`}>
        <RowList
          items={s.recent}
          empty="You haven't created any documents in this period."
          render={(d) => <DocRow d={d} onOpen={onOpenInvoice} />}
        />
      </Panel>
    </DashboardShell>
  );
}

function DocRow({ d, onOpen }) {
  const body = (
    <>
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-[var(--t-text1)]">{d.client_name || "No client"}</p>
        <p className="truncate text-xs text-[var(--t-text2)]">
          <span className="font-mono">{d.ref}</span> · {TYPE_LABEL[d.type] ?? d.type} · {fmtShortDate(d.created_at)}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-medium tabular-nums text-[var(--t-text1)]">{GHS(d.total)}</p>
        <p className="text-[11px] capitalize text-[var(--t-muted)]">{d.status}</p>
      </div>
    </>
  );
  if (!onOpen) return body;
  return (
    <button type="button" onClick={() => onOpen(d)}
      className="-mx-2 flex w-[calc(100%+1rem)] items-center justify-between gap-3 rounded-md px-2 py-1 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5">
      {body}
    </button>
  );
}
