import { LobbyHeader } from "../components/LobbyHeader.jsx";

export function CustomerPage() {
  return (
    <div className="min-h-screen bg-brand-dark">
      <LobbyHeader
        title="My Jobs"
        subtitle="Track your print orders & quotes"
      />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="rounded-xl bg-brand-cream p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-brand-dark">
            Customer portal
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            Your active quotes, orders, and delivery status will appear here.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            {["My quotes", "Active orders", "Delivery status"].map((item) => (
              <div
                key={item}
                className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500"
              >
                {item} — coming soon
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
