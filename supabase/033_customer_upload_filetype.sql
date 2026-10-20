-- 033: Expand job_files.file_type to allow 'customer_upload'
-- The original check constraint only allowed ('reference', 'design').
-- This replaces it to also accept 'customer_upload' so customer-uploaded
-- resource files can be recorded in the table.

-- Drop whichever named constraint the DB generated for the inline check
do $$
declare
  c record;
begin
  for c in
    select conname
    from   pg_constraint
    where  conrelid = 'public.job_files'::regclass
      and  contype  = 'c'
      and  (conname like '%file_type%' or pg_get_constraintdef(oid) like '%file_type%')
  loop
    execute format('alter table public.job_files drop constraint if exists %I', c.conname);
  end loop;
end $$;

alter table public.job_files
  add constraint job_files_file_type_check
  check (file_type in ('reference', 'design', 'customer_upload'));
