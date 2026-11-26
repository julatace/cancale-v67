-- ════════════════════════════════════════════════════════════════════════════
-- 049 — LE PARRAINAGE À 20 % (25 novembre 2026)
--       ÉCRITE, PAS APPLIQUÉE : geste de Julien (docs/passation/2026-11-25-parrainage-20.md).
--       Règle : api/_lib/parrainage-regle.js · lectures/écritures : api/_lib/parrainage-gains.js.
-- ════════════════════════════════════════════════════════════════════════════
-- Décision de Julien (25 nov.) : « le client économise 10 % le premier mois et le
-- parrain touche 20 % de ce que je perçois tous les mois tant que son filleul
-- paye » ; le parrain « choisit s'il veut payer son abonnement avec ou s'il veut
-- le virement ».
--
-- Ce que cette migration AJOUTE (aucune donnée existante touchée, aucune suppression) :
--   parrainage_gains         une ligne par FACTURE payée d'un filleul (clé primaire : la
--                            facture ⇒ un webhook rejoué n'ajoute rien) : 20 % du payé,
--                            dû 14 jours après ; annulé = marqué, jamais effacé ; réduit
--                            au prorata d'un remboursement partiel ; `credite_le` posé
--                            quand le gain est parti sur le solde Stripe du parrain.
--   parrainage_annulations   chaque remboursement / litige / avoir reçu (par clé Stripe et
--                            par geste) — même forme que `partenaire_annulations` (043),
--                            table à part pour ne dépendre d'aucune autre migration.
--   parrainage_choix         le choix du parrain, AJOUTÉ à chaque changement (jamais
--                            réécrit) : le mode d'un gain est celui en vigueur à son échéance.
--   parrainage_iban          ⚠️ DONNÉE SENSIBLE : l'IBAN d'un parrain en mode virement.
--                            Lu et écrit par le serveur seul ; rendu masqué au parrain,
--                            en clair seulement à Julien (pour verser).
--   parrainage_versements    « Versé », noté sur le clic de Julien (date, montant). VRM ne
--                            verse RIEN.
-- RLS activée ET forcée, aucune policy, aucun droit pour anon ni authenticated.
-- Le programme reste ÉTEINT tant que `vrm_reglages.parrainage` ≠ '1' (027).
-- Se rejoue sans erreur (if not exists partout).
-- Retour arrière (à la main, si Julien le décide) : supprimer les cinq tables.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists public.parrainage_gains (
  facture            text primary key check (facture ~ '^in_[A-Za-z0-9]+$'),
  parrain            uuid not null,
  filleul            uuid not null,
  montant_centimes   integer not null check (montant_centimes > 0),
  facture_centimes   integer not null check (facture_centimes > 0),
  paye_le            timestamptz not null,
  mois               text not null check (mois ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  due_le             timestamptz not null,
  charge             text,
  payment_intent     text,
  annulee_le         timestamptz,
  annulee_raison     text check (annulee_raison is null or annulee_raison in ('remboursement', 'litige', 'avoir', 'anti-abus')),
  rembourse_centimes integer not null default 0 check (rembourse_centimes >= 0),
  credite_le         timestamptz,
  credit_centimes    integer check (credit_centimes is null or credit_centimes > 0),
  cree               timestamptz not null default now(),
  check (filleul <> parrain),
  check (montant_centimes * 5 <= facture_centimes),                 -- 20 % au plus
  check (rembourse_centimes < facture_centimes or annulee_le is not null),
  check (due_le >= paye_le + interval '14 days'),
  check ((annulee_le is null) = (annulee_raison is null))
);
create index if not exists parrainage_gains_parrain on public.parrainage_gains (parrain);
create index if not exists parrainage_gains_filleul on public.parrainage_gains (filleul);
create index if not exists parrainage_gains_charge on public.parrainage_gains (charge) where charge is not null;
create index if not exists parrainage_gains_pi on public.parrainage_gains (payment_intent) where payment_intent is not null;

create table if not exists public.parrainage_annulations (
  cle      text not null check (cle ~ '^(in|ch|py|pi)_[A-Za-z0-9]+$'),
  signal   text not null check (signal ~ '^(total|litige|cumul:[0-9]{1,9}|(re|pyr|cn)_[A-Za-z0-9]+)$'),
  raison   text not null check (raison in ('remboursement', 'litige', 'avoir')),
  centimes integer check (centimes is null or centimes > 0),
  le       timestamptz not null default now(),
  primary key (cle, signal)
);

create table if not exists public.parrainage_choix (
  id       uuid primary key default gen_random_uuid(),
  parrain  uuid not null,
  mode     text not null check (mode in ('credit', 'virement')),
  le       timestamptz not null default now()
);
create index if not exists parrainage_choix_parrain on public.parrainage_choix (parrain, le);

create table if not exists public.parrainage_iban (
  parrain    uuid primary key,
  iban       text not null check (iban ~ '^[A-Z]{2}[0-9]{2}[A-Z0-9]{11,30}$'),
  titulaire  text not null check (char_length(titulaire) between 2 and 70),
  le         timestamptz not null default now()
);

create table if not exists public.parrainage_versements (
  id                uuid primary key default gen_random_uuid(),
  parrain           uuid not null,
  montant_centimes  integer not null check (montant_centimes > 0 and montant_centimes <= 10000000),
  verse_le          date not null,
  cree              timestamptz not null default now()
);
create index if not exists parrainage_versements_parrain on public.parrainage_versements (parrain);

-- ── Fermées à tout navigateur ───────────────────────────────────────────────
alter table public.parrainage_gains enable row level security;
alter table public.parrainage_gains force row level security;
alter table public.parrainage_annulations enable row level security;
alter table public.parrainage_annulations force row level security;
alter table public.parrainage_choix enable row level security;
alter table public.parrainage_choix force row level security;
alter table public.parrainage_iban enable row level security;
alter table public.parrainage_iban force row level security;
alter table public.parrainage_versements enable row level security;
alter table public.parrainage_versements force row level security;
revoke all on public.parrainage_gains, public.parrainage_annulations, public.parrainage_choix,
  public.parrainage_iban, public.parrainage_versements from public, anon, authenticated, service_role;
-- Le serveur : ce dont il a besoin, rien de plus (aucune suppression, sauf l'IBAN que le parrain remplace).
grant select, insert, update on public.parrainage_gains to service_role;
grant select, insert on public.parrainage_annulations to service_role;
grant select, insert on public.parrainage_choix to service_role;
grant select, insert, update on public.parrainage_iban to service_role;
grant select, insert on public.parrainage_versements to service_role;
