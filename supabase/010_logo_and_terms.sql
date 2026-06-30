-- Company logo URL and terms of service for the printed quote.
alter table public.settings add column if not exists company_logo_url text;
alter table public.settings add column if not exists terms_of_service text;

-- Public bucket for the company logo. Logo must be publicly accessible
-- so the browser can load it when rendering the print/PDF output.
insert into storage.buckets (id, name, public)
values ('company-assets', 'company-assets', true)
on conflict (id) do nothing;

-- Only admin can upload/replace the logo.
drop policy if exists "Admin can upload company assets" on storage.objects;
create policy "Admin can upload company assets" on storage.objects for insert
  with check (bucket_id = 'company-assets' and public.is_admin());

drop policy if exists "Admin can update company assets" on storage.objects;
create policy "Admin can update company assets" on storage.objects for update
  using (bucket_id = 'company-assets' and public.is_admin());

-- Anyone (including the PDF renderer) can read the logo.
drop policy if exists "Public can view company assets" on storage.objects;
create policy "Public can view company assets" on storage.objects for select
  using (bucket_id = 'company-assets');
