-- 037_login_background_and_production_rates.sql
-- 1. settings.login_background  — admin-set background image for all sign-in / sign-up pages
-- 2. profiles.can_edit_digital_rates — lets the admin turn one (or more) Production
--    accounts into a "rates" account that can edit the Digital Print Quoter rates
-- 3. update_digital_rates(rates) — the ONLY way those accounts can write settings:
--    it changes digital_quote_rates and nothing else
-- Safe to re-run.

-- ── 1. Login background ───────────────────────────────────────────────────────
-- { "image_url": "...", "overlay": 0.55 }  (settings are publicly readable, see 020)
alter table public.settings
  add column if not exists login_background jsonb;

-- ── 2. Production rates permission ────────────────────────────────────────────
alter table public.profiles
  add column if not exists can_edit_digital_rates boolean not null default false;

-- Only admins can update other profiles (006 "Admin can update profiles"), and
-- there is no self-update policy on profiles, so staff cannot grant this flag
-- to themselves.

-- ── 3. Restricted save function ───────────────────────────────────────────────
create or replace function public.update_digital_rates(rates jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed boolean;
begin
  select (p.role = 'admin')
      or (p.role = 'production' and p.can_edit_digital_rates and coalesce(p.is_active, true))
    into allowed
    from public.profiles p
   where p.user_id = auth.uid()
   limit 1;

  if not coalesce(allowed, false) then
    raise exception 'Not allowed to edit digital print rates';
  end if;

  if rates is null or jsonb_typeof(rates) <> 'object' then
    raise exception 'Rates must be a JSON object';
  end if;

  update public.settings
     set digital_quote_rates = rates,
         updated_at          = now()
   where id = 1;
end;
$$;

revoke all on function public.update_digital_rates(jsonb) from public;
grant execute on function public.update_digital_rates(jsonb) to authenticated;
