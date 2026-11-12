-- VÉRIFICATION de la migration 042 une fois appliquée (lecture seule). Attendu : ok = true.
select (f.n = 3 and r.secdef and r.path_vide and r.service and not r.publique and c.invoker and c.vendeur and not c.anonyme) as ok,
       f.n as fonctions, r.secdef as relier_definer, r.path_vide, r.service as relier_service, r.publique as relier_ouverte,
       c.invoker as commandes_invoker, c.vendeur as commandes_vendeur, c.anonyme as commandes_anonyme
from (select count(*) n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
       where s.nspname = 'public' and p.proname in ('vrm_vinted_relier', 'vrm_commandes_lire', 'vrm_commandes_ecrire')) f,
     (select coalesce(bool_and(p.prosecdef), false) secdef,
             coalesce(bool_and(p.proconfig @> array['search_path=""']), false) path_vide,
             coalesce(bool_and(has_function_privilege('service_role', p.oid, 'execute')), false) service,
             coalesce(bool_or(has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute')), false) publique
        from pg_proc p where p.proname = 'vrm_vinted_relier') r,
     (select coalesce(bool_and(not p.prosecdef and p.proconfig @> array['search_path=""']), false) invoker,
             coalesce(bool_and(has_function_privilege('authenticated', p.oid, 'execute')), false) vendeur,
             coalesce(bool_or(has_function_privilege('anon', p.oid, 'execute')), false) anonyme
        from pg_proc p where p.proname in ('vrm_commandes_lire', 'vrm_commandes_ecrire')) c;
