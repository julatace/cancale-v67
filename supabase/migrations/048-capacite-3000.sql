-- ════════════════════════════════════════════════════════════════════════════
-- 048 — CAPACITÉ 3 000 VENDEURS : DEUX GARDE-FOUS DE BASE (19 novembre 2026).
-- PAS APPLIQUÉE. Plan complet : docs/capacite-3000.md (§ « Ce qu'il faut changer »).
-- ════════════════════════════════════════════════════════════════════════════
-- Mesuré sur la vraie base le 19 nov. (lecture seule) :
--   • la réception d'un e-mail qui n'arrive PAS sur l'adresse unique de VRM relit
--     TOUTES les preuves d'adresse de TOUS les vendeurs (`lirePreuvesProuvees`,
--     api/email-inbound.js) : un coût qui croît avec le nombre de vendeurs, payé à
--     CHAQUE e-mail. L'index 1 permet de ne lire que les preuves de l'adresse
--     reçue (le changement de code est décrit dans le plan, étape 3 ; il n'est pas
--     fait ici). Sans le code, l'index ne sert à rien mais ne gêne rien.
--   • `sauvegarde.journal_ecritures` reçoit une ligne par écriture (≈ 6 800/jour
--     pour Julien seul, 245 000 lignes depuis le 30 sept., 40 Mo) et n'est JAMAIS
--     purgé. À 3 000 vendeurs : plusieurs Go par mois. L'index 2 (BRIN, minuscule)
--     et la fonction 3 permettent de purger par date, SUR SON GESTE (rien ne tourne
--     tout seul) ; la fonction n'est exécutable que par la clé de service.
--
-- Rien n'est effacé par ce fichier. Il se colle d'un bloc dans l'éditeur SQL de
-- Supabase (les `create index concurrently` ne bloquent pas les écritures ; ils ne
-- peuvent pas être dans une transaction, d'où l'absence de `begin`). Rejouable.
--
-- ANNULER :
--   drop index concurrently if exists public.app_data_preuve_adresse;
--   drop index concurrently if exists sauvegarde.journal_ecritures_at_brin;
--   drop function if exists sauvegarde.vrm_purger_journal(int, int);
-- ════════════════════════════════════════════════════════════════════════════

set lock_timeout = '3s';

-- 1. Les preuves d'adresse PROUVÉES, retrouvées par l'adresse (propriétaire NEUTRE).
--    Requête visée (PostgREST) :
--    app_data?owner=eq.00000000-…&id=like.vrm_email_preuve_*&data->>etat=eq.prouvee
--            &data->>adresse=in.(<adresses de livraison normalisées>)&select=id,owner:data->>owner,…
create index concurrently if not exists app_data_preuve_adresse
  on public.app_data ((data->>'adresse'))
  where owner = '00000000-0000-0000-0000-000000000000'::uuid
    and id like 'vrm_email_preuve_%';

-- 2. Le journal des écritures, rangé par date (BRIN : quelques Ko pour des millions de lignes).
create index concurrently if not exists journal_ecritures_at_brin
  on sauvegarde.journal_ecritures using brin (at);

-- 3. La purge du journal, par paquets (jamais un long verrou), au-delà de `p_jours`
--    jours (90 par défaut, jamais moins de 30). Rend le nombre de lignes retirées.
--    Appel (clé de service) : select sauvegarde.vrm_purger_journal(90);
create or replace function sauvegarde.vrm_purger_journal(p_jours int default 90, p_paquet int default 20000)
returns bigint
language plpgsql
security definer
set search_path = sauvegarde, pg_catalog
as $$
declare
  limite timestamptz := now() - make_interval(days => greatest(coalesce(p_jours, 90), 30));
  n bigint := 0;
  k bigint;
begin
  loop
    delete from sauvegarde.journal_ecritures
     where ctid in (select ctid from sauvegarde.journal_ecritures where at < limite limit greatest(coalesce(p_paquet, 20000), 1000));
    get diagnostics k = row_count;
    n := n + k;
    exit when k = 0 or n >= 5000000;
  end loop;
  return n;
end;
$$;
revoke all on function sauvegarde.vrm_purger_journal(int, int) from public, anon, authenticated;
grant execute on function sauvegarde.vrm_purger_journal(int, int) to service_role;

reset lock_timeout;
