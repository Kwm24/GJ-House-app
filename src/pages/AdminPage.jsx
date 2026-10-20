import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { LobbyHeader } from "../components/LobbyHeader.jsx";
import { AdminSidebar } from "../components/admin/AdminSidebar.jsx";
import { AdminDashboardTab } from "../components/admin/AdminDashboardTab.jsx";
import { UsersTab } from "../components/admin/UsersTab.jsx";
import { SettingsTab } from "../components/admin/SettingsTab.jsx";
import { ArchiveTab } from "../components/admin/ArchiveTab.jsx";
import { LandingPageTab } from "../components/admin/LandingPageTab.jsx";

export function AdminPage() {
  const [searchParams] = useSearchParams();
  const [activeSection, setActiveSection] = useState(() => {
    const s = searchParams.get("section");
    return ["dashboard", "users", "settings", "landing", "archive"].includes(s) ? s : "dashboard";
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen" style={{ background: "var(--t-bg)" }}>
      <LobbyHeader
        title="Administration"
        subtitle="Users, roles & system settings"
      />

      <div className="lg:flex">
        <AdminSidebar
          activeSection={activeSection}
          onSelectSection={setActiveSection}
          open={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 min-w-0">
          <div className="lg:hidden border-b border-[var(--t-border)] px-4 py-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-[var(--t-border)] bg-[var(--t-surface)] px-3 py-2 text-sm font-medium text-[var(--t-text1)] hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
            >
              <span aria-hidden="true">☰</span> Menu
            </button>
          </div>

          {activeSection === "dashboard" && <AdminDashboardTab />}
          {activeSection === "users" && <UsersTab />}
          {activeSection === "settings" && <SettingsTab />}
          {activeSection === "landing" && <LandingPageTab />}
          {activeSection === "archive" && <ArchiveTab />}
        </div>
      </div>
    </div>
  );
}
