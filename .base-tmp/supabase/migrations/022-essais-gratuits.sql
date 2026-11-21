-- 022 — ESSAI GRATUIT : registre des « clés » déjà consommées.
--
-- Règle (Julien, 27 octobre) : l'essai gratuit de 7 jours n'est accordé qu'UNE
-- seule fois PAR ADRESSE E-MAIL ET PAR COMPTE VINTED. On range donc une ligne
-- par clé consommée :
--   · « email:jean@exemple.fr »       (l'e-mail du compte VRM, en minuscules)
--   · « vinted:123456 »               (un id de compte Vinted lié, un par ligne)
-- À la souscription, si AUCUNE de ces clés n'existe déjà, l'essai est accordé ;
-- quand il démarre vraiment (webhook Stripe « trialing »), les clés sont posées.
--
-- Lu et écrit par la SEULE clé de service (api/compte.js : essaiDejaUtilise /
-- enregistrerEssai). RLS active SANS aucune policy ⇒ ni `anon` ni
-- `authenticated` n'y accèdent : un vendeur ne doit pas pouvoir savoir qui a
-- déjà essayé. Le rôle `service_role` contourne RLS (c'est lui qui agit côté
-- serveur).

create table if not exists public.essais_gratuits (
  cle                text primary key,               -- 'email:...' ou 'vinted:...'
  owner              uuid,                            -- le vendeur qui a consommé l'essai
  abonnement_stripe  text,                            -- l'abonnement qui l'a démarré
  cree               timestamptz not null default now()
);

alter table public.essais_gratuits enable row level security;

-- Aucune policy : table fermée à tout rôle sauf la clé de service (bypass RLS).
revoke all on public.essais_gratuits from anon, authenticated;
