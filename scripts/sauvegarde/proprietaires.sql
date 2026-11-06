-- Entre les données et les contraintes : la base jetable n'a pas les comptes
-- Supabase (auth.users n'est pas dans la sauvegarde) ; on y pose les seuls
-- identifiants que les tables restaurées citent dans une colonne « owner »,
-- pour que la clé étrangère abonnements → auth.users se rejoue telle quelle.
\set ON_ERROR_STOP 1
do $$ declare t record; begin
  for t in select c.table_name from information_schema.columns c
            where c.table_schema = 'public' and c.column_name = 'owner' and c.data_type = 'uuid' loop
    execute format('insert into auth.users(id) select distinct owner from public.%I where owner is not null on conflict do nothing', t.table_name);
  end loop;
end $$;
