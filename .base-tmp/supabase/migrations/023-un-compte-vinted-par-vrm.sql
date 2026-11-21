-- 023 — UN COMPTE VINTED = UN SEUL COMPTE VRM
--
-- Demande de Julien (27 octobre) : « chaque compte Vinted doit être relié à un
-- seul compte VRM ». La migration 001 avait RELÂCHÉ l'unicité globale de
-- `vinted_user_id` en une unicité PAR propriétaire (`unique(owner,
-- vinted_user_id)`), ce qui autorise aujourd'hui le MÊME compte Vinted sous deux
-- comptes VRM différents (mesuré : `angeled92` est déclaré à la fois chez son
-- compte réel et chez un compte d'ESSAI du 2 octobre, `julien.fournier3535@…`).
--
-- ⚠️ DESTRUCTIF SI ON L'APPLIQUE À L'AVEUGLE. Poser une unicité globale pendant
-- qu'un doublon existe échouerait de toute façon — mais avec un message
-- cryptique. Ce fichier REFUSE D'ABORD, en NOMMANT le compte Vinted en double et
-- les propriétaires concernés, pour que Julien tranche QUEL compte VRM garde le
-- compte Vinted (supprimer un compte d'essai est irréversible, §2.3 — sa
-- décision, pas la mienne). Tant qu'un doublon subsiste, la migration ne pose
-- AUCUNE contrainte : elle s'arrête proprement, rien n'est modifié.
--
-- ⚠️ CÔTÉ CODE, À FAIRE AVANT/AVEC (pas dans ce fichier SQL) :
--   · l'extension écrit `vinted_accounts` en `on_conflict=owner,vinted_user_id`.
--     Une fois l'unicité GLOBALE posée, un 2ᵉ compte VRM qui capterait le même
--     compte Vinted recevra un 409 NON couvert par cet `on_conflict`.
--     `supabaseUpsert` (background.js) doit lire ce 409 comme « ce compte Vinted
--     appartient déjà à un autre compte VRM » — jamais perdre la ligne
--     existante, jamais réécrire des jetons vides (famille « rien lu ne vaut pas
--     rien »). À prouver au banc avant d'activer.
--
-- Rien n'est supprimé par ce fichier. Il ne fait qu'AJOUTER une garantie, et
-- seulement si la base est déjà propre.

do $$
declare
  conflits text;
begin
  -- Un compte Vinted (vinted_user_id non nul) rattaché à ≥ 2 propriétaires.
  select string_agg(
           format('vinted_user_id=%s → %s comptes VRM (%s)',
                  vinted_user_id, n, proprietaires),
           E'\n')
    into conflits
  from (
    select vinted_user_id,
           count(distinct owner)                  as n,
           string_agg(distinct owner::text, ', ') as proprietaires
    from public.vinted_accounts
    where vinted_user_id is not null
    group by vinted_user_id
    having count(distinct owner) > 1
  ) d;

  if conflits is not null then
    raise exception E'UN COMPTE VINTED PARTAGÉ PAR PLUSIEURS COMPTES VRM — rien n''a été changé.\n%\n\nTranche d''abord QUEL compte VRM garde chaque compte Vinted (souvent : supprimer un compte d''ESSAI), puis relance cette migration.', conflits;
  end if;

  -- Base propre : on pose l'unicité GLOBALE (partielle : une ligne en cours de
  -- liaison peut avoir vinted_user_id nul). On garde aussi l'index par
  -- propriétaire de la 001 (il sert l'`on_conflict` de l'extension).
  create unique index if not exists vinted_accounts_vinted_user_id_global_idx
    on public.vinted_accounts(vinted_user_id)
    where vinted_user_id is not null;

  raise notice 'Unicité globale posée : un compte Vinted = un seul compte VRM.';
end $$;
