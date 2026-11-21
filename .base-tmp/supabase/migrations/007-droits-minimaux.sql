-- ════════════════════════════════════════════════════════════════════════════
-- 007 — LA CLÉ PUBLIQUE NE PEUT PLUS QUE LIRE (4 octobre 2026) — appliquée
-- ════════════════════════════════════════════════════════════════════════════
-- Audit de sécurité : `anon` et `authenticated` gardaient TOUS les droits de
-- table (insert, update, delete, TRUNCATE, references, trigger) sur `app_data`
-- et `vinted_accounts`. RLS bloquait déjà l'écriture sans compte (aucune règle
-- pour `anon`) — mais TRUNCATE n'est PAS soumis à RLS, et un droit qui ne sert
-- à rien est un droit de trop le jour où une règle est mal écrite.
-- ⚠️ `anon` garde SELECT : la sonde de schéma de l'app (`select=owner&limit=1`)
--    et la sonde « lecture sans compte » du panneau Sécurité en dépendent, et
--    RLS lui rend `[]`. Le serveur passe par la clé de service, qui n'est pas
--    concernée.
-- Effet visible : la sonde d'écriture du panneau Sécurité reçoit désormais
-- 401 (au lieu d'un refus de règle) — elle le lit déjà comme « fermée ».
revoke insert, update, delete, truncate, references, trigger on public.app_data, public.vinted_accounts from anon;
revoke truncate, references, trigger on public.app_data, public.vinted_accounts from authenticated;

-- Les deux fonctions de `meta` (migration 004) n'avaient pas de search_path
-- figé (alerte du conseiller Supabase). Elles n'appellent que des fonctions
-- du catalogue et `public.vrm_meta` (qualifiée) : vérifié dans une transaction
-- annulée, `meta` est toujours rempli.
alter function public.vrm_meta(text, jsonb) set search_path = '';
alter function public.vrm_meta_trigger() set search_path = '';

-- Restent signalés par le conseiller, VOULUS :
--   · vrm_reglages : RLS sans règle = personne d'autre que le serveur ;
--   · vrm_acces / vrm_acces_ok exécutables par un vendeur connecté : elles ne
--     disent que SON accès (auth.uid()), c'est ce que la porte et RLS lisent.
