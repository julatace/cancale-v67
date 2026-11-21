-- ════════════════════════════════════════════════════════════════════════════
-- 005 — L'ABONNEMENT DE CHAQUE VENDEUR (Stripe), 4 octobre 2026
-- ════════════════════════════════════════════════════════════════════════════
-- Julien : « un abonnement à 9,99 € par mois pour tout le monde sauf moi, la
-- facturation se fait tous les mois à partir du moment où la personne prend
-- l'abonnement ».
--
-- ⚠️ POURQUOI UNE TABLE À PART, ET PAS UNE LIGNE DE app_data :
--    un vendeur peut ÉCRIRE ses propres lignes de app_data (RLS owner =
--    auth.uid()). Une ligne « abonnement » là-dedans, il pourrait se la réécrire
--    lui-même en « active » — l'abonnement se contournerait depuis la console du
--    navigateur. Ici, un vendeur peut LIRE sa ligne et rien d'autre : seule la
--    route serveur (clé de service), sur un événement Stripe SIGNÉ, l'écrit.
--
-- Rien d'autre ne change : table neuve, vide, aucune donnée existante touchée.
create table if not exists public.abonnements (
  owner              uuid primary key references auth.users(id) on delete cascade,
  statut             text not null,                -- statut Stripe : active, trialing, past_due, canceled, unpaid, incomplete…
  client_stripe      text,                         -- cus_…
  abonnement_stripe  text,                         -- sub_…
  fin_periode        timestamptz,                  -- prochaine échéance (ou fin d'accès si résilié)
  annule_fin_periode boolean not null default false,
  mode_test          boolean not null default true, -- livemode=false côté Stripe
  evenement_ts       bigint not null default 0,    -- `created` du dernier événement appliqué (les webhooks arrivent dans le désordre)
  maj                timestamptz not null default now()
);

alter table public.abonnements enable row level security;
alter table public.abonnements force row level security;

-- Le vendeur lit SA ligne. Aucune politique d'écriture : ni anon ni authenticated
-- ne peuvent créer, modifier ou effacer une ligne (la clé de service contourne
-- RLS, c'est elle — et elle seule — qu'utilise le webhook).
-- (pas de « drop policy » : la table est neuve, et l'outil SQL de la session
--  attend une confirmation humaine pour tout DROP — il expirait sans rien faire.)
create policy abonnements_lecture_soi on public.abonnements
  for select to authenticated
  using (owner = (select auth.uid()));

revoke all on public.abonnements from anon;
revoke insert, update, delete, truncate on public.abonnements from authenticated;
grant select on public.abonnements to authenticated;

-- Un client Stripe ne correspond qu'à un vendeur.
create unique index if not exists abonnements_client_stripe_uniq on public.abonnements (client_stripe) where client_stripe is not null;
