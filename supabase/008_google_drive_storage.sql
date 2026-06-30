-- Google Drive Storage Integration
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS.
-- Old files already in Supabase Storage are unaffected (receipt_path and
-- file_path remain; new uploads additionally populate drive_file_id and
-- drive_view_link instead, with the old columns left null).

-- Receipts (expenditures) uploaded via Google Drive will store the Drive
-- file ID and a direct view link instead of a Supabase storage path.
alter table public.expenditures add column if not exists drive_file_id text;
alter table public.expenditures add column if not exists drive_view_link text;

-- Job attachments (designs + reference resources) uploaded via Google Drive.
alter table public.job_files add column if not exists drive_file_id text;
alter table public.job_files add column if not exists drive_view_link text;

-- CS staff can upload reference material (client resources) to be visible
-- in the Designer's Resources tab and shared with the client via the
-- shared Google Drive folder. Only reference type; design files are
-- Designer-only per the existing policy.
drop policy if exists "CS can upload reference files" on public.job_files;
create policy "CS can upload reference files" on public.job_files for insert
  with check (
    file_type = 'reference'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin')
    )
  );
