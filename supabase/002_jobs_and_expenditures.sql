-- Customer Service Lobby
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT instead of bare CREATE.

-- Jobs (approved quotes)
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  quote_ref text not null,
  client_name text,
  job_title text,
  status text not null default 'approved',
  deposit_amount numeric(12,2) not null default 0,
  quote jsonb not null,
  sent_at timestamptz,
  sent_via text,
  created_at timestamptz default now()
);

alter table public.jobs enable row level security;

drop policy if exists "CS can insert jobs" on public.jobs;
create policy "CS can insert jobs" on public.jobs for insert
  with check (auth.uid() = user_id);

-- CS and Admin see every job regardless of status (sent, awaiting payment,
-- approved, in production, etc) since they run the quote pipeline end to end.
-- Production/Designer/Accounts only see jobs once payment is confirmed
-- (anything past "sent") -- they shouldn't see unpaid quotes, but should
-- see every post-approval production-pipeline status (in_production,
-- ready_for_design, at_finishing, ready_for_pickup, delivered, ...).
-- Customers are excluded entirely until customer-facing access is scoped
-- to "their own jobs only" (not yet modeled in this schema).
drop policy if exists "Staff can read jobs" on public.jobs;
create policy "Staff can read jobs" on public.jobs for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin')
    )
    or (
      status <> 'sent'
      and exists (
        select 1 from public.profiles p
        where p.user_id = auth.uid()
          and p.role in ('production', 'designer', 'accounts')
      )
    )
  );

drop policy if exists "CS can update own jobs" on public.jobs;
create policy "CS can update own jobs" on public.jobs for update
  using (auth.uid() = user_id);

-- Expenditures
create table if not exists public.expenditures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  description text not null,
  amount numeric(12,2) not null,
  date date not null,
  vendor text,
  line_items jsonb default '[]',
  receipt_path text,
  created_at timestamptz default now()
);

alter table public.expenditures enable row level security;

drop policy if exists "Users manage own expenditures" on public.expenditures;
create policy "Users manage own expenditures" on public.expenditures
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Receipt storage bucket
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "Users upload receipts" on storage.objects;
create policy "Users upload receipts" on storage.objects for insert
  with check (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users view own receipts" on storage.objects;
create policy "Users view own receipts" on storage.objects for select
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "Users delete own receipts" on storage.objects;
create policy "Users delete own receipts" on storage.objects for delete
  using (bucket_id = 'receipts' and auth.uid()::text = (storage.foldername(name))[1]);
