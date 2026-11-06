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

// ── Search across all saved quotes (offset + digital) ─────────────────────────
// Server-side so it scales to thousands of quotes. Every word typed must match
// the ref, job title, client name or client phone. Newest first.
//   type: "all" | "offset" | "digital"
// Returns { rows: [{ type, snapshot, updatedAt }], count }.
export async function searchSavedQuotes({ term = "", type = "all", limit = 25, offset = 0 } = {}) {
  let q = supabase
    .from("saved_quotes")
    .select("quote_type, snapshot, updated_at", { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type === "offset" || type === "digital") q = q.eq("quote_type", type);

  // Characters that would break PostgREST's or() filter syntax are dropped.
  const words = term.replace(/[,()*%\\:"]/g, " ").trim().split(/\s+/).filter(Boolean).slice(0, 5);
  for (const w of words) {
    const p = `*${w}*`;
    q = q.or(
      `ref.ilike.${p},snapshot->>jobTitle.ilike.${p},snapshot->>clientName.ilike.${p},snapshot->>clientPhone.ilike.${p}`
    );
  }

  const { data, error, count } = await q;
  if (error) throw error;
  return {
    rows: (data ?? []).map((r) => ({ type: r.quote_type, snapshot: r.snapshot, updatedAt: r.updated_at })),
    count: count ?? 0,
  };
}
