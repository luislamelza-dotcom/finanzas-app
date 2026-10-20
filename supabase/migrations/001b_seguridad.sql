-- Solo el usuario dueño puede usar la tabla, y si tiene 2FA, solo con sesión verificada (aal2).
create or replace function public.es_dueno() returns boolean language sql stable set search_path = '' as $$
  select (select auth.uid()) = 'f24ecac1-fd3d-4bba-b26a-fca462bae59a'::uuid $$;
create policy "solo_dueno" on public.docs as restrictive for all to authenticated using (public.es_dueno()) with check (public.es_dueno());
create or replace function public.aal_ok() returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt()->>'aal'), 'aal1') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified') $$;
revoke all on function public.aal_ok() from public, anon;
grant execute on function public.aal_ok() to authenticated;
create policy "requiere_2fa_si_activo" on public.docs as restrictive to authenticated using (public.aal_ok()) with check (public.aal_ok());
