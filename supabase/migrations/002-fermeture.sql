-- ════════════════════════════════════════════════════════════════════════════
--  VRM — ÉTAPE 2 : FERMER LA BASE (chacun ne voit QUE ses lignes)
--
--  ÉTAPE 1 appliquée le 30 septembre 2026 (migration
--  `vrm_cloisonnement_etape1_proprietaire`) : colonne `owner` sur les deux
--  tables, toutes les lignes existantes attribuées au compte VRM
--  74eea6e7-f060-46b6-b9c7-d500cedf4738 (shopcancale35@gmail.com), index
--  (owner,id) et (owner,vinted_user_id). Sauvegarde intégrale dans le schéma
--  privé `sauvegarde` (*_20260930). Les accès étaient encore OUVERTS.
--
--  ⚠️ NE LANCER QUE QUAND LES TROIS CONDITIONS SONT MESURÉES VRAIES :
--   1. `SUPABASE_SERVICE_KEY` posée sur Vercel (sinon emails, rappels, widget
--      et notifications cessent d'écrire) — geste de Julien ;
--      `VRM_OWNER_UID` posée (fait le 30/09).
--   2. L'EXTENSION est connectée à son compte VRM : plus AUCUNE nouvelle ligne
--      à `owner` vide depuis 24 h. Mesure :
--        select id, updated_at from public.app_data where owner is null
--        order by updated_at desc limit 20;
--      (une écriture anonyme laisse owner vide : c'est le témoin.)
--   3. L'app est ouverte connectée (elle l'est : dernière connexion le 30/09).
--
--  Retour arrière : voir tout en bas.
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- Les dernières écritures anonymes (s'il en reste) reviennent au propriétaire.
update public.app_data        set owner = '74eea6e7-f060-46b6-b9c7-d500cedf4738' where owner is null;
update public.vinted_accounts set owner = '74eea6e7-f060-46b6-b9c7-d500cedf4738' where owner is null;
alter table public.app_data        alter column owner set not null;
alter table public.vinted_accounts alter column owner set not null;

-- La clé devient (owner, id) : deux vendeurs peuvent avoir chacun leur « main ».
alter table public.app_data drop constraint if exists app_data_pkey;
alter table public.app_data add constraint app_data_pkey primary key using index app_data_owner_id_uniq;
alter table public.vinted_accounts drop constraint if exists vinted_accounts_vinted_user_id_key;

-- LE VERROU.
alter table public.app_data        enable row level security;
alter table public.vinted_accounts enable row level security;

drop policy if exists tout_select on public.app_data;
drop policy if exists tout_insert on public.app_data;
drop policy if exists tout_update on public.app_data;

drop policy if exists "chacun ses lignes" on public.app_data;
create policy "chacun ses lignes" on public.app_data
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

drop policy if exists "chacun ses comptes" on public.vinted_accounts;
create policy "chacun ses comptes" on public.vinted_accounts
  for all to authenticated
  using (owner = auth.uid()) with check (owner = auth.uid());

commit;

-- Vérification : les deux doivent dire rowsecurity = true, et l'Advisor
-- Supabase ne doit plus signaler « RLS Disabled » ni « Sensitive Columns ».
-- select tablename, rowsecurity from pg_tables where schemaname='public';

-- ── RETOUR ARRIÈRE (si quelque chose casse) ────────────────────────────────
-- create policy tout_select on public.app_data for select using (true);
-- create policy tout_insert on public.app_data for insert with check (true);
-- create policy tout_update on public.app_data for update using (true) with check (true);
-- alter table public.vinted_accounts disable row level security;
