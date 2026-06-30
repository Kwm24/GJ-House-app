-- Designer Lobby
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
-- DROP POLICY IF EXISTS / ON CONFLICT.

-- Client phone, used for the WhatsApp chat button and design-ready notifications.
alter table public.jobs add column if not exists client_phone text;

-- Files attached to a job: reference material (from CS/client) and design
-- artwork (from Designer).
create table if not exists public.job_files (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade not null,
  file_type text not null check (file_type in ('reference', 'design')),
  file_name text not null,
  file_path text not null,
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

alter table public.job_files enable row level security;

drop policy if exists "Staff can read job files" on public.job_files;
create policy "Staff can read job files" on public.job_files for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'production', 'designer', 'accounts', 'admin')
    )
  );

drop policy if exists "Designer can upload design files" on public.job_files;
create policy "Designer can upload design files" on public.job_files for insert
  with check (
    file_type = 'design'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('designer', 'admin')
    )
  );

-- Storage bucket for job attachments. Paths are namespaced by type:
-- designs/{job_id}/... and reference/{job_id}/...
insert into storage.buckets (id, name, public)
values ('job_files', 'job_files', false)
on conflict (id) do nothing;

drop policy if exists "Staff can view job files" on storage.objects;
create policy "Staff can view job files" on storage.objects for select
  using (
    bucket_id = 'job_files'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'production', 'designer', 'accounts', 'admin')
    )
  );

drop policy if exists "Designer can upload designs" on storage.objects;
create policy "Designer can upload designs" on storage.objects for insert
  with check (
    bucket_id = 'job_files'
    and (storage.foldername(name))[1] = 'designs'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('designer', 'admin')
    )
  );

-- Designer (and Admin) can update job status (e.g. to 'design_ready') once
-- payment is confirmed -- mirrors Production's update policy.
drop policy if exists "Designer can update jobs" on public.jobs;
create policy "Designer can update jobs" on public.jobs for update
  using (
    status <> 'sent'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('designer', 'admin')
    )
  );
