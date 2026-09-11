-- Auto-create a profiles row whenever a new auth user is registered.
-- Runs as a SECURITY DEFINER trigger so it bypasses RLS entirely —
-- no session needed, works even when email confirmation is enabled.
--
-- The signUp call passes role/full_name/phone in options.data (raw_user_meta_data).
-- Staff accounts created via the Supabase dashboard are unaffected because
-- ON CONFLICT DO NOTHING skips rows that already have a profile.
--
-- Safe to re-run.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (user_id, role, full_name, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'role', 'customer'),
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  )
  on conflict (user_id) do nothing;   -- never overwrite an existing profile

  return new;
end;
$$;

-- Drop and recreate so re-runs are safe
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- The manual INSERT policy is no longer needed (trigger handles it).
-- Keep it as a no-op drop so this file is idempotent.
drop policy if exists "Customers insert own profile" on public.profiles;
