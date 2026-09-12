-- Fix: CS cannot upload reference files to Supabase Storage.
--
-- Root cause: 004_designer_lobby.sql only added a storage INSERT policy for
-- the 'designs/' folder (Designer role). There was no matching policy for
-- the 'reference/' folder, so any CS upload was rejected by RLS.
--
-- Also updates the job_files TABLE insert policy to use the safe my_role()
-- helper (consistent with 014_fix_profiles_rls.sql pattern).
--
-- Safe to re-run.

-- ── 1. Storage INSERT policy for CS uploading reference files ─────────────────
drop policy if exists "CS can upload reference files to storage" on storage.objects;
create policy "CS can upload reference files to storage" on storage.objects
  for insert
  with check (
    bucket_id = 'job_files'
    and (storage.foldername(name))[1] = 'reference'
    and public.my_role() in ('cs', 'admin')
  );

-- ── 2. Refresh the job_files TABLE insert policy to use my_role() ─────────────
-- (was already correct logically but used a direct profiles sub-select)
drop policy if exists "CS can upload reference files" on public.job_files;
create policy "CS can upload reference files" on public.job_files
  for insert
  with check (
    file_type = 'reference'
    and public.my_role() in ('cs', 'admin')
  );
