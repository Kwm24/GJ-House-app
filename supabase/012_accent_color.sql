-- Add accent colour to settings so the theme can be customised.
-- Safe to re-run: IF NOT EXISTS throughout.
alter table public.settings
  add column if not exists accent_color text default '#C0392B';
