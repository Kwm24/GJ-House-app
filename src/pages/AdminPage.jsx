import { useState } from "react";
import { LobbyHeader } from "../components/LobbyHeader.jsx";
import { AdminSidebar } from "../components/admin/AdminSidebar.jsx";
import { AdminDashboardTab } from "../components/admin/AdminDashboardTab.jsx";
import { UsersTab } from "../components/admin/UsersTab.jsx";
import { SettingsTab } from "../components/admin/SettingsTab.jsx";
import { ArchiveTab } from "../components/admin/ArchiveTab.jsx";

export function AdminPage() {
  const [activeSection, setActiveSection] = useState("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-brand-dark">
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
          <div className="lg:hidden border-b border-white/10 px-4 py-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm font-medium text-brand-cream hover:bg-white/10 transition-colors"
            >
              <span aria-hidden="true">☰</span> Menu
            </button>
          </div>

          {activeSection === "dashboard" && <AdminDashboardTab />}
          {activeSection === "users" && <UsersTab />}
          {activeSection === "settings" && <SettingsTab />}
          {activeSection === "archive" && <ArchiveTab />}
        </div>
      </div>
    </div>
  );
}
