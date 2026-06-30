import { Link } from "react-router-dom";

const LOBBY_LINKS = [
  { label: "Customer Service", to: "/cs" },
  { label: "Production", to: "/production" },
  { label: "Designer", to: "/designer" },
  { label: "Accounts", to: "/accounts" },
  { label: "Customer Portal", to: "/customer" },
];

const ADMIN_SECTIONS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "users", label: "Users" },
  { id: "settings", label: "Settings" },
  { id: "archive", label: "Export / Archive" },
];

function SidebarNav({ activeSection, onSelectSection }) {
  return (
    <nav className="space-y-1">
      <p className="px-3 pt-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-cream/40">
        Lobbies
      </p>
      {LOBBY_LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          className="block rounded-lg px-3 py-2 text-sm font-medium text-brand-cream/70 hover:bg-white/10 hover:text-brand-cream transition-colors"
        >
          {link.label}
        </Link>
      ))}

      <p className="px-3 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-wide text-brand-cream/40">
        Administration
      </p>
      {ADMIN_SECTIONS.map((section) => (
        <button
          key={section.id}
          type="button"
          onClick={() => onSelectSection(section.id)}
          className={[
            "block w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-colors",
            activeSection === section.id
              ? "bg-brand-red text-white"
              : "text-brand-cream/70 hover:bg-white/10 hover:text-brand-cream",
          ].join(" ")}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

export function AdminSidebar({ activeSection, onSelectSection, open, onClose }) {
  return (
    <>
      <aside className="hidden lg:block lg:w-60 lg:shrink-0 border-r border-white/10 px-3 py-6">
        <SidebarNav activeSection={activeSection} onSelectSection={onSelectSection} />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-brand-dark border-r border-white/10 px-3 py-6 overflow-y-auto">
            <div className="flex items-center justify-between px-3 pb-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-red">
                Menu
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="text-brand-cream/70 hover:text-brand-cream"
              >
                ✕
              </button>
            </div>
            <SidebarNav
              activeSection={activeSection}
              onSelectSection={(id) => {
                onSelectSection(id);
                onClose();
              }}
            />
          </aside>
        </div>
      )}
    </>
  );
}
