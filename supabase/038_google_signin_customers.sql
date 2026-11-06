-- 038_google_signin_customers.sql
--
-- Google sign-in (One Tap) is for customers only.
--
-- 1. ensure_customer_profile(): called by the app after a Google sign-in. If
--    the signed-in user has no profile yet, it creates a CUSTOMER profile
--    (name + email from their Google account). It never touches an existing
--    profile, so it can't change anyone's role. This covers Google accounts
--    whose email already existed in auth.users without a profile (the
--    sign-up trigger only runs when a brand-new auth user is inserted).
-- 2. handle_new_user(): also read Google's "name" when "full_name" is absent.
--
-- Safe to re-run.

-- ── 1. Customer profile for the current user, if missing ───────────────────
create or replace function public.ensure_customer_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  prof public.profiles;
begin
  if uid is null then
    raise exception 'Not signed in';
  end if;

  insert into public.profiles (user_id, role, full_name, email)
  select u.id,
         'customer',
         coalesce(nullif(u.raw_user_meta_data->>'full_name', ''),
                  nullif(u.raw_user_meta_data->>'name', ''),
                  ''),
         u.email
  from auth.users u
  where u.id = uid
  on conflict (user_id) do nothing;   -- existing profiles (any role) are left alone

  select * into prof from public.profiles where user_id = uid;
  return prof;
end;
$$;

revoke all on function public.ensure_customer_profile() from public, anon;
grant execute on function public.ensure_customer_profile() to authenticated;

-- ── 2. Sign-up trigger: pick up Google's "name" too ─────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, full_name, phone, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''),
             nullif(new.raw_user_meta_data->>'name', ''),
             ''),
    nullif(new.raw_user_meta_data->>'phone', ''),
    new.email
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
