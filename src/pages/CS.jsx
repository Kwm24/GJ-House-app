import { useState } from "react";
import { LobbyHeader } from "../components/LobbyHeader.jsx";
import { QuotesTab } from "../components/cs/QuotesTab.jsx";
import { InvoicesTab } from "../components/cs/InvoicesTab.jsx";
import { ItemsTab } from "../components/cs/ItemsTab.jsx";
import { ExpenditureRecorder } from "../components/ExpenditureRecorder.jsx";
import { SentTab } from "../components/cs/SentTab.jsx";
import { ResourcesTab } from "../components/cs/ResourcesTab.jsx";

const TABS = [
  { id: "quotes",      label: "Print Quotes" },
  { id: "invoices",    label: "Invoices"     },
  { id: "items",       label: "Items"        },
  { id: "expenditure", label: "Expenditure"  },
  { id: "sent",        label: "Sent"         },
  { id: "resources",   label: "Resources"    },
];

export function CS() {
  const [activeTab, setActiveTab] = useState("quotes");

  return (
    <div className="min-h-screen bg-brand-dark">
      <LobbyHeader
        title="Customer Service"
        subtitle="Quotes, expenditure & client communications"
      />

      <nav
        className="border-b border-white/10 bg-brand-dark/95 backdrop-blur-sm sticky top-[var(--lobby-header-offset,0)] z-10"
        aria-label="CS sections"
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
        {activeTab === "quotes"      && <QuotesTab />}
        {activeTab === "invoices"    && <InvoicesTab />}
        {activeTab === "items"       && <ItemsTab />}
        {activeTab === "expenditure" && <ExpenditureRecorder recordedBy="cs" />}
        {activeTab === "sent"        && <SentTab />}
        {activeTab === "resources"   && <ResourcesTab />}
      </div>
    </div>
  );
}
