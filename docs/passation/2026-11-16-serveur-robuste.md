# 16 nov. 2026 — Serveur robuste (lot `serveur-robuste`)

Branche `claude/serveur-robuste` (depuis `origin/main` b8f26f36d). Missions (46) et (48) du
brief du 16 nov. Sources relues : `2026-11-11-familles-serveur.md`,
`2026-11-11-serveur-migrations.md`, `2026-11-11-robustesse-serveur.md`,
`2026-11-12-revue-fin.md`, `2026-11-11-securite-revue.md`, et la revue d'origine
`docs/passation/robustesse/serveur.md` (branche `claude/agent2-robustesse` — les « H » de la
mission sont ses points HAUTS numérotés 7 à 30). Toujours **12 fonctions `api/`**, aucune
extension touchée, **aucune migration** (rien à appliquer), aucune écriture en vraie base (une
seule LECTURE pour M73, ci-dessous).

## ÉTAT À LA REPRISE

Tout est poussé sur `claude/serveur-robuste`. Gardien : `scripts/audit-serveur-robuste.cjs`
(36 contrôles qui EXÉCUTENT les routes ; `--prouve` : rouge sur origin/main + mutations).
Reste ouvert : voir « Pas fait » en bas. Geste de Julien : **aucun**.

## Ce qui était déjà fait sur `main` (vérifié présent, pas refait)

| point | où |
|---|---|
| M50 même compte Vinted chez deux vendeurs | `vrm_vinted_relier` (migration **042**, écrite, pas appliquée — geste de Julien déjà dans `2026-11-11-serveur-migrations.md`) ; sans elle, l'unicité 023 se dit « déjà relié ». Aucune migration neuve n'est nécessaire. |
| M54 frein des sessions d'extension | `api/_lib/frein-fork.js` (12 nov.) |
| M75 trou de numérotation des factures Pro | `prendreNumero` reprend le dernier numéro abandonné (12 nov.) |
| M78 verrou des actions eBay | `executerAvecJournal` : même action « en cours » ⇒ 409 (12 nov.) |
| M79 `COMPTEUR_BILAN_MOIS` | dans le contexte du vendeur (12 nov.) |
| H6 H7 H8 H10 H11 H12 H13 H15 H16 H17 H25 H27 H28 | familles-serveur / robustesse-serveur / serveur-migrations (11 nov.) |
| H14 verrou du cron | bail `cron_bail_{moment}` (`api/_lib/cron-lots.js`) |
| H18 atomicité des webhooks Stripe | `ecrireStatut` PATCH conditionnel `evenement_ts` + `maj` |
| H23 suppression eBay | lecture indexée (026) ; sans elle, `ilike` sur un pseudo sûr seulement |
| H26 clé du widget vérifiée avant les lectures | `ownerDuToken` avant tout (revue de sécurité du 11 nov.) |

## Ce qui change ici

