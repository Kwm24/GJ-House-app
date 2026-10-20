-- Print items: specialist catalogue entries with material/size specs.
-- Public items: items staff can publish to the customer Rates tab.

-- ── Items table extensions ─────────────────────────────────────────────────────
alter table public.items
  add column if not exists item_type text not null default 'standard'
    check (item_type in ('standard', 'print'));

alter table public.items
  add column if not exists print_specs jsonb;
  -- Shape: { material: string, size: string }
  -- Only populated when item_type = 'print'.

alter table public.items
  add column if not exists is_public boolean not null default false;

-- ── RLS — customers can read items that are published to the Rates tab ─────────
-- (Staff already have their own read policy from earlier migrations.)
drop policy if exists "Customers can read public items" on public.items;
create policy "Customers can read public items" on public.items
  for select
  using (is_public = true);
