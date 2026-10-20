-- Admin can delete jobs (hard delete — payments/expenditures survive with job_id set null).
drop policy if exists "Admin can delete jobs" on public.jobs;
create policy "Admin can delete jobs" on public.jobs
  for delete
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role = 'admin'
    )
  );

-- Extend job-finals upload to include production staff.
-- Replaces the cs/admin/designer-only policy from migration 013.
drop policy if exists "Staff upload job finals" on storage.objects;
create policy "Staff upload job finals" on storage.objects for insert
  with check (
    bucket_id = 'job-finals'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin', 'designer', 'production')
    )
  );

-- Extend job-finals delete to include production staff.
drop policy if exists "Staff delete job finals" on storage.objects;
create policy "Staff delete job finals" on storage.objects for delete
  using (
    bucket_id = 'job-finals'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin', 'designer', 'production')
    )
  );
