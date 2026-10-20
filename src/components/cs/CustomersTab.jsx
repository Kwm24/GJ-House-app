import { useState, useEffect } from "react";
import { Search, UserRound } from "lucide-react";
import { listCustomers } from "../../lib/auth.js";
import { CustomerProfilePanel } from "../CustomerProfilePanel.jsx";

export function CustomersTab({ onJobClick, onInvoiceClick }) {
  const [customers, setCustomers] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState("");
  const [q,         setQ]         = useState("");
  const [selected,  setSelected]  = useState(null);

  useEffect(() => {
    setLoading(true);
    setError("");
    listCustomers()
      .then(setCustomers)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const filtered = q.trim()
    ? customers.filter((c) =>
        (c.full_name ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (c.email     ?? "").toLowerCase().includes(q.toLowerCase()) ||
        (c.phone     ?? "").toLowerCase().includes(q.toLowerCase())
      )
    : customers;

  const fmtDate = (s) =>
    s ? new Date(s).toLocaleDateString("en-GH", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
      <div
        className="rounded-xl border p-5 sm:p-8"
        style={{ background: "var(--t-surface)", borderColor: "var(--t-border)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-semibold" style={{ color: "var(--t-text1)" }}>
              Customers
            </h2>
            <p className="mt-1 text-sm" style={{ color: "var(--t-muted)" }}>
              Registered customer accounts. Click a row to view their profile, jobs, and documents.
            </p>
          </div>
          <span
            className="rounded-full px-3 py-1 text-xs font-medium bg-[#6366F1]/10 text-[#6366F1]"
          >
            {customers.length} total
          </span>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: "var(--t-muted)" }} />
          <input
            type="text"
            placeholder="Search by name, email or phone…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full rounded-xl border pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#6366F1]/20 transition-colors"
            style={{
              borderColor: "var(--t-border)",
              background:  "var(--t-bg)",
              color:       "var(--t-text1)",
            }}
          />
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="h-8 w-8 rounded-full border-2 border-[#6366F1]/30 border-t-[#6366F1] animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center py-12 gap-3" style={{ color: "var(--t-muted)" }}>
            <UserRound size={28} className="opacity-40" />
            <p className="text-sm">{q ? "No customers match your search." : "No customers yet."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr
                  className="text-left text-xs uppercase tracking-wide border-b"
                  style={{ color: "var(--t-muted)", borderColor: "var(--t-border)" }}
                >
                  <th className="py-2 pr-4 font-medium">Name</th>
                  <th className="py-2 pr-4 font-medium">Email</th>
                  <th className="py-2 pr-4 font-medium">Phone</th>
                  <th className="py-2 pr-4 font-medium">Status</th>
                  <th className="py-2 pr-4 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((c) => (
                  <tr
                    key={c.user_id}
                    onClick={() => setSelected(c)}
                    className="border-b cursor-pointer transition-colors hover:bg-[#6366F1]/5"
                    style={{ borderColor: "var(--t-border)" }}
                  >
                    <td className="py-2.5 pr-4 font-medium" style={{ color: "var(--t-text1)" }}>
                      {c.full_name || "—"}
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--t-text2)" }}>
                      {c.email || "—"}
                    </td>
                    <td className="py-2.5 pr-4" style={{ color: "var(--t-text2)" }}>
                      {c.phone || "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      <span
                        className={[
                          "rounded-full px-2.5 py-0.5 text-xs font-medium",
                          c.is_active
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-200 text-gray-600",
                        ].join(" ")}
                      >
                        {c.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="py-2.5 pr-4 text-xs" style={{ color: "var(--t-muted)" }}>
                      {fmtDate(c.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <CustomerProfilePanel
          profile={selected}
          onClose={() => setSelected(null)}
          canEdit={true}
          onJobClick={onJobClick}
          onInvoiceClick={onInvoiceClick}
        />
      )}
    </div>
  );
}
