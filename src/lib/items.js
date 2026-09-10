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

export async function listItems() {
  const { data, error } = await supabase
    .from("items")
    .select("*")
    .order("category")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function createItem({ name, description, category, unit, unitPrice, createdBy }) {
  const { data, error } = await supabase
    .from("items")
    .insert({
      name: name.trim(),
      description: description?.trim() || null,
      category: category || null,
      unit: unit || "ea",
      unit_price: Number(unitPrice) || 0,
      created_by: createdBy ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateItem(id, { name, description, category, unit, unitPrice }) {
  const { data, error } = await supabase
    .from("items")
    .update({
      name: name.trim(),
      description: description?.trim() || null,
      category: category || null,
      unit: unit || "ea",
      unit_price: Number(unitPrice) || 0,
    })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteItem(id) {
  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) throw error;
}
