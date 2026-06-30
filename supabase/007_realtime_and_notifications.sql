-- Realtime + Notifications
-- Safe to re-run: uses CREATE TABLE IF NOT EXISTS / DROP POLICY IF EXISTS /
-- CREATE OR REPLACE FUNCTION / DROP TRIGGER IF EXISTS, and a guarded DO
-- block for the publication adds (ALTER PUBLICATION ... ADD TABLE errors
-- if the table is already a member, so it's checked first).

-- One row per staff-relevant event (e.g. a job's status changed). Surfaced
-- via the notification bell in the top nav.
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  job_id uuid references public.jobs(id) on delete set null,
  message text not null,
  read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users can read own notifications" on public.notifications;
create policy "Users can read own notifications" on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications" on public.notifications for update
  using (auth.uid() = user_id);

-- No insert policy: rows are only ever written by the trigger below, which
-- runs as security definer and so bypasses RLS entirely.

-- Notifies relevant staff roles whenever a job's status changes. Fires for
-- every status-changing UPDATE on "jobs", regardless of which lobby made
-- the change (CS, Production, or Designer), so there's a single place this
-- logic lives instead of every call site having to remember to notify.
create or replace function public.notify_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_roles text[];
  msg text;
begin
  if new.status is distinct from old.status then
    target_roles := case new.status
      when 'approved'         then array['production', 'accounts']
      when 'ready_for_design' then array['designer']
      when 'design_ready'     then array['production', 'cs']
      when 'in_production'    then array['cs']
      when 'at_finishing'     then array['cs']
      when 'ready_for_pickup' then array['cs']
      when 'delivered'        then array['cs', 'accounts']
      else null
    end;

    if target_roles is not null then
      msg := coalesce(new.job_title, new.quote_ref) || ' is now ' || replace(new.status, '_', ' ');

      insert into public.notifications (user_id, job_id, message)
      select p.user_id, new.id, msg
      from public.profiles p
      where p.role = any(target_roles) and p.is_active;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_job_status_change on public.jobs;
create trigger trg_notify_job_status_change
  after update of status on public.jobs
  for each row
  execute function public.notify_job_status_change();

-- Add tables to the realtime publication so postgres_changes subscriptions
-- receive INSERT/UPDATE events. Realtime still enforces each table's RLS
-- policies per subscriber, so this never broadcasts a row to someone who
-- couldn't already SELECT it directly.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'jobs'
  ) then
    alter publication supabase_realtime add table public.jobs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'payments'
  ) then
    alter publication supabase_realtime add table public.payments;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;
