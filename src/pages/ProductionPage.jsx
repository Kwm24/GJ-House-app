import { useEffect, useState } from "react";
import { LobbyHeader } from "../components/LobbyHeader.jsx";
import { useAuth } from "../components/AuthProvider.jsx";
import { ProductionJobsTab } from "../components/production/ProductionJobsTab.jsx";
import { MyProductionJobsTab } from "../components/production/MyProductionJobsTab.jsx";
import { ExpenditureRecorder } from "../components/ExpenditureRecorder.jsx";
import { ProductionDashboardTab } from "../components/production/ProductionDashboardTab.jsx";
import { DigitalRatesEditor } from "../components/DigitalRatesEditor.jsx";
import { getMyRatesPermission } from "../lib/myStats.js";
import { Hammer, LayoutGrid, Receipt, LayoutDashboard, SlidersHorizontal } from "lucide-react";

export function ProductionPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  // Production accounts the admin has allowed to edit Digital Print Quoter rates
  const [canEditRates, setCanEditRates] = useState(false);
  useEffect(() => {
    if (isAdmin) return;
    getMyRatesPermission().then(setCanEditRates).catch(() => setCanEditRates(false));
  }, [isAdmin]);

  const TABS = isAdmin
    ? [
        { id: "jobs",        label: "All Production Jobs", Icon: LayoutGrid },
        { id: "expenditure", label: "Expenditure",         Icon: Receipt    },
      ]
    : [
        { id: "dashboard",   label: "Dashboard",           Icon: LayoutDashboard },
        { id: "myjobs",      label: "My Jobs",             Icon: Hammer     },
        { id: "expenditure", label: "Expenditure",         Icon: Receipt    },
        ...(canEditRates ? [{ id: "rates", label: "Digital rates", Icon: SlidersHorizontal }] : []),
      ];

  const [activeTab,  setActiveTab]  = useState(isAdmin ? "jobs" : "dashboard");
  const [focusJobId, setFocusJobId] = useState(null);

  function handleNavigateToJob(jobId) {
    setActiveTab(isAdmin ? "jobs" : "myjobs");
    setFocusJobId(jobId);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--t-bg)" }}>
      <LobbyHeader
        title="Production"
        subtitle={
          isAdmin
            ? "Assign jobs to producers and track all press runs"
            : "Press runs, schedules & job tracking"
        }
        onNavigateToJob={handleNavigateToJob}
      />

      <div
        className="sticky top-14 z-10 border-b backdrop-blur-sm px-4 sm:px-6 py-3"
        style={{ background: "var(--t-nav-bg)", borderColor: "var(--t-border)" }}
      >
        <div className="mx-auto max-w-6xl">
          <nav
            className="flex items-center gap-1 p-1 bg-[var(--t-surface)] border border-[var(--t-border)] rounded-xl overflow-x-auto scrollbar-none"
            aria-label="Production sections"
          >
            {TABS.map(({ id, label, Icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={[
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150 whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-red/40",
                  activeTab === id
                    ? "bg-brand-red text-white shadow-sm"
                    : "text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/5",
                ].join(" ")}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      <div className="min-h-[calc(100vh-8rem)] animate-fade-in">
        {activeTab === "dashboard"   && <ProductionDashboardTab onOpenJob={handleNavigateToJob} />}
        {activeTab === "jobs"        && <ProductionJobsTab />}
        {activeTab === "myjobs"      && <MyProductionJobsTab focusJobId={focusJobId} />}
        {activeTab === "expenditure" && <ExpenditureRecorder recordedBy="production" />}
        {activeTab === "rates" && canEditRates && (
          <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
            <DigitalRatesEditor asProduction />
          </div>
        )}
      </div>
    </div>
  );
}
