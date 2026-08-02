-- ════════════════════════════════════════════════════════════════════════════
--  VRM — PASSAGE EN MULTI-VENDEURS
--  À coller dans Supabase → SQL Editor (https://supabase.com/dashboard →
--  ton projet → SQL Editor → New query → coller → Run).
--
--  CE QUE ÇA FAIT
--  Aujourd'hui toutes les données vivent dans des lignes sans propriétaire, et
--  la clé « anon » (publique, visible dans le code de l'app) peut tout lire.
--  Après cette migration, chaque ligne appartient à un compte, et c'est
--  POSTGRES qui refuse l'accès aux lignes des autres — pas le JavaScript de
--  l'app. C'est la différence entre « les autres ne voient pas » et « les
--  autres ne PEUVENT PAS voir » : même quelqu'un qui bidouille le code de la
--  page n'obtient que ses propres données.
--
--  ⚠️ ORDRE À RESPECTER — il y a DEUX étapes, séparées par une action dans
--  l'app. Ne lance pas l'étape 2 avant d'avoir fait ce qui est écrit entre les
--  deux, sinon tes données se retrouvent sans propriétaire et deviennent
--  invisibles pour tout le monde.
-- ════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
--  ÉTAPE 1 — Préparer le terrain (sans rien changer au fonctionnement actuel)
--  Tu peux la lancer tout de suite : l'app continue de marcher exactement pareil.
-- ─────────────────────────────────────────────────────────────────────────────

-- Colonne « propriétaire » sur les deux tables. Nullable pour l'instant :
-- tes lignes existantes n'ont pas encore de propriétaire, c'est normal.
alter table public.app_data
  add column if not exists owner uuid references auth.users(id) on delete cascade;

alter table public.vinted_accounts
  add column if not exists owner uuid references auth.users(id) on delete cascade;

-- Valeur par défaut = l'utilisateur connecté. Grâce à ça, l'app n'a rien à
-- envoyer : toute ligne créée depuis un compte connecté lui appartient
-- automatiquement.
alter table public.app_data      alter column owner set default auth.uid();
alter table public.vinted_accounts alter column owner set default auth.uid();

-- Index de lecture (une requête ne balaie plus que les lignes du vendeur).
create index if not exists app_data_owner_idx        on public.app_data(owner);
create index if not exists vinted_accounts_owner_idx on public.vinted_accounts(owner);


-- ═══════════════════════════════════════════════════════════════════════════
--  ⏸  À FAIRE MAINTENANT, AVANT L'ÉTAPE 2
--
--  1. Dans Supabase → Authentication → Providers → Email : désactive
--     « Confirm email » (sinon personne ne peut s'inscrire tant que tu n'as
--     pas branché un vrai serveur d'envoi d'emails — celui de Supabase ne
--     sert que pour les tests et n'écrit qu'aux membres du projet).
--
--  2. Ouvre l'app, crée TON compte (ton email + un mot de passe).
--
--  3. Récupère ton identifiant de compte : Supabase → Authentication → Users
--     → clique sur ton email → copie l'« User UID »
--     (ça ressemble à 3f7b2c10-9a4e-4c81-b6d2-0e5f9a1c7d43).
--
--  4. Colle-le ci-dessous à la place de METS-TON-UID-ICI, puis lance l'étape 2.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
--  ÉTAPE 2 — Te donner tes données, puis fermer la porte
-- ─────────────────────────────────────────────────────────────────────────────

-- 2a) Toutes les lignes existantes (ton historique : garage, numéros, ventes,
--     moisson de l'extension, emails…) deviennent les tiennes.
update public.app_data        set owner = 'METS-TON-UID-ICI'::uuid where owner is null;
update public.vinted_accounts set owner = 'METS-TON-UID-ICI'::uuid where owner is null;

-- 2b) Plus aucune ligne sans propriétaire, désormais.
alter table public.app_data        alter column owner set not null;
alter table public.vinted_accounts alter column owner set not null;

-- 2c) Deux vendeurs peuvent avoir une ligne « main » chacun : la clé devient
--     (propriétaire, id) au lieu de (id) seul.
alter table public.app_data drop constraint if exists app_data_pkey;
alter table public.app_data add  constraint app_data_pkey primary key (owner, id);

-- 2d) Idem pour les comptes Vinted : deux vendeurs pourraient (en théorie)
--     avoir capté le même identifiant de compte ; l'unicité devient par vendeur.
alter table public.vinted_accounts drop constraint if exists vinted_accounts_vinted_user_id_key;
create unique index if not exists vinted_accounts_owner_uid_idx
  on public.vinted_accounts(owner, vinted_user_id);

-- 2e) LE VERROU : Row Level Security. À partir d'ici, une requête ne peut
--     TOUCHER que les lignes dont owner = le compte connecté. Un visiteur non
--     connecté ne voit plus rien du tout.
alter table public.app_data        enable row level security;
alter table public.vinted_accounts enable row level security;

drop policy if exists "chacun ses lignes" on public.app_data;
create policy "chacun ses lignes" on public.app_data
  for all to authenticated
  using (owner = auth.uid())          -- ce que je peux LIRE / modifier
  with check (owner = auth.uid());    -- ce que je peux ÉCRIRE (pas au nom d'un autre)

drop policy if exists "chacun ses lignes" on public.vinted_accounts;
create policy "chacun ses lignes" on public.vinted_accounts
  for all to authenticated
  using (owner = auth.uid())
  with check (owner = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
--  VÉRIFICATION (facultatif mais rassurant) — à lancer après l'étape 2.
--  La 1re requête doit renvoyer 0 : plus aucune ligne orpheline.
--  La 2e doit montrer rowsecurity = true sur les deux tables.
-- ─────────────────────────────────────────────────────────────────────────────
-- select count(*) as lignes_sans_proprietaire from public.app_data where owner is null;
-- select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename in ('app_data','vinted_accounts');


-- ─────────────────────────────────────────────────────────────────────────────
--  CE QUI RESTE À FAIRE APRÈS (côté serveur, pas ici)
--  Les fonctions du dossier api/ (widget, réception des emails, rappels
--  d'expédition, notifications push) écrivent avec la clé « anon ». Une fois
--  RLS activé, elles n'auront plus le droit d'écrire.
--  → Ajouter la clé « service_role » dans Vercel (Settings → Environment
--    Variables → SUPABASE_SERVICE_KEY) et faire passer ces fonctions dessus,
--    en précisant explicitement le propriétaire de chaque ligne écrite.
--  Tant que ce n'est pas fait : garde RLS désactivé (n'applique que l'étape 1),
--  ou accepte que le widget et l'import des emails soient en pause.
-- ─────────────────────────────────────────────────────────────────────────────
