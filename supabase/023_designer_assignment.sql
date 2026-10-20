-- Designer job assignment
-- Allows admin to assign a specific designer to each design job.
-- The assigned designer sees only their own jobs in the "My Jobs" tab.

alter table public.jobs
  add column if not exists assigned_designer_id uuid
    references auth.users(id) on delete set null;

create index if not exists jobs_assigned_designer_idx
  on public.jobs (assigned_designer_id);

-- Allow admin (and CS) to set the assigned_designer_id on any job.
-- The existing "CS can update own jobs" policy only covers jobs where
-- user_id = auth.uid(), and "Designer can update jobs" covers designer/admin
-- for status updates. We add an explicit policy so admin can assign any job.
drop policy if exists "Admin can assign designer" on public.jobs;
create policy "Admin can assign designer" on public.jobs
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('admin', 'cs')
    )
  );
