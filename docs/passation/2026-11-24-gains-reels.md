# 24 nov. 2026 — « Ce que tu gagnes vraiment » (lot `claude/gains-reels`)

Choisi par Julien le 24 nov. : par paire, par modèle, par source d'achat et par compte — le bénéfice réel (prix, frais,
achat, port), le délai moyen de vente, ce qui rapporte le plus et le moins — « pour savoir quoi racheter ». Seulement
des chiffres réels, avec la part connue dite.

Branche partie d'`origin/main`, fusionnée avec `origin/claude/style-clair` (#1326) et `origin/claude/rentabilite-source`
(#1340) (vrais merges ; conflits seulement dans `src/nouveautes.js` et `CLAUDE.md` §9, les deux lignes gardées).

## Mesure de la vraie base (lecture seule, 24 nov. matin, projections et comptes seulement)

Compte du propriétaire de l'installation, lignes `harvest_*_orders_sold` (13 comptes Vinted) et `main` :
- **2 592 ventes Vinted lues, dont 2 278 finalisées** ; **0 dans une autre devise**.
- Prix d'achat connu (posé sur la vente `vinted_sale_overrides.buyPrice`, ou par son N° dans `vinted_buyprice_by_num`) :
  **160 des 2 278 (≈ 7 %)**. Approximation SQL : un prix posé sur l'annonce numérotée (38 annonces sur 622) ou un achat
  relié par `buyFromId` peut en ajouter quelques-uns — l'écran, lui, compte par la règle de l'app.
- **Frais notés sur une vente : 0** (aucun `fees`, `emballage`, `transportVendeur`, `commission`). Vinted ne prend aucune
  commission au vendeur (règle du site) et l'acheteur paie le port : sur Vinted, le net = prix − prix d'achat tant
  qu'il ne note rien.
- **Source d'achat** : 29 annonces numérotées sur 622 portent `buyFrom`/`buyFromId` ; 0 achat hors plateforme saisi.
  La vue « Par source » sera donc presque vide chez lui : elle le dit (« Source pas saisie », reventes sans achat relié).
- Conséquence affichée : « Gagné · sur 160 des 2 278 ventes » (sur toute la période) et « 2 118 ventes sans prix
  d'achat · Saisir ». Le chiffre faux est la porte.

## Ce qui est fait

- **Où** : Statistiques, 3e segment **« Gains »** (Activité · Finances · Gains · Transporteurs), la période 7/30/90 j
  en haut s'applique (sauf « Par source » : tous ses achats, dit en sous-titre). Une carte « Ce que tu gagnes
  vraiment », quatre vues : **Par paire · Par modèle · Par source · Par compte** (gardée sur l'appareil,
  `vrm_stats_gains_vue`).
- **En haut** : trois tuiles — Gagné (net total, « sur K des N ventes » ou « N ventes, toutes connues »), Par paire
  (net moyen et marge sur ces mêmes ventes), Délai moyen (mise en ligne → vente prouvée, « sur K des N datées ») ;
  puis le manque NOMMÉ : « N ventes sans prix d'achat » + bouton **Saisir** (`ouvrirCompleter({ sujet: 'achat' })`,
  l'atelier Compléter) ; puis « N ventes écartées : autre devise ou montant illisible, jamais converties » et
  « N commandes eBay dans une autre devise, écartées ».
- **Par paire** : les meilleures et les moins bonnes ventes (net), puis « À saisir » : chaque vente sans prix d'achat
  ouvre la saisie sur **son N°** (`ouvrirCompleter({ sujet: 'achat', num })`).
- **Par modèle / source / compte** : « À racheter » (pas pour les comptes), « Ce qui rapporte le plus / le moins »,
  puis « Tout » en barres (une série, valeur écrite à côté, net négatif = barre grise et « − », détail au survol).
- **Pourquoi ?** replié : ce que « Gagné » compte, ce qu'est « À racheter » (un constat, pas une promesse), le modèle
  n'est qu'un regroupement d'affichage.

## Aucune règle neuve (§5)

`src/gainsReels.js` (module pur) ne fait que ranger :
- **Net d'une vente** = `netDeVenteRangee` (src/coutReel.js, la règle de la colonne « Net », de `ajouterVenteBenefice`,
  de `vrm_benefice_jours`) sur le relevé `vrm_stats_ventes` (ventes finalisées, **comptes sélectionnés seulement** —
  `isHidden`/`venteOffOf` du relevé —, prix d'achat par identité, eBay = `montantRecuEbay`, port eBay jamais compté).
  Prix d'achat absent ⇒ `null` (« — »), jamais 0.
- **Groupes** (modèle, compte), nombre, couverture, écartées = `classementRapporte` (src/ceQuiRapporte.js) : le « coût »
  d'une ligne lui est passé comme vente − net, donc son « brut » est au centime la somme des nets.
- **À racheter** = `scoreRachat` (src/quoiRacheter.js : net moyen ÷ délai, ≥ 3 ventes reliées ET datées, net > 0), sur
  le délai MOYEN (le même nombre que celui affiché).
- **Source** = `rentabiliteParSource` (#1340) telle quelle ; une source « au plus » (frais pas confirmés) ou à moins de
  3 reventes au bénéfice connu n'est ni classée ni proposée.
- Seul calcul propre : la moyenne du délai d'un groupe, sur les dates de `classementRapporte`.
- **Pas de classement sous 3 ventes au net connu** (`MIN_CLASSEMENT` = `MIN_RACHAT`) ; meilleurs et moins bons se
  partagent les classables (jamais la même ligne deux fois ; un seul classable ⇒ rien à comparer).
- `gainsReels.js` n'importe pas `vendsMieux.js` (audit-rentabilite C3 : celui-ci reste aux seuls écrans de stats) et
  n'est importé que par Statistiques (audit G21).

### « Au moins » : volontairement jamais sur un bénéfice

La consigne demandait « partiel ⇒ au moins + couverture ». Pour un **bénéfice**, la règle du dépôt
(src/beneficeNoms.js, 3 nov.) l'interdit : une paire au prix d'achat inconnu peut être vendue à perte, la somme des
connus n'est pas un plancher. L'écran dit donc **« sur K des N ventes »** et nomme le manque, et l'audit V3 vérifie
qu'« au moins » n'apparaît jamais (mutation `aumoins` rouge).

### Une publication en plus

Les commandes eBay dans une autre devise étaient écartées en silence du relevé. `Comptabilite.jsx` les COMPTE
maintenant (mêmes filtres que `ventesAutresBenefice`) et les publie avec le relevé (`vrm_stats_ventes.ebayHorsEuro`,
`null` si eBay pas lu) ; `useLectures` les lit (`horsEuro`). Les ventes Vinted dans une autre devise arrivent déjà au
relevé avec un montant `null` et sont comptées « écartées ». Aucun total existant ne change.
`lignesReleve` porte aussi le N° de la fiche (`num`, [8] du relevé) pour la porte de saisie.

## Preuves

- `node scripts/audit-gains-reels.cjs` : **35 verts**. Il EXÉCUTE `releveVentes` → `lignesReleve` → `gainsReels` → la vue
  rendue (react-dom/server) sur une base inventée (3 comptes dont un écarté, 4 modèles + « Autres », prix d'achat
  manquants, frais notés, une vente à perte, une en GBP, une en USD, une non finalisée, 5 sources) et recompte à part.
  Mutations, chacune rouge : `net` (6 rouges), `passu` (10), `min` (3), `devise` (1), `exclu` (8, sur le propriétaire
  `releveVentes`), `couverture` (1), `horseuro` (1), `aumoins` (1). Sur `origin/main` : rouge (le module n'existe pas).
- Audits de cohérence, inchangés, verts : `audit-chiffres`, `audit-urssaf`, `audit-benefice` (50), `audit-benefice-unique`
  (56), `audit-cout-vente` (28), `audit-ce-qui-rapporte`, `audit-argent-choix` (40), `audit-rentabilite` (30),
  `audit-rentabilite-source` (20), `audit-journee-stats` (34), `audit-identite`, `audit-coherence`, `audit-icones`,
  `audit-traduction` (45), `audit-quoi-de-neuf`.
- Banc `scripts/bancs/gains-reels.cjs` (outils/natif-gains : le vrai écran, la vraie chaîne, données inventées) à
  390 tactile et 1512, clair et sombre : voir « Banc » ci-dessous.

## Banc

(rempli après la passe)

## Ce qui reste

- « Par source » ne suit pas la période (la publication de #1340 couvre tous les achats) ; son délai est achat → vente
  (pas mise en ligne → vente) — dit à l'écran (« achat → vente »).
- Ouvrir Statistiques depuis « Quoi de neuf » montre le dernier segment choisi, pas forcément « Gains ».
- Les composants « jeu » (`claude/visuel-jeu` : Anneau, TuilePaire) ne sont pas sur `main` : l'écran utilise les
  composants natifs (Tuiles, Rangee, Actions, Pourquoi) ; à reprendre si cette branche fusionne.

Geste de Julien : saisir ses prix d'achat (bouton « Saisir » de l'écran) — 7 % de ses ventes en ont un aujourd'hui.
