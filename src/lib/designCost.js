/**
 * designCost.js
 * Shared helper for calculating the design-fee total from an invoice's
 * line items. Used by both DesignerJobsTab (admin) and MyDesignJobsTab
 * (designer) so the logic stays in one place.
 *
 * Primary match:  itemId is in the set of catalogue items filed under
 *                 the "Design" category (reliable regardless of item name).
 * Fallback match: item name contains "design" (case-insensitive) — catches
 *                 lines that were typed manually without picking from the
 *                 catalogue.
 */
export function calcDesignCost(invoice, designIdSet) {
  if (!invoice) return null;
  const lines = invoice.line_items ?? [];
  const total = lines
    .filter(
      (li) =>
        (li.itemId && designIdSet.has(li.itemId)) ||
        (li.name && li.name.toLowerCase().includes("design"))
    )
    .reduce((sum, li) => sum + Number(li.total || 0), 0);
  return total > 0 ? total : null;
}
