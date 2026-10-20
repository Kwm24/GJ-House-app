import { useState } from "react";
import { LobbyHeader } from "../components/LobbyHeader.jsx";
import { QuotesTab } from "../components/cs/QuotesTab.jsx";
import { InvoicesTab } from "../components/cs/InvoicesTab.jsx";
import { ItemsTab } from "../components/cs/ItemsTab.jsx";
import { ExpenditureRecorder } from "../components/ExpenditureRecorder.jsx";
import { SentTab } from "../components/cs/SentTab.jsx";
import { JobsTab } from "../components/cs/JobsTab.jsx";
import { ResourcesTab } from "../components/cs/ResourcesTab.jsx";
import { CustomersTab } from "../components/cs/CustomersTab.jsx";
import { Calculator, FileText, Briefcase, Package, Receipt, Send, FolderOpen, Users } from "lucide-react";

const TABS = [
  { id: "quotes",      label: "Print Quotes", Icon: Calculator  },
  { id: "invoices",    label: "Invoices",     Icon: FileText    },
  { id: "jobs",        label: "Jobs",         Icon: Briefcase   },
  { id: "customers",   label: "Customers",    Icon: Users       },
  { id: "items",       label: "Items",        Icon: Package     },
  { id: "expenditure", label: "Expenditure",  Icon: Receipt     },
  { id: "sent",        label: "Sent",         Icon: Send        },
  { id: "resources",   label: "Resources",    Icon: FolderOpen  },
];

export function CS() {
  const [activeTab,     setActiveTab]     = useState("quotes");
  const [focusJobId,     setFocusJobId]   = useState(null);
  const [focusInvoiceId, setFocusInvoiceId] = useState(null);

  function handleNavigateToJob(jobId) {
    setFocusJobId(jobId);
    setActiveTab("jobs");
  }

  function handleNavigateToInvoice(invoice) {
    setFocusInvoiceId(invoice?.id ?? invoice ?? null);
    setActiveTab("invoices");
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--t-bg)" }}>
      <LobbyHeader
        title="Customer Service"
        subtitle="Quotes, expenditure & client communications"
        onNavigateToJob={handleNavigateToJob}
      />

      <div
        className="sticky top-14 z-10 border-b backdrop-blur-sm px-4 sm:px-6 py-3"
        style={{ background: "var(--t-nav-bg)", borderColor: "var(--t-border)" }}
      >
        <div className="mx-auto max-w-6xl">
          <nav
            className="flex items-center gap-1 p-1 bg-[var(--t-surface)] border border-[var(--t-border)] rounded-xl overflow-x-auto scrollbar-none"
            aria-label="CS sections"
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
        {activeTab === "quotes"      && <QuotesTab />}
        {activeTab === "invoices"    && (
          <InvoicesTab
            focusInvoiceId={focusInvoiceId}
            onFocusConsumed={() => setFocusInvoiceId(null)}
          />
        )}
        {activeTab === "jobs"        && <JobsTab focusJobId={focusJobId} />}
        {activeTab === "customers"   && (
          <CustomersTab
            onJobClick={handleNavigateToJob}
            onInvoiceClick={handleNavigateToInvoice}
          />
        )}
        {activeTab === "items"       && <ItemsTab />}
        {activeTab === "expenditure" && <ExpenditureRecorder recordedBy="cs" />}
        {activeTab === "sent"        && <SentTab />}
        {activeTab === "resources"   && <ResourcesTab />}
      </div>
    </div>
  );
}
