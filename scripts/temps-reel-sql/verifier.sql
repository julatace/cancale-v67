-- VÉRIFICATION de la migration 040 une fois appliquée (lecture seule). Attendu : ok = true.
select (t.n = 1 and p.n = 1 and f.secdef and f.path_vide) as ok,
       t.n as declencheur, p.n as regle, f.secdef, f.path_vide
from (select count(*) n from pg_trigger where tgname = 'vrm_signal_ligne' and tgrelid = 'public.app_data'::regclass and not tgisinternal) t,
     (select count(*) n from pg_policy where polname = 'vrm_lignes_recevoir' and polrelid = 'realtime.messages'::regclass) p,
     (select coalesce(bool_and(prosecdef), false) secdef,
             coalesce(bool_and(proconfig @> array['search_path=""']), false) path_vide
        from pg_proc where proname = 'vrm_signal_ligne') f;
