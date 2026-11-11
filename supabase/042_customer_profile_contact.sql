-- 042_customer_profile_contact.sql
--
-- Customer profile page + reaching the customer on the right number.
--
-- 1. New profile fields the customer fills in from their portal:
--      whatsapp           WhatsApp number (if different from phone)
--      contact_email      email to contact them on (Google users keep their
--                         Google sign-in email; this can be another one)
--      company_name       business / organisation name
--      preferred_contact  'whatsapp' | 'phone' | 'email'
-- 2. update_my_profile(): the ONLY way a customer can change their profile.
--    It edits just those fields + name/phone on their own row (never role,
--    is_active, etc.). There is still no general self-update policy.
-- 3. customer_contact(user_id) / job_customer_contact(job_id): staff (any
--    lobby) get a customer's contact details, so Designer / CS "Notify via
--    WhatsApp / Email" goes to the customer, not whatever phone was typed
--    on the invoice. Falls back to the job's client name / phone.
--
-- Safe to re-run.

-- ── 1. Columns ─────────────────────────────────────────────────────────────
alter table public.profiles add column if not exists whatsapp          text;
alter table public.profiles add column if not exists contact_email     text;
alter table public.profiles add column if not exists company_name      text;
alter table public.profiles add column if not exists preferred_contact text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_preferred_contact_check') then
    alter table public.profiles
      add constraint profiles_preferred_contact_check
      check (preferred_contact is null or preferred_contact in ('whatsapp', 'phone', 'email'));
  end if;
end $$;

-- ── 2. Self-service profile update ────────────────────────────────────────
create or replace function public.update_my_profile(
  p_full_name         text,
  p_phone             text,
  p_whatsapp          text,
  p_contact_email     text,
  p_company_name      text,
  p_preferred_contact text
)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  prof public.profiles;
  email_clean text := nullif(lower(trim(coalesce(p_contact_email, ''))), '');
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if char_length(coalesce(p_full_name, '')) > 120
     or char_length(coalesce(p_phone, '')) > 30
     or char_length(coalesce(p_whatsapp, '')) > 30
     or char_length(coalesce(p_company_name, '')) > 120
     or char_length(coalesce(email_clean, '')) > 200 then
    raise exception 'One of the fields is too long';
  end if;
  if email_clean is not null and email_clean !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;
  if p_preferred_contact is not null and p_preferred_contact not in ('whatsapp', 'phone', 'email') then
    raise exception 'Unknown contact preference';
  end if;

  update public.profiles
     set full_name         = nullif(trim(coalesce(p_full_name, '')), ''),
         phone             = nullif(trim(coalesce(p_phone, '')), ''),
         whatsapp          = nullif(trim(coalesce(p_whatsapp, '')), ''),
         contact_email     = email_clean,
         company_name      = nullif(trim(coalesce(p_company_name, '')), ''),
         preferred_contact = p_preferred_contact
   where user_id = auth.uid()
  returning * into prof;

  if prof.id is null then
    raise exception 'Profile not found';
  end if;
  return prof;
end;
$$;

revoke all on function public.update_my_profile(text, text, text, text, text, text) from public, anon;
grant execute on function public.update_my_profile(text, text, text, text, text, text) to authenticated;

-- ── 3. Staff: a customer's contact details ────────────────────────────────
create or replace function public.customer_contact(p_user_id uuid)
returns table (
  full_name text, phone text, whatsapp text, email text,
  company_name text, preferred_contact text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles me
     where me.user_id = auth.uid()
       and me.role in ('cs', 'admin', 'designer', 'production', 'accounts')
       and coalesce(me.is_active, true)
  ) then
    raise exception 'Not allowed';
  end if;

  return query
    select p.full_name, p.phone,
           coalesce(p.whatsapp, p.phone),
           coalesce(p.contact_email, p.email),
           p.company_name, p.preferred_contact
      from public.profiles p
     where p.user_id = p_user_id and p.role = 'customer';
end;
$$;

create or replace function public.job_customer_contact(p_job_id uuid)
returns table (
  full_name text, phone text, whatsapp text, email text,
  company_name text, preferred_contact text, linked boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  j public.jobs;
begin
  if not exists (
    select 1 from public.profiles me
     where me.user_id = auth.uid()
       and me.role in ('cs', 'admin', 'designer', 'production', 'accounts')
       and coalesce(me.is_active, true)
  ) then
    raise exception 'Not allowed';
  end if;

  select * into j from public.jobs where id = p_job_id;
  if j.id is null then
    raise exception 'Job not found';
  end if;

  -- The linked customer account first; the job's typed details fill gaps
  return query
    select coalesce(p.full_name, j.client_name),
           coalesce(p.phone, j.client_phone),
           coalesce(p.whatsapp, p.phone, j.client_phone),
           coalesce(p.contact_email, p.email),
           p.company_name,
           p.preferred_contact,
           p.user_id is not null
      from (select 1) one
      left join public.profiles p
        on p.user_id = j.customer_id and p.role = 'customer';
end;
$$;

revoke all on function public.customer_contact(uuid)     from public, anon;
revoke all on function public.job_customer_contact(uuid) from public, anon;
grant execute on function public.customer_contact(uuid)     to authenticated;
grant execute on function public.job_customer_contact(uuid) to authenticated;
