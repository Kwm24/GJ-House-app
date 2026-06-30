-- Admin Dashboard
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
-- DROP POLICY IF EXISTS / ON CONFLICT.

-- created_at for sortable listing; email denormalized from auth.users since
-- PostgREST can't join into the auth schema, and is_active for the
-- deactivate-account feature (checked at login time in the app).
alter table public.profiles add column if not exists created_at timestamptz default now();
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists is_active boolean not null default true;

-- One-time backfill: populate email for any profile created before this
-- column existed. Safe to re-run -- only touches rows still missing it.
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.user_id and p.email is null;

-- Checks whether the calling user is an admin. A policy on "profiles" can't
-- check this with a plain subquery into "profiles" -- evaluating that
-- subquery re-triggers every SELECT policy on "profiles" (including the
-- one being defined), which queries "profiles" again, forever:
-- "infinite recursion detected in policy for relation profiles".
-- A security definer function breaks the loop -- it runs as the function
-- owner (the postgres role, which bypasses RLS), not the calling user, so
-- its internal query never re-enters RLS on "profiles".
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles where user_id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

-- Admin needs to see and edit every profile (Users page). The existing
-- "Users can read own profile" policy still covers everyone's self-read.
drop policy if exists "Admin can read all profiles" on public.profiles;
create policy "Admin can read all profiles" on public.profiles for select
  using (public.is_admin());

drop policy if exists "Admin can update profiles" on public.profiles;
create policy "Admin can update profiles" on public.profiles for update
  using (public.is_admin());

-- Company payment details + quote rate defaults, edited from the Admin
-- Settings page. Single row, fixed id = 1.
create table if not exists public.settings (
  id int primary key default 1,
  momo_number text,
  bank_name text,
  account_number text,
  account_name text,
  quote_rates jsonb,
  updated_at timestamptz default now(),
  constraint settings_singleton check (id = 1)
);

insert into public.settings (id) values (1) on conflict (id) do nothing;

alter table public.settings enable row level security;

-- Every signed-in staff member can read settings (CS needs quote_rates to
-- prefill new quotes; everyone already quotes the company's own MoMo/bank
-- details to clients, so it isn't gated to Admin-only).
drop policy if exists "Staff can read settings" on public.settings;
create policy "Staff can read settings" on public.settings for select
  using (
    exists (
      select 1 from public.profiles p where p.user_id = auth.uid()
    )
  );

drop policy if exists "Admin can update settings" on public.settings;
create policy "Admin can update settings" on public.settings for update
  using (public.is_admin());
