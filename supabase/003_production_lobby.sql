-- Production Lobby
-- Safe to re-run: uses ADD COLUMN IF NOT EXISTS / DROP POLICY IF EXISTS.

-- Deadline production staff set on a job; recorded_by tags which lobby
-- an expenditure was entered from (e.g. 'cs', 'production').
alter table public.jobs add column if not exists deadline date;
alter table public.expenditures add column if not exists recorded_by text;

-- Production (and Admin) can update job status/deadline once payment is
-- confirmed -- mirrors the read policy's "status <> 'sent'" boundary so
-- production can't touch a job before CS has confirmed payment on it.
drop policy if exists "Production can update jobs" on public.jobs;
create policy "Production can update jobs" on public.jobs for update
  using (
    status <> 'sent'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('production', 'admin')
    )
  );