| point | défaut | réglé par | preuve |
|---|---|---|---|
| **H19** deux checkouts | deux onglets à des minutes différentes ⇒ deux abonnements prélevés ; un webhook pas encore arrivé laissait rouvrir un paiement | `api/_lib/checkout-unique.js` : avant d'ouvrir, Stripe RELU — abonnements du client (`status=all`, un vivant ⇒ 409) ; sessions des 24 h au nom du vendeur : OUVERTE ⇒ expirée, TERMINÉE dont l'abonnement vit ⇒ 409 « ton paiement vient d'aboutir » ; Stripe muet ⇒ 503, rien n'ouvre | H19 ×6 (vrai `api/compte.js`, faux Stripe À ÉTAT de `_monde-paiement.cjs`, qui sert maintenant la liste des sessions, l'expiration et refuse de payer une session expirée) |
| **H20** client réabonné effacé | la suppression ne lisait que l'abonnement de la ligne | `clients-partis.js` : TOUS ses abonnements chez Stripe ; un autre vivant ⇒ ni avis ni effacement ; pas su ⇒ rien | `audit-clients-partis` H20 ×2 |
| **H30** effacement sur un seul constat | un inventaire, un passage, jusqu'à 5 comptes | double constat (noté au 1er passage, effacé au 2e, ≥ 20 h après) ; `MAX_SUPPRESSIONS` 5 → **1** ; un effacement incomplet ARRÊTE les suivants | `audit-clients-partis` H30 ×4 (tests d'avant portés sur la règle : un passage de constat la veille) |
| **H21/H22** refresh Vinted rotatif | deux relais renouvelaient en parallèle ; écriture sans condition (écrasait la paire posée par l'extension) ; `vinted-refresh` n'écrivait qu'une fois | `api/_lib/renouvellement-vinted.js` : BAIL par compte (`vinted_renouv_{uid}`, comparer-et-échanger), base RELUE juste avant, écriture CONDITIONNELLE (`refresh_token=eq.<consommé>`), 3 essais ; l'autre relais attend la paire neuve (≤ 3 s) sans rappeler Vinted. Les jetons ne sortent toujours jamais du serveur | H21/H22 ×6 (les deux vraies routes, faux Vinted) |
| **H24** synchro eBay en série | 20 GetItem × 25 s : coupée avant de ranger commandes et règles | 4 à la fois, 8 s chacun, budget 25 s ; une annonce pas commencée à temps : « budget », dite | `audit-ebay-route` [R-sync-parallele] ×2 |
| **H29** montant deviné | « le plus gros montant € » rangé comme le net viré | montant vide + `montantPasLu: true` ; une tournure reconnue reste lue | `audit-robustesse-serveur` H29 ×2 |
| **H9** départage par taille | `findNumeroByTitle` départageait deux titres égaux par la taille (§2.4, §5) | un SEUL titre identique ⇒ son N° ; plusieurs ⇒ rien | `audit-robustesse-serveur` H9 ×2 |
| **M73** uid de l'envoi léger | une extension mal reliée rangeait les commandes d'un compte qui n'est pas à lui | **mesuré (lecture seule, 16 nov.)** : 47 lignes `harvest_*_orders_*`, 12 avec un uid absent de `vinted_accounts`, **0 sans autre ligne captée**. Règle : relié OU déjà capté chez lui (une autre ligne `harvest_{uid}_*`, `_` échappé) ; sinon 409 `compte-inconnu`, rien écrit ; pas su ⇒ 503. Aucune vraie vente refusée | M73 ×5 |
| **B141** jeton SMS | filtre construit sans `encodeURIComponent` | encodé | jugé sur le code (une forme invalide est refusée avant : aucune entrée ne peut le montrer) |
| **(48) page « nouveau mot de passe »** | un lien de récupération fabriqué par un tiers (SON compte) s'ouvrait : la victime y tapait son mot de passe habituel et repartait connectée au compte du tiers | même règle que les liens de l'app (`src/lienEmail.js`) : un AUTRE compte connecté ici ⇒ rien ; demandé ici (`vrm_lien_demande` < 48 h, posée aussi par le renvoi de la page), même compte connecté, ou PKCE ⇒ le formulaire ; sinon « C'est bien ton compte ? » : écrire l'adresse du compte (aucun indice affiché). La marque part au succès | banc `recuperation-auth` I–L (15 cas, captures 390 regardées) ; `recuperation-pannes-interface` porté (la marque posée) ; MDP ×5 |
| **(48) débit des liens publics à jeton** | agenda, catalogue, comptable, widget, SMS : aucun débit | `prendreDebitPublic` (`debit-vendeur.js`) : par IP 30/min · 300/h, par jeton (empreinte) 20/min · 200/h, en mémoire d'instance (aucun service payant, aucune lecture de base), AVANT toute lecture, 429 + `Retry-After` | DÉBIT ×4 |
| **(48) partage de fiche** | la fonction n'est PAS sur `main` (branche `claude/partage-fiche`, jamais fusionnée) ; sa ligne vit chez le vendeur, qui pouvait y écrire `expire: 2099` | **fait sur la branche `claude/partage-fiche`** (commit 3f99cd6e1) : l'expiration est SCELLÉE par le serveur (HMAC owner · ligne · jeton · expire, clé de service) ; touchée hors du serveur ⇒ la même 404 | `audit-partage-fiche` D7a + mutation « sceau ignoré » (sur cette branche) |

Bancs et fausses bases mis à la VRAIE forme (une route relit maintenant la liste Stripe, le compte
Vinted) : `audit-abonnement`, `audit-lancement`, `audit-mentions-paiement`,
`bancs/partenaires-serveur` (listes Stripe vides servies), `_monde-paiement.cjs` (sessions à
état), `_faux-compte-rgpd.cjs` (liste des abonnements d'un client), `audit-ventes-envoi-leger`
et `audit-serveur-migrations` (le compte Vinted relié servi).

## Pas fait (et pourquoi)

- **M73, chemin direct** : un envoi COMPLET et court part encore DIRECTEMENT de l'extension vers
  la base (voie `direct`) ; la règle ne couvre que la route légère. La vraie fin : que
  `vinted_accounts` liste tous les comptes captés (029), puis une règle RLS.
- **H19, au-delà de 24 h** : une session ouverte il y a plus de 24 h n'est pas relue (Stripe
  expire lui-même une session au bout de 24 h).
- **Partage de fiche** : reste à intégrer (branche à part, son propre lot).
- H24 : le budget (25 s) n'est pas joué par un banc (il faudrait 25 s d'attente) ; le parallèle l'est.

## Vérifié

Voir la fin du récit (sorties recopiées) et le rapport de PR.
