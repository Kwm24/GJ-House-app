-- Items Catalogue + General Invoices / Quotes / Receipts
-- Safe to re-run: IF NOT EXISTS / DROP POLICY IF EXISTS throughout.

-- ── Items catalogue ───────────────────────────────────────────────────────────
-- Reusable products and services that CS can add to general invoices.
create table if not exists public.items (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  category    text,
  unit        text not null default 'ea',
  unit_price  numeric(12,2) not null default 0,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

alter table public.items enable row level security;

-- All staff can browse the catalogue (production, designer, accounts may need
-- to reference items for cost queries even if they can't edit them).
drop policy if exists "Staff can read items" on public.items;
create policy "Staff can read items" on public.items for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs','admin','accounts','production','designer')
    )
  );

-- Only CS and Admin can create, update, or delete items.
drop policy if exists "CS and Admin manage items" on public.items;
create policy "CS and Admin manage items" on public.items
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs','admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs','admin')
    )
  );

-- ── General invoices / quotes / receipts ─────────────────────────────────────
-- Separate from the print-quote / jobs pipeline. Used for any service the
-- press provides that doesn't go through the full production workflow
-- (design-only work, finishing, delivery charges, ad-hoc supplies, etc.).
create table if not exists public.invoices (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete set null,
  ref          text not null,
  type         text not null default 'quote'
               check (type in ('quote','invoice','receipt')),
  status       text not null default 'draft'
               check (status in ('draft','sent','paid','cancelled')),
  client_name  text,
  client_phone text,
  client_email text,
  date         date not null default current_date,
  due_date     date,
  line_items   jsonb not null default '[]',
  subtotal     numeric(12,2) not null default 0,
  discount_pct numeric(5,2)  not null default 0,
  discount_amt numeric(12,2) not null default 0,
  vat_amt      numeric(12,2) not null default 0,
  total        numeric(12,2) not null default 0,
  notes        text,
  created_at   timestamptz default now()
);

alter table public.invoices enable row level security;

-- CS and Admin create, edit, and delete invoices.
drop policy if exists "CS and Admin manage invoices" on public.invoices;
create policy "CS and Admin manage invoices" on public.invoices
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs','admin')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs','admin')
    )
  );

-- Accounts can read invoices for financial reporting.
drop policy if exists "Accounts can read invoices" on public.invoices;
create policy "Accounts can read invoices" on public.invoices for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('accounts','admin')
    )
  );
