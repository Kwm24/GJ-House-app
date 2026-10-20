-- 018_design_approval.sql
-- Customers can view designer-uploaded artwork in their portal's "Final Design"
-- tab, then click "Approve This Design" to give the production team a go-ahead.
--
-- Changes:
--   • jobs.design_approved  — boolean flag set when customer approves
--   • RLS: customers can SELECT job_files rows for their own jobs
--   • RLS: customers can read design files from the job_files storage bucket
--   • approve_job_design()  — SECURITY DEFINER RPC that flips the flag and
--     moves the job to "design_ready" without giving customers a broad UPDATE
--     policy on the jobs table
--
-- Safe to re-run.

-- ── 1. Track approval on the job row ─────────────────────────────────────────
alter table public.jobs
  add column if not exists design_approved boolean not null default false;

-- ── 2. Customers can read job_files rows that belong to their jobs ────────────
drop policy if exists "Customers read design files for own jobs" on public.job_files;
create policy "Customers read design files for own jobs" on public.job_files
  for select
  using (
    exists (
      select 1 from public.jobs j
      where j.id        = job_files.job_id
        and j.customer_id = auth.uid()
    )
  );

-- ── 3. Customers can read design files from storage (designs/{jobId}/…) ──────
drop policy if exists "Customers read design storage files" on storage.objects;
create policy "Customers read design storage files" on storage.objects
  for select
  using (
    bucket_id = 'job_files'
    and (storage.foldername(name))[1] = 'designs'
    and exists (
      select 1 from public.jobs j
      where j.id::text  = (storage.foldername(name))[2]
        and j.customer_id = auth.uid()
    )
  );

-- ── 4. Secure RPC so customers can approve without a broad UPDATE policy ──────
-- Sets design_approved = true AND moves status to design_ready so the
-- Production lobby immediately sees the job is cleared for printing.
create or replace function public.approve_job_design(p_job_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.jobs
  set    design_approved = true,
         status          = 'design_ready'
  where  id          = p_job_id
    and  customer_id = auth.uid();

  if not found then
    raise exception 'Job not found or you are not authorised to approve it';
  end if;
end;
$$;
