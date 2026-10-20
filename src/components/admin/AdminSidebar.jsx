import { Link } from "react-router-dom";
import { Headphones, Hammer, Pen, CreditCard, User, BarChart2, Users, Settings, Archive, Globe, X } from "lucide-react";

const LOBBY_LINKS = [
  { label: "Customer Service", to: "/cs",         Icon: Headphones },
  { label: "Production",       to: "/production",  Icon: Hammer     },
  { label: "Designer",         to: "/designer",    Icon: Pen        },
  { label: "Accounts",         to: "/accounts",    Icon: CreditCard },
  { label: "Customer Portal",  to: "/customer",    Icon: User       },
];

const ADMIN_SECTIONS = [
  { id: "dashboard", label: "Dashboard",        Icon: BarChart2 },
  { id: "users",     label: "Users",            Icon: Users     },
  { id: "settings",  label: "Settings",         Icon: Settings  },
  { id: "landing",   label: "Landing Page",     Icon: Globe     },
  { id: "archive",   label: "Export / Archive", Icon: Archive   },
];

function SidebarNav({ activeSection, onSelectSection }) {
  return (
    <nav className="space-y-0.5">
      <p className="px-3 pt-2 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--t-muted)]">
        Lobbies
      </p>
      {LOBBY_LINKS.map(({ label, to, Icon }) => (
        <Link
          key={to}
          to={to}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/10 hover:text-[var(--t-text1)] transition-colors"
        >
          <Icon size={14} className="shrink-0" />
          {label}
        </Link>
      ))}

      <p className="px-3 pt-5 pb-1.5 text-[10px] font-bold uppercase tracking-[0.12em] text-[var(--t-muted)]">
        Administration
      </p>
      {ADMIN_SECTIONS.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          onClick={() => onSelectSection(id)}
          className={[
            "flex items-center gap-2.5 w-full text-left rounded-lg px-3 py-2 text-sm font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366F1]",
            activeSection === id
              ? "bg-[#6366F1] text-white shadow-sm"
              : "text-[var(--t-text2)] hover:bg-gray-100 dark:hover:bg-white/10 hover:text-[var(--t-text1)]",
          ].join(" ")}
        >
          <Icon size={14} className="shrink-0" />
          {label}
        </button>
      ))}
    </nav>
  );
}

export function AdminSidebar({ activeSection, onSelectSection, open, onClose }) {
  return (
    <>
      <aside className="hidden lg:block lg:w-60 lg:shrink-0 border-r border-[var(--t-border)] px-3 py-6">
        <SidebarNav activeSection={activeSection} onSelectSection={onSelectSection} />
      </aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-30">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={onClose}
            aria-hidden="true"
          />
          <aside className="absolute inset-y-0 left-0 w-64 bg-[var(--t-surface)] border-r border-[var(--t-border)] px-3 py-6 overflow-y-auto animate-slide-down">
            <div className="flex items-center justify-between px-3 pb-4">
              <span className="text-xs font-semibold uppercase tracking-wide text-brand-red">
                Menu
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="text-[var(--t-muted)] hover:text-[var(--t-text1)] transition-colors"
              >
                <X size={16} />
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
