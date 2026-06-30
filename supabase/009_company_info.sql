-- Company information stored in the single-row settings table so the
-- Admin can update the press name / address / contact details that print
-- on every quote without touching the code.
alter table public.settings add column if not exists company_name    text;
alter table public.settings add column if not exists company_address text;
alter table public.settings add column if not exists company_phone   text;
alter table public.settings add column if not exists company_email   text;
alter table public.settings add column if not exists company_vat_no  text;
