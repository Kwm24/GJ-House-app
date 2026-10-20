-- Migration 030: Add landing_page content column to settings
alter table public.settings
  add column if not exists landing_page jsonb;
