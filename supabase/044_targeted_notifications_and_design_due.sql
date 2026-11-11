-- 044_targeted_notifications_and_design_due.sql
--
-- 1. Notifications go only to the staff accounts a job belongs to.
--    Before: every active account of a role got every job's notification
--    (all producers, all designers, all CS…), whether or not the job was theirs.
--    Now (job_staff_recipients):
--      production → only the job's assigned producer (none assigned = none)
--      designer   → only the job's assigned designer (none assigned = none)
--      cs         → the CS account that created the job's quote / invoice;
--                   all CS only if no CS account can be identified
--      accounts   → the accounts user who recorded the job's payment;
--                   all accounts only if none can be identified
--    Admins get a "needs a producer / designer" alert when a job reaches a
--    stage that needs one and nobody is assigned yet. Assigning someone
--    already notifies them (migration 027).
-- 2. jobs.design_due: the date the designer expects the design to be ready
--    (set in the Designer lobby). Production's "Finishing time" is still
--    jobs.deadline. Both show on the customer portal.
-- 3. The customer (and the assigned producer / designer) is notified when
--    either date is set or changed.
--
-- Safe to re-run.

-- ── 2. Design due date ─────────────────────────────────────────────────────
alter table public.jobs add column if not exists design_due date;

-- ── 1a. Who on the staff a job's notification is for ───────────────────────
create or replace function public.job_staff_recipients(p_job public.jobs, p_roles text[])
returns table (user_id uuid)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cs_owner   uuid;
  acct_owner uuid;
begin
  -- Production / Designer: the assigned account only
  if 'production' = any(p_roles) and p_job.assigned_producer_id is not null then
    return query select p.user_id from public.profiles p
      where p.user_id = p_job.assigned_producer_id and p.role in ('production', 'admin') and coalesce(p.is_active, true);
  end if;
  if 'designer' = any(p_roles) and p_job.assigned_designer_id is not null then
    return query select p.user_id from public.profiles p
      where p.user_id = p_job.assigned_designer_id and p.role in ('designer', 'admin') and coalesce(p.is_active, true);
  end if;

  -- CS: whoever made the quote / invoice for this job (or created the job)
  if 'cs' = any(p_roles) then
    select i.user_id into cs_owner
      from public.invoices i
      join public.profiles p on p.user_id = i.user_id and p.role = 'cs' and coalesce(p.is_active, true)
     where i.ref = p_job.quote_ref or i.source_ref = p_job.quote_ref
        or i.ref = (select i2.source_ref from public.invoices i2 where i2.ref = p_job.quote_ref limit 1)
     order by i.created_at asc
     limit 1;
    if cs_owner is null then
      select p.user_id into cs_owner from public.profiles p
       where p.user_id = p_job.user_id and p.role = 'cs' and coalesce(p.is_active, true);
    end if;
    if cs_owner is not null then
      return query select cs_owner;
    else
      return query select p.user_id from public.profiles p where p.role = 'cs' and coalesce(p.is_active, true);
    end if;
  end if;

  -- Accounts: whoever recorded the payment that created the job
  if 'accounts' = any(p_roles) then
    select p.user_id into acct_owner from public.profiles p
     where p.user_id = p_job.user_id and p.role = 'accounts' and coalesce(p.is_active, true);
    if acct_owner is null then
      select pay.recorded_by into acct_owner
        from public.payments pay
        join public.profiles p on p.user_id = pay.recorded_by and p.role = 'accounts' and coalesce(p.is_active, true)
       where pay.job_id = p_job.id
       order by pay.created_at asc
       limit 1;
    end if;
    if acct_owner is not null then
      return query select acct_owner;
    else
      return query select p.user_id from public.profiles p where p.role = 'accounts' and coalesce(p.is_active, true);
    end if;
  end if;
end;
$$;

revoke all on function public.job_staff_recipients(public.jobs, text[]) from public, anon, authenticated;

