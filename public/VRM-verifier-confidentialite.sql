-- Diagnostic en lecture seule, à exécuter après la migration 021.
-- Ne lit aucune vente, adresse, pièce jointe, identité ou jeton.
-- La structure seule ne certifie pas les droits effectifs de deux sessions.
with tables_vrm as (
 select c.oid, c.relname, c.relrowsecurity
 from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname in ('app_data','vinted_accounts')
), attendues(nom) as (values
 ('vrm_anon_ferme'),('vrm_lecture_privee'),('vrm_insertion_privee'),
 ('vrm_modification_privee'),('vrm_suppression_privee')
), verrous as (
 select t.relname, a.nom, p.polname is not null and not p.polpermissive as presente_restrictive
 from tables_vrm t cross join attendues a
 left join pg_policy p on p.polrelid=t.oid and p.polname=a.nom
)
select jsonb_build_object(
 'controle','structure uniquement ; verifier aussi deux sessions distinctes',
 'tables_presentes',(select count(*)=2 from tables_vrm),
 'rls_active_sur_deux_tables',(select count(*)=2 and bool_and(relrowsecurity) from tables_vrm),
 'verrous_restrictifs_presents',(select count(*)=10 and bool_and(presente_restrictive) from verrous),
 'ecarts_politiques',(select coalesce(jsonb_agg(jsonb_build_object('table',relname,'politique',nom)) filter(where not presente_restrictive),'[]'::jsonb) from verrous),
 'droits_dangereux',(select coalesce(jsonb_agg(jsonb_build_object('table',t.relname,'role',r.nom,'droit',d.nom)),'[]'::jsonb)
   from tables_vrm t cross join (values('anon'),('authenticated')) r(nom)
   cross join (values('TRUNCATE'),('TRIGGER'),('REFERENCES')) d(nom)
   where has_table_privilege(r.nom,t.oid,d.nom)),
 'regles_a_relire',(select coalesce(jsonb_agg(jsonb_build_object('table',tablename,'politique',policyname,'mode',permissive,'roles',roles,'action',cmd,'lecture',qual,'ecriture',with_check)),'[]'::jsonb)
   from pg_policies where schemaname='public' and tablename in ('app_data','vinted_accounts'))
) as verification_structurelle;
