-- Migration 034: Add digital_quote_rates and favicon_url to settings
alter table public.settings
  add column if not exists digital_quote_rates jsonb,
  add column if not exists favicon_url         text;
