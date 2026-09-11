-- Fix: infinite recursion in profiles RLS
-- The "Staff read customer profiles" policy in 013 caused recursion because
-- it queried public.profiles from inside a SELECT policy ON public.profiles.
--
-- Fix: a SECURITY DEFINER function reads the caller's role bypassing RLS,
-- so the policy can use it without triggering itself.
-- Safe to re-run.

-- Step 1: helper function that reads the current user's role without RLS
create or replace function public.my_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid() limit 1;
$$;

-- Step 2: drop the recursive policy that broke sign-in
drop policy if exists "Staff read customer profiles" on public.profiles;

-- Step 3: the original own-profile policy (keep as-is — non-recursive)
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile" on public.profiles for select
  using (auth.uid() = user_id);

-- Step 4: staff policy now uses the safe helper instead of a sub-select
drop policy if exists "Staff read all profiles" on public.profiles;
create policy "Staff read all profiles" on public.profiles for select
  using (public.my_role() in ('cs', 'admin'));

-- Step 5: keep the self-registration insert policy (non-recursive, fine)
drop policy if exists "Customers insert own profile" on public.profiles;
create policy "Customers insert own profile" on public.profiles for insert
  with check (
    auth.uid() = user_id
    and role = 'customer'
  );
