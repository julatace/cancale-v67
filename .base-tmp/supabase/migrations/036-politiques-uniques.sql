-- (11 nov., intégration) renumérotée 033 → 036 : la 033 est celle des points de restauration.
-- ════════════════════════════════════════════════════════════════════════════
-- 033 — UNE SEULE POLITIQUE PERMISSIVE PAR TABLE (app_data, vinted_accounts)
--       (11 novembre 2026) — PAS ENCORE APPLIQUÉE (geste de Julien,
--       docs/passation/2026-11-11-base-optimisee.md).
-- ════════════════════════════════════════════════════════════════════════════
-- POURQUOI : l'assistant « Performance » de Supabase (11 nov., 12:34 UTC) signale
-- des politiques PERMISSIVES en double. Sur `app_data` : « chacun ses lignes »,
-- tout_select, tout_insert, tout_update, vrm_proprietaire_permis ; sur
-- `vinted_accounts` : « chacun ses comptes », vrm_proprietaire_permis. Toutes
-- disent la même chose (owner = l'utilisateur connecté), mais Postgres les
-- évalue TOUTES, à chaque ligne, à chaque requête (elles se combinent en OU).
--
-- CE QUE ÇA FAIT : on garde `vrm_proprietaire_permis` (021 : FOR ALL, TO
-- authenticated, owner = (select auth.uid()) en lecture ET en écriture) et on
-- retire les autres permissives — SEULEMENT si leur condition est exactement
-- la même (owner = auth.uid(), sous l'une des deux écritures que la base a
-- connues). Un OU de conditions identiques vaut la condition seule : les accès
-- ne changent pas (prouvé sur base jetable : scripts/audit-politiques-uniques-sql.cjs,
-- deux vendeurs, un abonnement expiré, anonyme, identité absente — mêmes
-- lectures, mêmes écritures permises et refusées avant et après).
--
-- CE QUI N'EST PAS TOUCHÉ :
--   · toutes les RESTRICTIVES (abonnement_requis, abonnement_requis_effacer,
--     vrm_anon_ferme, vrm_lecture_privee, vrm_insertion_privee,
--     vrm_modification_privee, vrm_suppression_privee) — elles restent en « ET » ;
--   · `equipe_lit` (016, mode équipe) si elle existe : sa condition est AUTRE
--     (lecture du membre d'équipe), elle reste ;
--   · aucune donnée, aucun droit (GRANT), aucune fonction.
--
-- GARDE-FOUS (sinon RIEN n'est changé, la transaction est annulée et le message
-- dit pourquoi) :
--   · `vrm_proprietaire_permis` doit exister, permissive, FOR ALL, TO
--     authenticated, avec owner = (select auth.uid()) des deux côtés ;
--   · `vrm_anon_ferme` (restrictive, anon) doit exister ;
--   · toute AUTRE permissive (hors equipe_lit) doit porter exactement la même
--     condition et ne viser que authenticated / anon / public. Une permissive
--     inconnue ou plus large (using (true)…) ARRÊTE tout : on ne retire jamais
--     une politique dont on n'a pas prouvé qu'elle double celle qu'on garde.
--
-- MODE D'EMPLOI (éditeur SQL de Supabase) : coller TOUT le fichier, Run.
--   Les DROP POLICY demandent une confirmation (« destructive operation ») :
--   c'est attendu, ils ne retirent que des doublons. Rejouable : la 2e fois, il
--   n'y a plus rien à retirer. La dernière requête liste les politiques
--   restantes : on doit lire, par table, UNE ligne PERMISSIVE
--   (vrm_proprietaire_permis, + equipe_lit si la 016 est appliquée) et les
--   RESTRICTIVE inchangées.
-- ANNULER : rien n'est perdu — recréer une politique retirée est un CREATE
--   POLICY de la même condition (texte d'origine : migrations 002 et 004).
-- ════════════════════════════════════════════════════════════════════════════
begin;
do $$
declare
  t text;
  p record;
  garde record;
  formes text[];
  retirees text := '';
begin
  foreach t in array array['app_data', 'vinted_accounts'] loop
    -- 1. Celle qu'on garde : présente et exactement owner = (select auth.uid()).
    select k.qual, k.with_check into garde
      from pg_catalog.pg_policies k
     where k.schemaname = 'public' and k.tablename = t and k.policyname = 'vrm_proprietaire_permis'
       and k.permissive = 'PERMISSIVE' and k.cmd = 'ALL' and k.roles = array['authenticated']::name[];
    if not found then
      raise exception 'vrm_politiques_033 : vrm_proprietaire_permis absente ou différente sur % (appliquer la 021 d''abord) — rien n''est changé', t;
    end if;
    if garde.qual is distinct from garde.with_check
       or garde.qual not in ('(owner = ( SELECT auth.uid() AS uid))') then
      raise exception 'vrm_politiques_033 : vrm_proprietaire_permis sur % ne porte pas owner = (select auth.uid()) (lu : % / %) — rien n''est changé', t, garde.qual, garde.with_check;
    end if;
    -- Les deux écritures que la base a connues de la MÊME condition (002, puis 004).
    formes := array[garde.qual, '(owner = auth.uid())'];

    -- 2. Le verrou anonyme doit être là (une permissive « public » retirée ne
    --    change rien pour anon : elle était déjà fermée par cette restrictive).
    if not exists (select 1 from pg_catalog.pg_policies k
                    where k.schemaname = 'public' and k.tablename = t and k.policyname = 'vrm_anon_ferme'
                      and k.permissive = 'RESTRICTIVE' and 'anon' = any (k.roles)) then
      raise exception 'vrm_politiques_033 : vrm_anon_ferme absente sur % (appliquer la 021 d''abord) — rien n''est changé', t;
    end if;

    -- 3. Les autres permissives : retirées SEULEMENT si elles doublent la gardée.
    for p in
      select k.policyname, k.cmd, k.roles, k.qual, k.with_check
        from pg_catalog.pg_policies k
       where k.schemaname = 'public' and k.tablename = t and k.permissive = 'PERMISSIVE'
         and k.policyname not in ('vrm_proprietaire_permis', 'equipe_lit')
       order by k.policyname
    loop
      if not (p.roles <@ array['authenticated', 'anon', 'public']::name[]) then
        raise exception 'vrm_politiques_033 : « % » sur % vise d''autres rôles (%) — rien n''est changé', p.policyname, t, p.roles;
      end if;
      if (p.qual is not null and not (p.qual = any (formes)))
         or (p.with_check is not null and not (p.with_check = any (formes)))
         or (p.qual is null and p.with_check is null) then
        raise exception 'vrm_politiques_033 : « % » sur % n''a pas la condition owner = auth.uid() (lu : % / %) — rien n''est changé', p.policyname, t, p.qual, p.with_check;
      end if;
      execute format('drop policy %I on public.%I', p.policyname, t);
      retirees := retirees || format(' %s.%s', t, p.policyname);
    end loop;
  end loop;
  raise notice 'vrm_politiques_033 : retirées :%', case when retirees = '' then ' aucune (déjà fait)' else retirees end;
end $$;
commit;

-- Vérification (structure seulement, ne lit aucune donnée vendeur).
select tablename, policyname, permissive, roles, cmd
  from pg_catalog.pg_policies
 where schemaname = 'public' and tablename in ('app_data', 'vinted_accounts')
 order by tablename, permissive, policyname;
