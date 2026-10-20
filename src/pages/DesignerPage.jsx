import { useState } from "react";
import { LobbyHeader } from "../components/LobbyHeader.jsx";
import { useAuth } from "../components/AuthProvider.jsx";
import { DesignerJobsTab } from "../components/designer/DesignerJobsTab.jsx";
import { MyDesignJobsTab } from "../components/designer/MyDesignJobsTab.jsx";
import { DesignHistoryTab } from "../components/designer/DesignHistoryTab.jsx";
import { LayoutGrid, Pen, Clock } from "lucide-react";

export function DesignerPage() {
  const { profile } = useAuth();
  const isAdmin = profile?.role === "admin";

  const TABS = isAdmin
    ? [
        { id: "jobs",    label: "All Design Jobs", Icon: LayoutGrid },
        { id: "history", label: "Design History",  Icon: Clock      },
      ]
    : [
        { id: "myjobs",  label: "My Jobs",         Icon: Pen        },
        { id: "history", label: "Design History",  Icon: Clock      },
      ];

  const [activeTab,  setActiveTab]  = useState(isAdmin ? "jobs" : "myjobs");
  const [focusJobId, setFocusJobId] = useState(null);

  function handleNavigateToJob(jobId) {
    setActiveTab(isAdmin ? "jobs" : "myjobs");
    setFocusJobId(jobId);
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--t-bg)" }}>
      <LobbyHeader
        title="Design Studio"
        subtitle={
          isAdmin
            ? "Assign jobs to designers and review all design work"
            : "Artwork, proofs & pre-press files"
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
            aria-label="Designer sections"
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
        {activeTab === "jobs"    && <DesignerJobsTab />}
        {activeTab === "myjobs"  && <MyDesignJobsTab focusJobId={focusJobId} />}
        {activeTab === "history" && <DesignHistoryTab />}
      </div>
    </div>
  );
}
