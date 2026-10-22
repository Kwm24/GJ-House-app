import { supabase } from "./supabase.js";

// ── Offset quotes ─────────────────────────────────────────────────────────────

export async function loadSavedQuotes() {
  const { data } = await supabase
    .from("saved_quotes")
    .select("snapshot")
    .eq("quote_type", "offset")
    .order("updated_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => r.snapshot);
}

export async function saveQuoteToStorage(snapshot) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("saved_quotes").upsert(
    {
      saved_by:   user?.id ?? null,
      quote_type: "offset",
      ref:        snapshot.ref,
      snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "quote_type,ref" }
  );
}

export async function deleteSavedQuote(ref) {
  await supabase
    .from("saved_quotes")
    .delete()
    .eq("quote_type", "offset")
    .eq("ref", ref);
  return loadSavedQuotes();
}

// ── Digital print quotes ──────────────────────────────────────────────────────

export async function loadDigitalQuotes() {
  const { data } = await supabase
    .from("saved_quotes")
    .select("snapshot")
    .eq("quote_type", "digital")
    .order("updated_at", { ascending: false })
    .limit(20);
  return (data ?? []).map((r) => r.snapshot);
}

export async function saveDigitalQuoteToStorage(snapshot) {
  const { data: { user } } = await supabase.auth.getUser();
  await supabase.from("saved_quotes").upsert(
    {
      saved_by:   user?.id ?? null,
      quote_type: "digital",
      ref:        snapshot.ref,
      snapshot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "quote_type,ref" }
  );
}

export async function deleteDigitalQuote(ref) {
  await supabase
    .from("saved_quotes")
    .delete()
    .eq("quote_type", "digital")
    .eq("ref", ref);
  return loadDigitalQuotes();
}
