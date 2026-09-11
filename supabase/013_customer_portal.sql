-- Customer Portal
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS / ON CONFLICT.

-- ── 1. Add customer_id to jobs ────────────────────────────────────────────────
alter table public.jobs
  add column if not exists customer_id uuid references auth.users(id) on delete set null;

-- ── 2. Jobs RLS: customers read only their own jobs ───────────────────────────
drop policy if exists "Customers read own jobs" on public.jobs;
create policy "Customers read own jobs" on public.jobs for select
  using (
    customer_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'customer'
    )
  );

-- CS/Admin can update customer_id (existing "CS can update own jobs" already
-- covers updates by the job owner; add an admin policy so admin can also assign)
drop policy if exists "Admin can update jobs" on public.jobs;
create policy "Admin can update jobs" on public.jobs for update
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'
    )
  );

-- ── 3. Profiles RLS: CS/Admin can list customer profiles for the picker ───────
drop policy if exists "Staff read customer profiles" on public.profiles;
create policy "Staff read customer profiles" on public.profiles for select
  using (
    auth.uid() = user_id          -- own profile always readable
    or exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin')
    )
  );

-- Customers can insert their own profile (self-registration)
drop policy if exists "Customers insert own profile" on public.profiles;
create policy "Customers insert own profile" on public.profiles for insert
  with check (
    auth.uid() = user_id
    and role = 'customer'
  );

-- ── 4. job-finals storage bucket ─────────────────────────────────────────────
-- Stores final artwork files CS/Designers upload per job.
-- Folder convention: job-finals/{jobId}/{filename}
insert into storage.buckets (id, name, public)
values ('job-finals', 'job-finals', false)
on conflict (id) do nothing;

-- CS, Admin, Designer can upload final files
drop policy if exists "Staff upload job finals" on storage.objects;
create policy "Staff upload job finals" on storage.objects for insert
  with check (
    bucket_id = 'job-finals'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin', 'designer')
    )
  );

-- Staff can read all job finals
drop policy if exists "Staff read job finals" on storage.objects;
create policy "Staff read job finals" on storage.objects for select
  using (
    bucket_id = 'job-finals'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin', 'designer', 'production')
    )
  );

-- Customers read finals only for jobs assigned to them
drop policy if exists "Customers read own job finals" on storage.objects;
create policy "Customers read own job finals" on storage.objects for select
  using (
    bucket_id = 'job-finals'
    and exists (
      select 1 from public.jobs j
      where j.id::text = (storage.foldername(name))[1]
        and j.customer_id = auth.uid()
    )
  );

-- Staff can delete finals (e.g. to replace a file)
drop policy if exists "Staff delete job finals" on storage.objects;
create policy "Staff delete job finals" on storage.objects for delete
  using (
    bucket_id = 'job-finals'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin', 'designer')
    )
  );
