-- 027: Assignment notifications + customer notifications
--
-- 1. New trigger that fires when assigned_designer_id or assigned_producer_id
--    changes so the newly assigned person gets a personal bell notification
--    immediately — previously they only found out by refreshing the page.
--
-- 2. Replaces notify_job_status_change() to also send the job's linked
--    customer a notification on key milestones: design ready for review,
--    ready for pickup, delivered, completed.

-- ── 1. Assignment notification function ─────────────────────────────────────
create or replace function public.notify_job_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_label text;
  msg       text;
begin
  job_label := coalesce(new.job_title, new.quote_ref, 'A job');

  -- Designer assigned (or reassigned to a different designer)
  if new.assigned_designer_id is distinct from old.assigned_designer_id
     and new.assigned_designer_id is not null
  then
    msg := job_label || ' has been assigned to you for design';
    insert into public.notifications (user_id, job_id, message)
    values (new.assigned_designer_id, new.id, msg);
  end if;

  -- Producer assigned (or reassigned to a different producer)
  if new.assigned_producer_id is distinct from old.assigned_producer_id
     and new.assigned_producer_id is not null
  then
    msg := job_label || ' has been assigned to you for production';
    insert into public.notifications (user_id, job_id, message)
    values (new.assigned_producer_id, new.id, msg);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_job_assignment on public.jobs;
create trigger trg_notify_job_assignment
  after update of assigned_designer_id, assigned_producer_id on public.jobs
  for each row
  execute function public.notify_job_assignment();


-- ── 2. Extend status-change trigger to also notify customers ─────────────────
-- Replaces the function defined in 007_realtime_and_notifications.sql.
-- Staff role logic is identical; customer notifications are new.

create or replace function public.notify_job_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_roles  text[];
  staff_msg     text;
  customer_msg  text;
begin
  if new.status is distinct from old.status then

    -- Staff role notifications (unchanged from migration 007)
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
      staff_msg := coalesce(new.job_title, new.quote_ref) || ' is now ' || replace(new.status, '_', ' ');
      insert into public.notifications (user_id, job_id, message)
      select p.user_id, new.id, staff_msg
      from public.profiles p
      where p.role = any(target_roles) and p.is_active;
    end if;

    -- Customer notifications for key milestones
    if new.customer_id is not null then
      customer_msg := case new.status
        when 'ready_for_design' then coalesce(new.job_title, new.quote_ref) || ' — your design is ready for review'
        when 'design_ready'     then coalesce(new.job_title, new.quote_ref) || ' — design approved, going to print'
        when 'ready_for_pickup' then coalesce(new.job_title, new.quote_ref) || ' is ready for pickup!'
        when 'delivered'        then coalesce(new.job_title, new.quote_ref) || ' has been delivered — thank you!'
        when 'completed'        then coalesce(new.job_title, new.quote_ref) || ' is now complete'
        else null
      end;

      if customer_msg is not null then
        insert into public.notifications (user_id, job_id, message)
        values (new.customer_id, new.id, customer_msg);
      end if;
    end if;

  end if;

  return new;
end;
$$;

-- Trigger definition is unchanged (still fires AFTER UPDATE OF status).
drop trigger if exists trg_notify_job_status_change on public.jobs;
create trigger trg_notify_job_status_change
  after update of status on public.jobs
  for each row
  execute function public.notify_job_status_change();
