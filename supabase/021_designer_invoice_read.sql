-- Allow all internal staff roles to read invoices.
-- Previously only CS/Admin could write and Accounts could read.
-- Production and Designer roles now need read access so the Designer
-- lobby can display the design-fee line item from each job's invoice.

drop policy if exists "Staff can read invoices" on public.invoices;
create policy "Staff can read invoices" on public.invoices
  for select
  using (
    exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin', 'accounts', 'production', 'designer')
    )
  );
