import { supabase } from "./supabase.js";
import { subscribeToTable } from "./realtime.js";

export async function listNotifications(userId, limit = 20) {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data;
}

export async function getUnreadCount(userId) {
  const { data, error } = await supabase
    .from("notifications")
    .select("id")
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw error;
  return data?.length ?? 0;
}

export async function markNotificationRead(id) {
  const { error } = await supabase.from("notifications").update({ read: true }).eq("id", id);
  if (error) throw error;
}

export async function markAllNotificationsRead(userId) {
  const { error } = await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);

  if (error) throw error;
}

export function subscribeToNotifications(userId, onInsert) {
  // Filter client-side rather than using the postgres_changes server-side
  // filter, which is unreliable across Supabase project configurations.
  // RLS on the notifications table still ensures the realtime channel only
  // delivers rows the subscriber can already SELECT.
  return subscribeToTable(
    "notifications",
    (payload) => {
      if (payload.new?.user_id === userId) onInsert(payload.new);
    },
    { event: "INSERT" }
  );
}