-- ── 1b. Status-change notifications (replaces 041's version) ──────────────
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
  title         text := coalesce(nullif(new.job_title, ''), new.quote_ref);
begin
  if new.status is distinct from old.status then

    target_roles := case new.status
      when 'approved'         then array['production', 'accounts']
      when 'ready_for_design' then array['designer']
      when 'design_review'    then array['cs']
      when 'design_ready'     then array['production', 'cs', 'designer']
      when 'in_production'    then array['cs']
      when 'at_finishing'     then array['cs']
      when 'ready_for_pickup' then array['cs']
      when 'delivered'        then array['cs', 'accounts']
      else null
    end;

    if target_roles is not null then
      staff_msg := title || case new.status
        when 'design_review' then ': design sent to the customer for approval'
        when 'design_ready'  then ': customer approved the design, ready for production'
        else ' is now ' || replace(new.status, '_', ' ')
      end;
      insert into public.notifications (user_id, job_id, message)
      select distinct r.user_id, new.id, staff_msg
        from public.job_staff_recipients(new, target_roles) r
       where r.user_id is not null
         and r.user_id is distinct from auth.uid();   -- not the person who made the change
    end if;

    -- Admins: a stage needs someone and nobody is assigned yet
    if new.status in ('approved', 'design_ready') and new.assigned_producer_id is null
       and not (new.status = 'approved' and new.needs_design) then
      insert into public.notifications (user_id, job_id, message)
      select p.user_id, new.id, title || ': needs a production account assigned'
        from public.profiles p where p.role = 'admin' and coalesce(p.is_active, true);
    elsif new.status = 'ready_for_design' and new.assigned_designer_id is null then
      insert into public.notifications (user_id, job_id, message)
      select p.user_id, new.id, title || ': needs a designer assigned'
        from public.profiles p where p.role = 'admin' and coalesce(p.is_active, true);
    end if;

    if new.customer_id is not null then
      customer_msg := case new.status
        when 'ready_for_design' then title || ': our designers are working on your artwork'
        when 'design_review'    then title || ': your design is ready. Please review and approve it'
        when 'design_ready'     then title || ': design approved, going to print'
        when 'ready_for_pickup' then title || ' is ready for pickup!'
        when 'delivered'        then title || ' has been delivered. Thank you!'
        when 'completed'        then title || ' is now complete'
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

drop trigger if exists trg_notify_job_status_change on public.jobs;
create trigger trg_notify_job_status_change
  after update of status on public.jobs
  for each row
  execute function public.notify_job_status_change();

-- ── 3. Finishing dates changed ─────────────────────────────────────────────
create or replace function public.notify_job_dates_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  title text := coalesce(nullif(new.job_title, ''), new.quote_ref);
  fmt   text;
begin
  -- Production finishing date
  if new.deadline is distinct from old.deadline and new.deadline is not null then
    fmt := to_char(new.deadline, 'FMDay DD Mon YYYY');
    if new.customer_id is not null then
      insert into public.notifications (user_id, job_id, message)
      values (new.customer_id, new.id, title || ': expected to be finished on ' || fmt);
    end if;
    if new.assigned_producer_id is not null and new.assigned_producer_id is distinct from auth.uid() then
      insert into public.notifications (user_id, job_id, message)
      values (new.assigned_producer_id, new.id, title || ': finishing date set to ' || fmt);
    end if;
  end if;

  -- Design ready-by date
  if new.design_due is distinct from old.design_due and new.design_due is not null then
    fmt := to_char(new.design_due, 'FMDay DD Mon YYYY');
    if new.customer_id is not null then
      insert into public.notifications (user_id, job_id, message)
      values (new.customer_id, new.id, title || ': your design will be ready for review by ' || fmt);
    end if;
    if new.assigned_designer_id is not null and new.assigned_designer_id is distinct from auth.uid() then
      insert into public.notifications (user_id, job_id, message)
      values (new.assigned_designer_id, new.id, title || ': design due ' || fmt);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_job_dates_change on public.jobs;
create trigger trg_notify_job_dates_change
  after update of deadline, design_due on public.jobs
  for each row
  execute function public.notify_job_dates_change();
