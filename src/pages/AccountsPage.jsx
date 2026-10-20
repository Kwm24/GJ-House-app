import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LobbyHeader } from "../components/LobbyHeader.jsx";
import { JobsTab } from "../components/accounts/JobsTab.jsx";
import { ExpenditureTab } from "../components/accounts/ExpenditureTab.jsx";
import { PaymentsTab } from "../components/accounts/PaymentsTab.jsx";
import { SummaryTab } from "../components/accounts/SummaryTab.jsx";
import { DigitalJobsTab } from "../components/accounts/DigitalJobsTab.jsx";

const TABS = [
  { id: "jobs",         label: "Jobs" },
  { id: "digital",     label: "Digital Jobs" },
  { id: "expenditure", label: "Expenditure" },
  { id: "payments",    label: "Payments" },
  { id: "summary",     label: "Summary" },
];

export function AccountsPage() {
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(() => {
    const t = searchParams.get("tab");
    return TABS.some((tab) => tab.id === t) ? t : "jobs";
  });

  return (
    <div className="min-h-screen" style={{ background: "var(--t-bg)" }}>
      <LobbyHeader
        title="Accounts"
        subtitle="Invoices, payments & financial records"
      />

      <nav
        className="border-b border-[var(--t-border)] sticky top-[var(--lobby-header-offset,0)] z-10 backdrop-blur-sm"
        style={{ background: "color-mix(in srgb, var(--t-surface) 95%, transparent)" }}
        aria-label="Accounts sections"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex gap-1 sm:gap-2 -mb-px overflow-x-auto scrollbar-none">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={[
                  "shrink-0 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                  activeTab === tab.id
                    ? "border-brand-red text-[var(--t-text1)]"
                    : "border-transparent text-[var(--t-muted)] hover:text-[var(--t-text2)]",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="min-h-[calc(100vh-8rem)]">
        {activeTab === "jobs"         && <JobsTab />}
        {activeTab === "digital"      && (
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <DigitalJobsTab />
          </div>
        )}
        {activeTab === "expenditure" && <ExpenditureTab />}
        {activeTab === "payments" && <PaymentsTab />}
        {activeTab === "summary" && <SummaryTab />}
      </div>
    </div>
  );
}
