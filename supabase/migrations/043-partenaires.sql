-- ════════════════════════════════════════════════════════════════════════════
-- 043 — LE PROGRAMME PARTENAIRE (15 novembre 2026)
--       ÉCRITE, PAS APPLIQUÉE : geste de Julien (pas à pas sans terminal dans
--       docs/passation/2026-11-15-partenaires.md). Règle : api/_lib/partenaires-regle.js.
-- ════════════════════════════════════════════════════════════════════════════
-- Décision de Julien (15 nov.) : un ami influenceur fait la promotion de VRM ;
-- 3 € par mois et par client payant, à vie (tant que le client paie), Solo ou Pro.
--
-- Ce que cette migration AJOUTE (rien d'autre, aucune donnée existante touchée,
-- aucune suppression) : cinq tables, toutes fermées aux navigateurs.
--   partenaires              un partenaire = un nom, un CODE (« LEO »), un contact
--                            facultatif, son compte VRM facultatif (pas soi-même),
--                            la pause, l'avantage du filleul (un coupon Stripe,
--                            ÉTEINT par défaut : `coupon` vide), l'EMPREINTE du jeton
--                            de sa page (jamais le jeton lui-même).
--   partenaire_filleuls      un compte VRM rattaché à un code — UNE fois (clé primaire).
--   partenaire_commissions   une ligne par FACTURE payée (clé primaire : la facture ⇒
--                            un webhook rejoué n'ajoute rien) ; un client = une
--                            commission par mois au plus (index unique partiel) ;
--                            annulée = marquée, jamais effacée ; (16 nov.) un
--                            remboursement PARTIEL la réduit au prorata
--                            (`rembourse_centimes`, il ne fait que monter).
--   partenaire_annulations   chaque remboursement / litige / avoir reçu (une ligne par
--                            clé Stripe — facture, paiement — et par geste de Stripe,
--                            `signal`, avec son montant `centimes`) : la règle rejuge la
--                            commission sur tous ses signaux, même reçus AVANT la
--                            facture payée (événements dans le désordre).
--   partenaire_versements    « Versé », noté sur le clic de Julien (date, montant).
--                            VRM ne verse RIEN.
-- RLS activée ET forcée, aucune policy, aucun droit pour anon ni authenticated :
-- seul le serveur (clé de service) lit et écrit. Le partenaire ne lit que SES
-- nombres, calculés par la route (`/api/compte?mode=partenaire&j=…`), jamais une table.
-- Se rejoue sans erreur (if not exists partout).
-- Retour arrière (à la main, si Julien le décide) : supprimer les cinq tables.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.partenaires (
  id               uuid primary key default gen_random_uuid(),
  code             text not null unique check (code ~ '^[A-Z0-9]{3,16}$'),
  nom              text not null check (char_length(nom) between 2 and 40),
  contact          text check (contact is null or char_length(contact) <= 120),
  compte           uuid,                                   -- son compte VRM s'il en a un
  pause_le         timestamptz,                            -- non nul = en pause
  coupon           text check (coupon is null or coupon ~ '^[A-Za-z0-9_-]{1,64}$'),
  jeton_empreinte  text unique check (jeton_empreinte is null or jeton_empreinte ~ '^[0-9a-f]{64}$'),
  cree             timestamptz not null default now()
);

create table if not exists public.partenaire_filleuls (
  filleul     uuid primary key,                            -- UNE fois par compte
  partenaire  uuid not null references public.partenaires (id),
  code        text not null,
  inscrit     timestamptz not null default now()
);
create index if not exists partenaire_filleuls_partenaire on public.partenaire_filleuls (partenaire);

create table if not exists public.partenaire_commissions (
  facture           text primary key check (facture ~ '^in_[A-Za-z0-9]+$'),
  partenaire        uuid not null references public.partenaires (id),
  filleul           uuid not null,
  montant_centimes  integer not null check (montant_centimes = 300),
  facture_centimes  integer not null check (facture_centimes > 0),
  paye_le           timestamptz not null,
  mois              text not null check (mois ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  due_le            timestamptz not null,
  charge            text,
  payment_intent    text,
  annulee_le        timestamptz,
  annulee_raison    text check (annulee_raison is null or annulee_raison in ('remboursement', 'litige', 'avoir')),
  rembourse_centimes integer not null default 0 check (rembourse_centimes >= 0),
  cree              timestamptz not null default now(),
  check (rembourse_centimes < facture_centimes or annulee_le is not null),
  check (due_le >= paye_le + interval '14 days'),
  check ((annulee_le is null) = (annulee_raison is null))
);
create unique index if not exists partenaire_commissions_un_par_mois
  on public.partenaire_commissions (filleul, mois) where annulee_le is null;
create index if not exists partenaire_commissions_partenaire on public.partenaire_commissions (partenaire);
create index if not exists partenaire_commissions_charge on public.partenaire_commissions (charge) where charge is not null;
create index if not exists partenaire_commissions_pi on public.partenaire_commissions (payment_intent) where payment_intent is not null;

create table if not exists public.partenaire_annulations (
  cle      text not null check (cle ~ '^(in|ch|py|pi)_[A-Za-z0-9]+$'),
  signal   text not null check (signal ~ '^(total|litige|cumul:[0-9]{1,9}|(re|pyr|cn)_[A-Za-z0-9]+)$'),
  raison   text not null check (raison in ('remboursement', 'litige', 'avoir')),
  centimes integer check (centimes is null or centimes > 0),
  le       timestamptz not null default now(),
  primary key (cle, signal)
);

create table if not exists public.partenaire_versements (
  id                uuid primary key default gen_random_uuid(),
  partenaire        uuid not null references public.partenaires (id),
  mois              text not null check (mois ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  montant_centimes  integer not null check (montant_centimes > 0 and montant_centimes <= 10000000),
  verse_le          date not null,
  cree              timestamptz not null default now()
);
create index if not exists partenaire_versements_partenaire on public.partenaire_versements (partenaire);

-- ── Fermées à tout navigateur ───────────────────────────────────────────────
alter table public.partenaires enable row level security;
alter table public.partenaires force row level security;
alter table public.partenaire_filleuls enable row level security;
alter table public.partenaire_filleuls force row level security;
alter table public.partenaire_commissions enable row level security;
alter table public.partenaire_commissions force row level security;
alter table public.partenaire_annulations enable row level security;
alter table public.partenaire_annulations force row level security;
alter table public.partenaire_versements enable row level security;
alter table public.partenaire_versements force row level security;
-- Aucune policy : ni un vendeur, ni un partenaire connecté à VRM, ni un visiteur
-- ne lit une ligne (les droits par défaut du schéma public, ouverts, sont retirés).
revoke all on public.partenaires, public.partenaire_filleuls, public.partenaire_commissions,
  public.partenaire_annulations, public.partenaire_versements from public, anon, authenticated, service_role;
-- Le serveur : ce dont il a besoin, rien de plus (aucune suppression : une commission annulée est
-- MARQUÉE, jamais effacée — les droits par défaut du schéma lui donnaient tout, ils sont retirés).
grant select, insert, update on public.partenaires to service_role;
grant select, insert on public.partenaire_filleuls to service_role;
grant select, insert, update on public.partenaire_commissions to service_role;
grant select, insert on public.partenaire_annulations to service_role;
grant select, insert on public.partenaire_versements to service_role;
