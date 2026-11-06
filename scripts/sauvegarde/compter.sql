-- Compte les lignes de chaque table du schéma public, et de app_data par
-- famille d'id (le mot avant le premier « _ » : harvest, email, coffre, main…).
-- Sortie : une ligne « table|famille|nombre » par compte. LECTURE SEULE : la
-- transaction est ouverte en lecture seule avant la moindre requête.
-- Sert deux fois : sur la vraie base au moment de la sauvegarde (avant ET après
-- pg_dump), puis sur la base jetable restaurée — les sorties se comparent.
\set ON_ERROR_STOP 1
\pset tuples_only on
\pset format unaligned
begin transaction read only;
select format('select %L || ''|*|'' || count(*) from public.%I', c.relname, c.relname)
  from pg_class c
 where c.relnamespace = 'public'::regnamespace and c.relkind in ('r','p')
 order by c.relname
\gexec
select 'app_data|' || f || '|' || n
  from (select split_part(id, '_', 1) f, count(*) n from public.app_data group by 1) x
 order by f;
commit;
