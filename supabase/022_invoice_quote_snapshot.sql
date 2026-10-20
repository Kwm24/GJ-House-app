-- Store the original PrintQuoteGH snapshot on an invoice so that when
-- Accounts records payment and creates a job, the full print specification
-- (plates, paper, binding, impressions, etc.) is available for the
-- SpecSheet in the Production and Designer lobbies.
--
-- Nullable: invoices created manually (not from a print quote) leave it null,
-- and those jobs show a simpler "no print spec" view on the SpecSheet.

alter table public.invoices
  add column if not exists quote_snapshot jsonb;
