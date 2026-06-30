-- Public Profiles
-- Safe to re-run: uses IF NOT EXISTS / DROP POLICY IF EXISTS instead of bare CREATE.

create table if not exists public.profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role text not null check (role in ('cs','production','designer','accounts','customer','admin')),
  full_name text,
  phone text
);

alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = user_id);
