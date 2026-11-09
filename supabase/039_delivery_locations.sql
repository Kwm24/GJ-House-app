-- 039_delivery_locations.sql
--
-- Customers save where they want orders delivered: a map pin (latitude /
-- longitude) plus optional directions, so staff can hand the location to a
-- delivery rider (Bolt, Uber, Yango…) as a Google Maps link or coordinates.
--
--   * Customers see and manage only their own locations.
--   * Active staff (cs, admin, production, accounts, designer) can read them.
--   * One location per customer can be the default (enforced by an index).
--
-- Safe to re-run.

create table if not exists public.delivery_locations (
  id            uuid primary key default gen_random_uuid(),
  customer_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label         text not null default 'Home' check (char_length(label) between 1 and 60),
  lat           double precision not null check (lat between -90 and 90),
  lng           double precision not null check (lng between -180 and 180),
  address       text check (char_length(address) <= 300),   -- area / street / building
  landmark      text check (char_length(landmark) <= 500),  -- directions for the rider
  gps_code      text check (char_length(gps_code) <= 20),   -- GhanaPost GPS, e.g. GA-123-4567
  contact_phone text check (char_length(contact_phone) <= 30),
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists delivery_locations_customer_idx
  on public.delivery_locations (customer_id);

create unique index if not exists delivery_locations_one_default
  on public.delivery_locations (customer_id) where is_default;

-- Keep updated_at current
create or replace function public.touch_delivery_location()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists delivery_locations_touch on public.delivery_locations;
create trigger delivery_locations_touch
  before update on public.delivery_locations
  for each row execute procedure public.touch_delivery_location();

-- ── Row level security ─────────────────────────────────────────────────────
alter table public.delivery_locations enable row level security;

drop policy if exists "Customers manage own delivery locations" on public.delivery_locations;
create policy "Customers manage own delivery locations"
  on public.delivery_locations
  for all
  to authenticated
  using (customer_id = auth.uid())
  with check (customer_id = auth.uid());

drop policy if exists "Staff read delivery locations" on public.delivery_locations;
create policy "Staff read delivery locations"
  on public.delivery_locations
  for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin', 'production', 'accounts', 'designer')
        and coalesce(p.is_active, true)
    )
  );

-- ── Make a location the default (unsets the previous one atomically) ───────
create or replace function public.set_default_delivery_location(location_id uuid)
returns void
language plpgsql
security invoker            -- runs under the caller's RLS: own rows only
set search_path = public
as $$
begin
  if not exists (select 1 from public.delivery_locations
                  where id = location_id and customer_id = auth.uid()) then
    raise exception 'Location not found';
  end if;
  update public.delivery_locations set is_default = false
   where customer_id = auth.uid() and is_default and id <> location_id;
  update public.delivery_locations set is_default = true
   where id = location_id and customer_id = auth.uid();
end;
$$;

revoke all on function public.set_default_delivery_location(uuid) from public, anon;
grant execute on function public.set_default_delivery_location(uuid) to authenticated;
