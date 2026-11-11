-- ═══════════════════════════════════════════════════════════════════════════
-- 040 — L'USAGE PAR VENDEUR (11 nov. 2026, lot « limites-client »)
-- ═══════════════════════════════════════════════════════════════════════════
-- Julien : « un client qui a 5 000 annonces ne doit pas ralentir l'app pour
-- les autres ». Pour le VOIR, le tableau du propriétaire (« Ton entreprise »,
-- `/api/compte?mode=pilotage`) montre une ligne d'usage par vendeur : nombre
-- de lignes et octets stockés. PostgREST ne sait pas faire `pg_column_size`
-- ⇒ une fonction, lisible par la CLÉ DE SERVICE SEULE (jamais par un
-- navigateur : aucun droit pour `anon` ni `authenticated`).
--
-- LECTURE SEULE. Rien n'est écrit, rien n'est changé. Une lecture de toute la
-- table : appelée seulement à l'ouverture du tableau du propriétaire.
-- Sans cette migration, le tableau dit « — (migration 040 pas appliquée) ».
--
-- Appliquer : coller dans l'éditeur SQL de Supabase. Annuler :
--   drop function if exists public.vrm_usage_vendeurs(int);
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.vrm_usage_vendeurs(p_max int default 20)
returns table (owner uuid, lignes bigint, octets bigint, vendeurs bigint, octets_total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with u as (
    select a.owner, count(*)::bigint as lignes, coalesce(sum(pg_column_size(a.data)), 0)::bigint as octets
    from public.app_data a
    where a.owner is not null
    group by a.owner
  )
  select u.owner, u.lignes, u.octets,
         count(*) over ()::bigint as vendeurs,
         sum(u.octets) over ()::bigint as octets_total
  from u
  order by u.octets desc
  limit greatest(1, least(coalesce(p_max, 20), 200));
$$;

revoke all on function public.vrm_usage_vendeurs(int) from public;
revoke all on function public.vrm_usage_vendeurs(int) from anon;
revoke all on function public.vrm_usage_vendeurs(int) from authenticated;
grant execute on function public.vrm_usage_vendeurs(int) to service_role;
