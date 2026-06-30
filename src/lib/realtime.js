import { supabase } from "./supabase.js";

// Subscribes to changes on `table` and calls `onChange` for each event.
// Returns an unsubscribe function. Realtime still enforces the table's RLS
// per subscriber, so this never delivers rows the caller couldn't already
// SELECT directly.
export function subscribeToTable(table, onChange, { event = "*", filter } = {}) {
  const config = { event, schema: "public", table };
  if (filter) config.filter = filter;

  const channel = supabase
    .channel(`${table}-${filter ?? "all"}-${Math.random().toString(36).slice(2)}`)
    .on("postgres_changes", config, onChange)
    .subscribe();

  return () => supabase.removeChannel(channel);
}
