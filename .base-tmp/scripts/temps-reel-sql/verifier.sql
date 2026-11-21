-- VÉRIFICATION de la migration 040 une fois appliquée (lecture seule). Attendu : ok = true.
select (t.n = 1 and p.n = 1 and f.secdef and f.path_vide and o.oui) as ok,
       t.n as declencheur, p.n as regle, f.secdef, f.path_vide, o.oui as interrupteur
from (select count(*) n from pg_trigger where tgname = 'vrm_signal_ligne' and tgrelid = 'public.app_data'::regclass and not tgisinternal) t,
     (select count(*) n from pg_policy where polname = 'vrm_lignes_recevoir' and polrelid = 'realtime.messages'::regclass) p,
     (select coalesce(bool_and(prosecdef), false) secdef,
             coalesce(bool_and(proconfig @> array['search_path=""']), false) path_vide
        from pg_proc where proname = 'vrm_signal_ligne') f,
     (select coalesce(bool_and(has_function_privilege('authenticated', p.oid, 'execute') and not has_function_privilege('anon', p.oid, 'execute')), false) oui
        from pg_proc p where proname = 'vrm_temps_reel') o;
