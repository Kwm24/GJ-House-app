-- 020_public_settings.sql
-- Allow anyone (including unauthenticated visitors and customers) to read the
-- company settings row. The settings table stores only public business info:
-- company name, address, phone, email, VAT number, and logo URL — no secrets.
-- This lets the customer portal's PDF print view show the correct company header.
-- Safe to re-run.

drop policy if exists "Public can read settings" on public.settings;
create policy "Public can read settings" on public.settings
  for select using (true);
