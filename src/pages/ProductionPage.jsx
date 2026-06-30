import { useState } from "react";
import { LobbyHeader } from "../components/LobbyHeader.jsx";
import { ProductionJobsTab } from "../components/production/ProductionJobsTab.jsx";
import { ExpenditureRecorder } from "../components/ExpenditureRecorder.jsx";

const TABS = [
  { id: "jobs", label: "Jobs" },
  { id: "expenditure", label: "Expenditure" },
];

export function ProductionPage() {
  const [activeTab, setActiveTab] = useState("jobs");

  return (
    <div className="min-h-screen bg-brand-dark">
      <LobbyHeader
        title="Production"
        subtitle="Press runs, schedules & job tracking"
      />

      <nav
        className="border-b border-white/10 bg-brand-dark/95 backdrop-blur-sm sticky top-[var(--lobby-header-offset,0)] z-10"
        aria-label="Production sections"
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
                    ? "border-brand-red text-brand-cream"
                    : "border-transparent text-brand-cream/50 hover:text-brand-cream/80",
                ].join(" ")}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="min-h-[calc(100vh-8rem)]">
        {activeTab === "jobs" && <ProductionJobsTab />}
        {activeTab === "expenditure" && <ExpenditureRecorder recordedBy="production" />}
      </div>
    </div>
  );
}
