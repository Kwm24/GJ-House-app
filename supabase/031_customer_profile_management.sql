-- 031: Allow CS and admin to update customer profiles (name, phone only)
-- Admin already has broader access via the service-role operations;
-- this explicitly grants CS staff the ability to update a customer's
-- display name and phone number via the client SDK.

drop policy if exists "CS and admin can update customer profiles" on public.profiles;

create policy "CS and admin can update customer profiles"
  on public.profiles
  for update
  to authenticated
  using (
    role = 'customer'
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid()
        and p.role in ('cs', 'admin')
        and (p.is_active is null or p.is_active = true)
    )
  )
  with check (role = 'customer');
