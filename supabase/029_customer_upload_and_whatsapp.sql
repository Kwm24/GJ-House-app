-- Customer resource uploads + WhatsApp contact number in settings
-- Safe to re-run.

-- ── 1. WhatsApp number column on settings ─────────────────────────────────────
alter table public.settings
  add column if not exists whatsapp_number text;

-- ── 2. Storage: customers can upload files for their own jobs ─────────────────
-- Files land under customer-uploads/{jobId}/... in the job_files bucket.
drop policy if exists "Customers upload files for own jobs" on storage.objects;
create policy "Customers upload files for own jobs" on storage.objects
  for insert with check (
    bucket_id = 'job_files'
    and (storage.foldername(name))[1] = 'customer-uploads'
    and exists (
      select 1 from public.jobs j
      where j.id::text = (storage.foldername(name))[2]
        and j.customer_id = auth.uid()
    )
  );

-- ── 3. Storage: customers can read back their own uploaded files ───────────────
drop policy if exists "Customers read own uploaded files" on storage.objects;
create policy "Customers read own uploaded files" on storage.objects
  for select using (
    bucket_id = 'job_files'
    and (storage.foldername(name))[1] = 'customer-uploads'
    and exists (
      select 1 from public.jobs j
      where j.id::text = (storage.foldername(name))[2]
        and j.customer_id = auth.uid()
    )
  );

-- ── 4. job_files table: customers can insert records for own jobs ─────────────
drop policy if exists "Customers insert upload records for own jobs" on public.job_files;
create policy "Customers insert upload records for own jobs" on public.job_files
  for insert with check (
    file_type = 'customer_upload'
    and exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.customer_id = auth.uid()
    )
  );

-- ── 5. job_files table: customers can read records for own jobs ───────────────
drop policy if exists "Customers read own job file records" on public.job_files;
create policy "Customers read own job file records" on public.job_files
  for select using (
    exists (
      select 1 from public.jobs j
      where j.id = job_id
        and j.customer_id = auth.uid()
    )
  );
