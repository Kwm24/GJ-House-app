-- Add needs_design flag to jobs.
-- When CS marks a quote as needing design and clicks "Send to Design Team",
-- this column is set to true and the status moves to ready_for_design so the
-- job appears in the Designer lobby.
-- Safe to re-run.

alter table public.jobs
  add column if not exists needs_design boolean not null default false;
