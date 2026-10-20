-- 028: Notify customer when a job is first created or linked to their account
--
-- The existing status-change trigger (007 / 027) only fires on UPDATE OF status.
-- When createJobFromInvoice INSERTs a brand-new job row with customer_id already
-- set, no trigger fires at all — so the customer sees the job in their portal
-- but never receives a bell notification.
--
-- This migration adds a second trigger function that covers two cases:
--   A. AFTER INSERT  — job created with customer_id already attached
--   B. AFTER UPDATE OF customer_id — job later linked to a customer account
--      (e.g. via assignCustomerToJob in the CS Jobs tab)

create or replace function public.notify_customer_job_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  job_label text;
  msg       text;
begin
  job_label := coalesce(new.job_title, new.quote_ref, 'Your new job');

  -- Case A: INSERT — customer_id was set at creation time
  if (TG_OP = 'INSERT') then
    if new.customer_id is not null then
      msg := job_label || ' has been added to your account';
      insert into public.notifications (user_id, job_id, message)
      values (new.customer_id, new.id, msg);
    end if;

  -- Case B: UPDATE — customer_id was just linked (changed from NULL to a value)
  elsif (TG_OP = 'UPDATE') then
    if new.customer_id is distinct from old.customer_id
       and new.customer_id is not null
       and old.customer_id is null
    then
      msg := job_label || ' has been linked to your account';
      insert into public.notifications (user_id, job_id, message)
      values (new.customer_id, new.id, msg);
    end if;
  end if;

  return new;
end;
$$;

-- INSERT trigger
drop trigger if exists trg_notify_customer_job_insert on public.jobs;
create trigger trg_notify_customer_job_insert
  after insert on public.jobs
  for each row
  execute function public.notify_customer_job_created();

-- UPDATE OF customer_id trigger (separate trigger, same function)
drop trigger if exists trg_notify_customer_job_linked on public.jobs;
create trigger trg_notify_customer_job_linked
  after update of customer_id on public.jobs
  for each row
  execute function public.notify_customer_job_created();
