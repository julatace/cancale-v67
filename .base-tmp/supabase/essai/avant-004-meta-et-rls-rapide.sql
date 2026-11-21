-- Avant 004 sur la base d'essai (12 nov., agent2-fiabilite-prod) : 004 retouche
-- trois politiques `tout_select` / `tout_insert` / `tout_update` que la vraie base
-- avait reçues À LA MAIN (jamais écrites dans une migration ; 036 les remplace).
-- Ici, sur une base vide, on les pose sous la même forme (le vendeur seul).
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_data' and policyname = 'tout_select') then
    create policy tout_select on public.app_data for select to authenticated using (owner = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_data' and policyname = 'tout_insert') then
    create policy tout_insert on public.app_data for insert to authenticated with check (owner = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'app_data' and policyname = 'tout_update') then
    create policy tout_update on public.app_data for update to authenticated using (owner = auth.uid()) with check (owner = auth.uid());
  end if;
end $$;
