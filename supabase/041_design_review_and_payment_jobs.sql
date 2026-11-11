-- 041_design_review_and_payment_jobs.sql
--
-- Fixes the design-approval flow and duplicate jobs from payments.
--
-- 1. New status 'design_review' = the designer has uploaded artwork and it is
--    waiting for the CUSTOMER to approve it. 'design_ready' now only ever
--    means "customer approved" (Production can start).
--      approved → ready_for_design → design_review → design_ready → in_production …
-- 2. approve_job_design(): customers can approve only a job whose design is
--    waiting for them (design_review / ready_for_design).
-- 3. Status notifications: correct messages for each design step (before,
--    payment told the customer "your design is ready for review" and the
--    designer's upload told them "design approved").
-- 4. confirm_job_payment(): lets Accounts / CS link a payment to an existing
--    job (move it out of 'sent', attach the customer) without ever moving a
--    job BACKWARDS, and without a broad UPDATE permission on jobs.
-- 5. Jobs that are currently 'design_ready' but were never approved by the
--    customer are moved to 'design_review' (the customer is notified to
--    review them).
-- 6. invoices.source_ref: the quotation an invoice was converted from.
--
-- Safe to re-run.

-- ── 2. Customer approval ──────────────────────────────────────────────────
create or replace function public.approve_job_design(p_job_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
begin
  update public.jobs
     set design_approved = true,
         status          = 'design_ready'
   where id          = p_job_id
     and customer_id = auth.uid()
     and status in ('design_review', 'ready_for_design')
     and not design_approved;

  if not found then
    if exists (select 1 from public.jobs where id = p_job_id and customer_id = auth.uid() and design_approved) then
      return;   -- already approved: nothing to do
    end if;
    raise exception 'This design is not waiting for your approval.';
  end if;
end;
$$;

revoke all on function public.approve_job_design(uuid) from public, anon;
grant execute on function public.approve_job_design(uuid) to authenticated;

-- ── 3. Status-change notifications ────────────────────────────────────────
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
      select p.user_id, new.id, staff_msg
      from public.profiles p
      where p.role = any(target_roles) and p.is_active;
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

-- ── 4. Link a payment to an existing job (forward-only) ───────────────────
create or replace function public.confirm_job_payment(
  p_job_id       uuid,
  p_customer_id  uuid    default null,
  p_needs_design boolean default false
)
returns public.jobs
language plpgsql
security definer
set search_path = public
as $$
declare
  j public.jobs;
begin
  if not exists (
    select 1 from public.profiles p
     where p.user_id = auth.uid()
       and p.role in ('accounts', 'cs', 'admin')
       and coalesce(p.is_active, true)
  ) then
    raise exception 'Not allowed to record payments';
  end if;

  update public.jobs
     set customer_id  = coalesce(customer_id, p_customer_id),
         needs_design = needs_design or coalesce(p_needs_design, false),
         -- Only an unpaid quote moves forward on payment; a job already in the
         -- pipeline keeps its status (a balance payment never resets it).
         status = case
                    when status = 'sent' and coalesce(p_needs_design, false) then 'ready_for_design'
                    when status = 'sent'                                    then 'approved'
                    when status = 'approved' and coalesce(p_needs_design, false) and not needs_design then 'ready_for_design'
                    else status
                  end
   where id = p_job_id
  returning * into j;

  if j.id is null then
    raise exception 'Job not found';
  end if;
  return j;
end;
$$;

revoke all on function public.confirm_job_payment(uuid, uuid, boolean) from public, anon;
grant execute on function public.confirm_job_payment(uuid, uuid, boolean) to authenticated;

-- ── 5. Jobs marked "design ready" by an upload but never approved ─────────
update public.jobs
   set status = 'design_review'
 where status = 'design_ready'
   and not design_approved
   and needs_design;

-- ── 6. Remember which quotation an invoice was converted from ─────────────
-- So a payment against the invoice finds the job already created from the
-- quotation (and the converted quotation stops appearing as payable).
alter table public.invoices
  add column if not exists source_ref text;

create index if not exists invoices_source_ref_idx on public.invoices (source_ref);
