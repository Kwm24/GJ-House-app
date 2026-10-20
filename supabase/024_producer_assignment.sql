-- Producer job assignment
-- Allows admin to assign a specific producer to each production job.
-- The assigned producer sees only their own jobs in the "My Jobs" tab.

alter table public.jobs
  add column if not exists assigned_producer_id uuid
    references auth.users(id) on delete set null;

create index if not exists jobs_assigned_producer_idx
  on public.jobs (assigned_producer_id);

-- Allow admin (and CS) to set the assigned_producer_id on any job.
drop policy if exists "Admin can assign producer" on public.jobs;
create policy "Admin can assign producer" on public.jobs
  for update
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('admin', 'cs')
    )
  );
