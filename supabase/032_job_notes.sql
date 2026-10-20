-- 032: Add internal staff notes to jobs
alter table public.jobs add column if not exists notes text;
