import { useState, useEffect, useCallback, useRef, Fragment } from "react";
import { useAuth } from "./AuthProvider.jsx";
import {
  listNotifications,
  getUnreadCount,
  markNotificationRead,
  markAllNotificationsRead,
  subscribeToNotifications,
} from "../lib/notifications.js";

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function NotificationBell({ onJobClick }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const panelRef = useRef(null);
  const toastTimer = useRef(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [list, count] = await Promise.all([
        listNotifications(user.id),
        getUnreadCount(user.id),
      ]);
      setItems(list);
      setUnreadCount(count);
    } catch {
      // notifications are a convenience layer — fail quietly
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!user) return;
    return subscribeToNotifications(user.id, (row) => {
      setItems((prev) => [row, ...prev].slice(0, 20));
      setUnreadCount((c) => c + 1);
      // Show a brief toast so the user sees the notification even if they're
      // not looking at the bell.
      if (toastTimer.current) clearTimeout(toastTimer.current);
      setToast(row);
      toastTimer.current = setTimeout(() => setToast(null), 4500);
    });
  }, [user]);

  // Clean up toast timer on unmount
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  async function handleMarkAllRead() {
    if (!user) return;
    try {
      await markAllNotificationsRead(user.id);
      setItems((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // best-effort
    }
  }

  async function handleItemClick(n) {
    if (!n.read) {
      try {
        await markNotificationRead(n.id);
        setItems((prev) => prev.map((row) => (row.id === n.id ? { ...row, read: true } : row)));
        setUnreadCount((c) => Math.max(0, c - 1));
      } catch {
        // best-effort
      }
    }
    if (n.job_id && onJobClick) {
      setOpen(false);
      onJobClick(n.job_id);
    }
  }

  if (!user) return null;

  return (
    <Fragment>
    {/* ── Toast popup ── fixed overlay, visible even when bell is closed */}
    {toast && (
      <div
        className="fixed top-4 right-4 z-50 flex items-start gap-3 rounded-xl bg-brand-dark border border-white/10 text-brand-cream shadow-2xl px-4 py-3 max-w-xs w-full"
        role="alert"
      >
        <span className="text-lg shrink-0 mt-0.5">🔔</span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-widest text-brand-red mb-0.5">
            New notification
          </p>
          <p className="text-sm leading-snug line-clamp-3">{toast.message}</p>
        </div>
        <button
          type="button"
          onClick={() => { clearTimeout(toastTimer.current); setToast(null); }}
          className="shrink-0 text-brand-cream/40 hover:text-brand-cream text-lg leading-none ml-1"
          aria-label="Dismiss"
        >
          ×
        </button>
      </div>
    )}
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Notifications"
        className="relative rounded-lg border border-white/20 bg-white/5 p-2 text-brand-cream hover:bg-white/10 transition-colors"
      >
        <span aria-hidden="true">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-red px-1 text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-xl border border-gray-200 bg-white shadow-lg" style={{ zIndex: 40 }}>
          <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
            <span className="text-sm font-semibold text-brand-dark">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-brand-red hover:underline"
              >
                Mark all as read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">No notifications yet.</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => handleItemClick(n)}
                  className={[
                    "block w-full text-left px-4 py-3 text-sm border-b border-gray-100 hover:bg-gray-50 transition-colors cursor-pointer",
                    n.read ? "text-gray-500" : "text-brand-dark font-medium",
                  ].join(" ")}
                >
                  <div className="flex items-start gap-2">
                    {!n.read && (
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-red" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2">{n.message}</p>
                      <p className="mt-0.5 text-xs text-gray-400">{timeAgo(n.created_at)}</p>
                    </div>
                    {n.job_id && onJobClick && (
                      <span className="shrink-0 text-gray-400 mt-0.5">→</span>
                    )}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
    </Fragment>
  );
}
