import { supabase } from "./supabase.js";

export const ITEM_UNITS = [
  "ea",    // each / piece
  "set",   // set
  "ream",  // ream (paper)
  "m²",    // square metre
  "hr",    // hour
  "pg",    // page
  "copy",  // copy
  "run",   // press run
  "job",   // fixed job fee
  "sheet", // sheet
];

export const ITEM_CATEGORIES = [
  "Print & Press",
  "Design",
  "Finishing",
  "Lamination",
  "Binding",
  "Paper & Materials",
  "Delivery",
  "Other",
];

// Returns the UUIDs of every catalogue item filed under the "Design" category.
// Used by the Designer lobby to reliably identify design-fee line items on an
// invoice regardless of what name CS gave them.
export async function listDesignItemIds() {
  const { data, error } = await supabase
    .from("items")
    .select("id")
    .eq("category", "Design");
  if (error) throw error;
  return (data ?? []).map((i) => i.id);
}

export async function listItems() {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("category")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createItem({
  name, description, category, unit, unitPrice, createdBy,
  itemType, printSpecs, isPublic, thumbnailUrl,
}) {
  const { data, error } = await supabase
    .from("items")
    .insert({
      name:          name.trim(),
      description:   description?.trim() || null,
      category:      category || null,
      unit:          unit || "ea",
      unit_price:    Number(unitPrice) || 0,
      created_by:    createdBy ?? null,
      item_type:     itemType  || "standard",
      print_specs:   itemType === "print" ? (printSpecs || null) : null,
      is_public:     isPublic  || false,
      thumbnail_url: thumbnailUrl?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateItem(id, {
  name, description, category, unit, unitPrice,
  itemType, printSpecs, isPublic, thumbnailUrl,
}) {
  const { data, error } = await supabase
    .from("items")
    .update({
      name:          name.trim(),
      description:   description?.trim() || null,
      category:      category || null,
      unit:          unit || "ea",
      unit_price:    Number(unitPrice) || 0,
      item_type:     itemType  || "standard",
      print_specs:   itemType === "print" ? (printSpecs || null) : null,
      is_public:     isPublic  || false,
      thumbnail_url: thumbnailUrl?.trim() || null,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// Items published to the customer Rates tab (is_public = true).
// Accessible to authenticated customers via RLS policy.
export async function listPublicItems() {
  const { data, error } = await supabase
    .from("items")
    .select("id, name, description, category, unit, unit_price, item_type, print_specs, thumbnail_url")
    .eq("is_public", true)
    .order("category")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function deleteItem(id) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}
