-- Verrou supplémentaire : aucune donnée n’est supprimée, déplacée ou réattribuée.
-- À appliquer par l’administrateur dans le SQL Editor du projet de production.
-- Exige la colonne owner déjà créée par la migration multi-utilisateurs.
-- Les politiques existantes d’abonnement et d’équipe sont conservées.
begin;
do $$
declare t text; lecture text;
begin
 foreach t in array array['app_data','vinted_accounts'] loop
  if not exists(select 1 from information_schema.columns where table_schema='public' and table_name=t and column_name='owner') then
   raise exception 'Colonne owner absente sur %. Appliquer la migration multi-utilisateurs avant ce verrou.',t;
  end if;
  execute format('alter table public.%I enable row level security',t);
  execute format('drop policy if exists vrm_anon_ferme on public.%I',t);
  execute format('create policy vrm_anon_ferme on public.%I as restrictive for all to anon using (false) with check (false)',t);
  execute format('drop policy if exists vrm_proprietaire_permis on public.%I',t);
  execute format('create policy vrm_proprietaire_permis on public.%I as permissive for all to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()))',t);
  lecture := 'owner = (select auth.uid())';
  if t='app_data' and to_regprocedure('public.vrm_equipe_vendeur()') is not null and to_regprocedure('public.vrm_equipe_id_permis(text)') is not null then
   lecture := lecture || ' or (owner = (select public.vrm_equipe_vendeur()) and public.vrm_equipe_id_permis(id))';
  end if;
  execute format('drop policy if exists vrm_lecture_privee on public.%I',t);
  execute format('create policy vrm_lecture_privee on public.%I as restrictive for select to authenticated using (%s)',t,lecture);
  execute format('drop policy if exists vrm_insertion_privee on public.%I',t);
  execute format('create policy vrm_insertion_privee on public.%I as restrictive for insert to authenticated with check (owner = (select auth.uid()))',t);
  execute format('drop policy if exists vrm_modification_privee on public.%I',t);
  execute format('create policy vrm_modification_privee on public.%I as restrictive for update to authenticated using (owner = (select auth.uid())) with check (owner = (select auth.uid()))',t);
  execute format('drop policy if exists vrm_suppression_privee on public.%I',t);
  execute format('create policy vrm_suppression_privee on public.%I as restrictive for delete to authenticated using (owner = (select auth.uid()))',t);
 end loop;
end $$;
-- TRUNCATE contourne RLS : aucun client ne doit posséder ce droit.
revoke truncate, references, trigger on public.app_data, public.vinted_accounts from anon, authenticated;
commit;
-- Vérification structurelle (ne lit aucun contenu vendeur).
select tablename, rowsecurity from pg_tables where schemaname='public' and tablename in ('app_data','vinted_accounts');
select tablename, policyname, permissive, roles, cmd from pg_policies where schemaname='public' and tablename in ('app_data','vinted_accounts') order by tablename, policyname;
