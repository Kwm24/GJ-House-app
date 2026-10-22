-- 036_saved_quotes.sql
-- Migrates offset and digital print quotes from localStorage to the database.
-- All staff roles can read, insert, update and delete saved quotes.

create table if not exists public.saved_quotes (
  id          uuid        primary key default gen_random_uuid(),
  saved_by    uuid        references auth.users(id) on delete set null,
  quote_type  text        not null check (quote_type in ('offset', 'digital')),
  ref         text        not null,
  snapshot    jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (quote_type, ref)
);

alter table public.saved_quotes enable row level security;

drop policy if exists "Staff full access to saved_quotes" on public.saved_quotes;
create policy "Staff full access to saved_quotes" on public.saved_quotes
  for all
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('admin', 'cs', 'designer', 'production', 'accounts')
    )
  )
  with check (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('admin', 'cs', 'designer', 'production', 'accounts')
    )
  );
