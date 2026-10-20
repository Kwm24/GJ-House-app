-- 019_email_and_customer_docs.sql
--
-- 1. profiles.email        — store customer email so CS staff can auto-fill it
-- 2. handle_new_user()     — update trigger to capture email from auth.users
-- 3. invoices.customer_id  — link any saved invoice/quote/receipt to a customer
-- 4. RLS                   — customers can SELECT their own invoices
--
-- Safe to re-run.

-- ── 1. Add email column to profiles ──────────────────────────────────────────
alter table public.profiles
  add column if not exists email text;

-- ── 2. Update trigger to store email + backfill existing rows ─────────────────
-- The new.email on auth.users is always set; raw_user_meta_data still carries
-- role / full_name / phone from signUpCustomer().
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Recreate the trigger in case it was dropped or points to an old function.
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill email for existing profiles that don't have it yet.
-- Runs as migration admin so it can read auth.users directly.
update public.profiles p
set    email = u.email
from   auth.users u
where  p.user_id = u.id
  and  p.email is null;

-- ── 3. Add customer_id to invoices ───────────────────────────────────────────
alter table public.invoices
  add column if not exists customer_id uuid references auth.users(id) on delete set null;

-- Index for fast per-customer lookups in the portal.
create index if not exists invoices_customer_id_idx on public.invoices (customer_id);

-- ── 4. RLS — customers can read their own invoices ────────────────────────────
drop policy if exists "Customers read own invoices" on public.invoices;
create policy "Customers read own invoices" on public.invoices
  for select
  using (customer_id = auth.uid());
