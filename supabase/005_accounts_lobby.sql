-- Accounts Lobby
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
-- DROP POLICY IF EXISTS.

-- Lets an expenditure be tagged to the job it was incurred for (e.g. paper
-- bought for a specific print run). Nullable -- general overhead (rent,
-- utilities, etc.) isn't tied to any one job.
alter table public.expenditures add column if not exists job_id uuid references public.jobs(id) on delete set null;

-- Expenditures are otherwise locked to their creator ("Users manage own
-- expenditures"). Accounts (and Admin) additionally need to see every
-- expenditure across every role to total them up.
drop policy if exists "Accounts can read all expenditures" on public.expenditures;
create policy "Accounts can read all expenditures" on public.expenditures for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('accounts', 'admin')
    )
  );

-- Payments received against a job (deposit or balance), via MoMo/cash/bank.
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete set null,
  amount numeric(12,2) not null,
  type text not null check (type in ('deposit', 'balance')),
  method text not null,
  date date not null default current_date,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.payments enable row level security;

drop policy if exists "Accounts can read payments" on public.payments;
create policy "Accounts can read payments" on public.payments for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('accounts', 'admin')
    )
  );

drop policy if exists "Accounts can record payments" on public.payments;
create policy "Accounts can record payments" on public.payments for insert
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('accounts', 'admin')
    )
  );

drop policy if exists "Accounts can delete payments" on public.payments;
create policy "Accounts can delete payments" on public.payments for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('accounts', 'admin')
    )
  );
