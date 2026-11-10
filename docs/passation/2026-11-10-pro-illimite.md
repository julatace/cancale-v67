# 10 novembre 2026 (20 h) — Pro illimité (branche `claude/pro-illimite`)

Julien (10 nov., 20 h) : « on fait un nombre de comptes de vente illimité » pour Pro
(19,99 €). Cette décision **annule** « Pro = 10 comptes vendeurs » (lot BO, PR #1105,
`2026-11-10-pro-10-comptes.md`). Solo ne change pas : un compte vendeur par plateforme
(migration 030).

## Ce qui a été défait (exactement ce que le lot BO avait ajouté)

On a annulé le diff du lot BO (`c084dc8e..6d008f52`) sur ses fichiers de code. Les
changements faits depuis par d'autres lots sont gardés.

- `api/_lib/plan-regle.js` : plus de `MAX_VENDEURS_PRO`, `listeVendeursPro`,
  `cleVendeurPro`, `metaVendeursPro`, `lireMetaPro`, `etatVendeursPro`, `CGV_PRO_DIX_DEPUIS`
  ni de branche Pro limitée. Comme avant le lot BO : **en Pro, tous les comptes comptent**.
  `planDeLAbonnement` ne lit plus `vrm_pro_vendeurs`. `regleVentes` ignore `comptesPro`
  et `comptesVendeurs.pro`. `OFFRES.pro.phrase` = « Comptes vendeurs illimités : tous tes
  comptes vendent, tout entre dans tes totaux. »
- `api/compte.js` : `mode=compte-vendeur` avec `{ plateforme: 'pro' }` ⇒ **409
  `pro-illimite`** (« En Pro, tous tes comptes vendent : rien à choisir. »), rien n'est
  écrit chez Stripe. `mode=abonnement` ne renvoie plus `proLimite`, `comptesPro` ni
  `maxVendeursPro`. Le webhook ne range plus de liste `pro` dans `comptes_vendeurs`.
  `CGV_VERSION` = `2026-11-10`.
- Écran : plus de feuille « Quels 10 comptes vendent ? » (`QuelsComptesPro`), plus de
  ligne de coque, plus de rangée « Tes 10 comptes vendeurs » dans Paramètres, plus de
  mention « hors de tes 10 » dans l'aperçu des ventes. L'aperçu Solo reste.
- Textes : FAQ de l'accueil (« avec Pro, tous tes comptes vendent, sans limite »),
  confirmation « Passer à Pro » (« Tous tes comptes vendent, sans limite : leurs ventes
  reviennent tout de suite dans tes totaux. »), toast « Tu es en Pro : tous tes comptes
  vendent ».
- CGV (`public/legal/cgv.html`, datées du 10 novembre) : Pro = « tous tes comptes
  vendeurs, sans limite de nombre », sur toutes les plateformes, sans choix à faire.
  L'encadré du haut parle d'un « nombre illimité de comptes vendeurs ». **À faire
  relire avec le reste.**
- `supabase/migrations/031-pro-dix-comptes.sql` **supprimée**. Vérifié en lecture seule
  sur la vraie base : la contrainte `abonnements_comptes_pro_valide` n'existe pas, la
  colonne `comptes_vendeurs` (030) existe, et aucune ligne ne porte de clé `pro`.

## Preuves

| contrôle | aujourd'hui | origin/main (`git archive`) | mutations |
|---|---|---|---|
| `scripts/audit-plans-solo-pro.cjs --prouve` : la §7 Pro-10 est retirée. Nouvelle §7 « Pro illimité » : 50 comptes par plateforme (200 ventes) ; une liste de 10 dans `comptesPro`, dans `comptes_vendeurs.pro` ou dans les métadonnées Stripe ⇒ **aucun compte écarté**. Elle vérifie aussi : la route `pro` répond 409 sans rien écrire, `mode=abonnement` ne renvoie aucune liste, le webhook ne range rien, `regleDuVendeur` lit une vieille liste sans rien écarter (100 comptes), l'état de l'app et les écrans, l'accueil et les CGV | 122 verts | **11 rouges** (règle, app, écrans, CGV) | 2 nouvelles (« Pro limité à 10 comptes Vinted », « Pro : comptes vendeurs des autres plateformes appliqués ») ⇒ chacune rouge |
| `scripts/bancs/pro-illimite.cjs` (remplace `pro-10-comptes.cjs`, rendu réel, 12 comptes, 390/1512, clair/sombre, réponse propre ET réponse avec un reste du lot BO) | 17 verts | **9 rouges** | `BANC_MUTATION=limite` ⇒ 4 rouges |
| bancs `plans-solo-pro` (32), `solo-plateformes` (43) | verts | — | — |
| suites-serveur, bilan-semaine (`--recopie` ne change rien à `api/_lib/ventes-regle.js`), comptes-exclus, abonnement, lancement, mentions-paiement, fonctions-api, variables, tdz, coherence, identite, icones ; `npm run build` | verts | — | — |

Captures regardées : Paramètres → Abonnement (1512 clair, 390 sombre), Ventes « Tous »
(390 sombre), page des offres de l'accueil (390, 1512 sombre).

Défaut vu, mais pas causé par ce lot : à 390 px, le bloc des prix de l'accueil est
coupé à droite (« par mois · Solo » élargit la colonne). On voit la même chose sur
origin/main.

## Gestes de Julien

1. Faire relire les CGV (paragraphe Pro).
2. Ne pas appliquer de migration 031 : elle n'existe plus.
