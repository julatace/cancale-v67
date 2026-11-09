-- ════════════════════════════════════════════════════════════════════════════
-- 029 — UN COMPTE VINTED NE SE RELIE QU'APRÈS PREUVE
--       (9 novembre 2026) — PAS ENCORE APPLIQUÉE (geste de Julien,
--       docs/passation/2026-11-09-securite-2.md).
-- ════════════════════════════════════════════════════════════════════════════
-- Revue de sécurité du 9 nov., défaut #5 (docs/passation/2026-11-09-securite.md).
-- La RLS de `vinted_accounts` (`owner = auth.uid()`) garantit que la ligne est
-- au vendeur, PAS que le compte Vinted est le sien : avec son propre jeton VRM,
-- n'importe qui pouvait écrire par l'API de la base une ligne portant le
-- `vinted_user_id` (public) d'un autre — et, une fois la 023 posée, bloquer le
-- vrai propriétaire, brûler son essai gratuit (`essais_gratuits` clé
-- `vinted:…`), lui faire dire « déjà pris ».
--
-- Décision de Julien (9 nov.) : un compte Vinted ne se relie qu'après PREUVE.
-- Ce fichier pose un déclencheur sur `vinted_accounts` qui, pour les rôles du
-- client (`authenticated`, `anon` — c.-à-d. l'API de la base avec un jeton de
-- vendeur ou la clé publique) :
--   · REFUSE l'INSERT d'une ligne NEUVE (un couple owner + vinted_user_id qui
--     n'existe pas encore) ;
--   · laisse passer l'INSERT d'un couple qui EXISTE déjà chez ce vendeur : c'est
--     l'« upsert » de l'extension (`on_conflict=owner,vinted_user_id`), que
--     Postgres présente d'abord comme un INSERT avant de le changer en mise à
--     jour — les jetons d'un compte déjà relié se renouvellent comme avant ;
--   · REFUSE tout UPDATE qui change `vinted_user_id` ou `owner` ;
--   · laisse passer tout le reste (jetons, csrf, login, domaine, date…) et les
--     DELETE (un vendeur retire toujours SES comptes).
-- La clé de service (`service_role`, routes serveur) n'est pas bornée : c'est
-- `POST /api/vinted-connect` qui relie un compte NEUF, après avoir vu Vinted
-- accepter le jeton présenté (Vinted vérifie la signature ; `account_id` du
-- jeton = l'identifiant relié) et vérifié qu'aucun AUTRE compte VRM ne le porte.
--
-- Erreur rendue : SQLSTATE 42501, message commençant par `vrm_vinted_preuve` —
-- PostgREST répond 403 ; l'extension (5.332+) lit ce code et passe alors par la
-- route serveur. Avant cette migration, rien ne change pour personne (l'upsert
-- direct passe, comme aujourd'hui).
--
-- ⚠️ ORDRE : installer l'extension 5.332 (Chrome ET Orion) AVANT d'appliquer ce
--    fichier. Une extension plus ancienne ne sait pas passer par la route : elle
--    continuerait de renouveler les comptes déjà reliés, mais un compte Vinted
--    NOUVEAU resterait non relié (refus noté `ecriture_ratee_vinted_accounts_403`).
-- Additif : aucune donnée lue, déplacée ou supprimée. Aucun DROP.
--
-- ── ESSAI (rien n'est gardé) ─────────────────────────────────────────────────
--   Coller dans l'éditeur SQL de Supabase, d'un bloc :
--     begin;
--     <le contenu de ce fichier ENTRE `begin;` et `commit;` ci-dessous>
--     select set_config('request.jwt.claims',
--       '{"sub":"00000000-0000-4000-8000-0000000000e1","role":"authenticated"}', true);
--     set local role authenticated;
--     do $e$ begin
--       insert into public.vinted_accounts (owner, vinted_user_id)
--         values ('00000000-0000-4000-8000-0000000000e1', '999999999999');
--       raise exception 'ESSAI RATÉ : une ligne neuve est passée sans preuve';
--     exception when insufficient_privilege then
--       if sqlerrm not like 'vrm_vinted_preuve%' then raise; end if;
--       raise notice 'ESSAI OK : %', sqlerrm;
--     end $e$;
--     rollback;
--   Attendu : « ESSAI OK : vrm_vinted_preuve … » puis ROLLBACK (aucune ligne
--   écrite : le déclencheur refuse AVANT toute écriture, et tout est annulé).
--
-- ── RETOUR ARRIÈRE (sans DROP) ───────────────────────────────────────────────
--     alter table public.vinted_accounts disable trigger vrm_vinted_accounts_preuve;
--   (et pour le remettre : `… enable trigger vrm_vinted_accounts_preuve;`).
--   Retrait complet, si un jour il le faut (DROP : confirmation humaine) :
--     drop trigger if exists vrm_vinted_accounts_preuve on public.vinted_accounts;
--     drop function if exists public.vrm_vinted_accounts_preuve();
--
-- ── VÉRIFICATION (lecture seule) ─────────────────────────────────────────────
--     select tgname, tgenabled from pg_trigger
--      where tgrelid = 'public.vinted_accounts'::regclass and not tgisinternal;
--   Attendu : `vrm_vinted_accounts_preuve | O`.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- SECURITY INVOKER (le défaut) : `current_user` est le rôle de la requête
-- (`authenticated` derrière PostgREST, `service_role` pour la clé de service,
-- `postgres` dans l'éditeur SQL). La recherche d'une ligne existante se fait
-- donc sous la RLS du vendeur : il ne voit que SES lignes, c'est voulu.
create or replace function public.vrm_vinted_accounts_preuve()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.vinted_user_id is not null and exists (
         select 1 from public.vinted_accounts v
          where v.owner = new.owner and v.vinted_user_id = new.vinted_user_id) then
      return new;
    end if;
    raise exception using
      errcode = '42501',
      message = 'vrm_vinted_preuve: un compte Vinted se relie par vrm.center (preuve du jeton chez Vinted)',
      hint = 'POST /api/vinted-connect';
  end if;
  if new.owner is distinct from old.owner
     or new.vinted_user_id is distinct from old.vinted_user_id then
    raise exception using
      errcode = '42501',
      message = 'vrm_vinted_preuve: l''identité d''un compte Vinted relié ne se change pas par l''API de la base',
      hint = 'POST /api/vinted-connect';
  end if;
  return new;
end
$$;

-- Personne n'appelle cette fonction directement (un déclencheur l'exécute).
revoke all on function public.vrm_vinted_accounts_preuve() from public, anon, authenticated;

create or replace trigger vrm_vinted_accounts_preuve
  before insert or update on public.vinted_accounts
  for each row execute function public.vrm_vinted_accounts_preuve();

commit;
