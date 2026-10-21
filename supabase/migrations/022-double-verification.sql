-- La double vérification reste facultative. Dès qu'un facteur est VÉRIFIÉ,
-- les données privées exigent une session aal2 (SMS ou authentificateur).
-- À appliquer après 021 par l'administrateur ; aucune donnée n'est modifiée.
begin;
create or replace function public.vrm_mfa_autorise()
returns boolean language sql stable security definer set search_path = '' as $$
 select (auth.jwt()->>'aal' = 'aal2') or not exists (
  select 1 from auth.mfa_factors f
  where f.user_id = (select auth.uid()) and f.status = 'verified'
   and f.factor_type in ('totp','phone')
 );
$$;
revoke all on function public.vrm_mfa_autorise() from public, anon;
grant execute on function public.vrm_mfa_autorise() to authenticated;
do $$ declare t text; begin
 foreach t in array array['app_data','vinted_accounts'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists vrm_double_verification on public.%I',t);
  execute format('create policy vrm_double_verification on public.%I as restrictive for all to authenticated using ((select public.vrm_mfa_autorise())) with check ((select public.vrm_mfa_autorise()))',t);
 end loop;
end $$;
commit;
