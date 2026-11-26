# 26 nov. 2026 — Données Vestiaire et Leboncoin fiables (`claude/fiabilite-vc-lbc`)

Julien : « les données doivent être fiables, pense à Vestiaire Co et Leboncoin ».

Revue du code de l'APP (`src/`) qui lit et montre `vc_listings`, `vc_ventes`, `lbc_listings`,
`lbc_ventes` : annonces en ligne, vendues, comptes du sélecteur, Stock, compta. Aucune lecture de
la base de production (l'outil SQL pointe un autre projet) : tout est jugé sur le code et sur des
données INVENTÉES dans l'audit. L'extension n'est pas touchée (PR #1311, #1329, #1331, #1372 en
file la changent déjà).

## Ce qui était faux

Trois écrans disaient l'état d'une annonce Vestiaire, chacun à sa façon. Le Stock
(`annoncesVcStock`) et l'anti double vente (`annoncesVcEnLigne`) avaient la bonne règle ; les deux
autres non.

| # | écran | ce que Julien voyait | cause |
|---|---|---|---|
| D1 | Annonces → Vestiaire (`AnnoncesVestiaire`) et la touche « VC n » du sélecteur (`compterVcEnLigne`) | une annonce dont la vente a été **annulée** marquée « Vendue », pas comptée en ligne — alors que la paire est chez lui et toujours en vente | `vendus` construit de TOUTES les ventes lues (`if (v && v.productId)`), sans `vcVenteAnnulee` |
| D2 | les mêmes | une lecture de « Mes articles » vieille de plusieurs jours : chaque annonce « En ligne », comptée (« VC 3 ») ; seule une puce « Pas revue récemment » en pied | `etatAnnonceVcBrut` ne juge que le mot et l'écart `vuAt`/`capturedAt`, jamais l'âge de la lecture ; §5 `<enligne-regle>` : > 24 h ⇒ « à confirmer » (le Stock le faisait) |
| D3 | Annonces (tous les sites, `lireAnnoncesEgalite`) | une annonce Vestiaire **vendue** restait « En ligne » jusqu'à la relecture de « Mes articles » (l'écran Vestiaire, lui, la disait vendue) | aucune lecture de `vc_ventes` : `etatAnnonceVcBrut(it, false, …)` |
| D4 | la touche « LBC n » du sélecteur d'Annonces | `lbc_ventes` illisible : un nombre présenté complet qui compte les annonces vendues restées `active` en base (mesuré le 20 oct. : ses 3 annonces vendues) | `poserNombreAnnonces('leboncoin', lbcRows === null ? null : …)` ignorait `ventesLbcKO` (l'écran Annonces de tous les sites, lui, met Leboncoin en « pas su » dans ce cas) |

## Ce qui est fait

- **`src/enLigneVc.js`** (nouveau, pur) : LA règle « en ligne / vendue » Vestiaire de l'app —
  `vendusVc` (vente lue ET pas annulée, `null` = pas lues), `lectureVcFraiche` (24 h),
  `etatVcLu` (le mot lu par `etatAnnonceVcBrut`, inchangée et partagée avec le serveur ; « en
  ligne » d'une lecture de plus de 24 h ⇒ « à confirmer »), `compterVcEnLigneRegle`, `etatDeVc`.
- `src/plateformes/nombresAnnonces.js` : `compterVcEnLigne` passe par la règle.
- `src/ecrans/Vestiaire.jsx` : `vendus` = `vendusVc` ; `etatAnnonceVc` dit « À confirmer · lu il
  y a … » (`tr('vcmod.aConfirmerVieille')`, 5 langues) quand la lecture est vieille.
- `src/ecrans/AnnoncesEgalite.jsx` : lit `vc_ventes` **projetée** (`select=ventes:data->ventes`)
  avec les autres lectures, et juge chaque annonce par `etatDeVc`. Ventes illisibles ⇒ rien n'en
  est tiré (« vendue » seulement si l'annonce le dit), comme l'écran Vestiaire.
- `src/ecrans/Leboncoin.jsx` : ventes Leboncoin pas lues ⇒ la touche « LBC n » est « pas su ».
- La règle d'anti double vente du serveur (`api/_lib/vestiaire-regle.js`) n'est PAS changée.

## La preuve

`scripts/audit-fiabilite-vc-lbc.cjs` (16 contrôles, `--prouve` : 7 mutations qui rougissent
chacune) : 50 annonces au même titre, une vendue (par `productId`), une vente annulée ; une lecture
de 2 h, de 23 h, de 5 jours, jamais datée ; ventes pas lues. Exécute `compterVcEnLigne`,
`etatDeVc`, `etatAnnonceVc` (extraite de l'écran) et juge le branchement (lecture projetée de
`vc_ventes` dans `lireAnnoncesEgalite`, `ventesLbcKO` dans la touche Leboncoin).
Arbre d'avant (`git archive` de `c6b1bb8f3`) : **9 rouges** (rendu 48 au lieu de 49, 48 au lieu de
0, ligne « En ligne » sur une lecture de 5 jours, branchements absents, touche « LBC n » sans `ventesLbcKO`).
`audit-capture-vc-lbc` C9 charge aussi `src/enLigneVc.js` (la ligne de l'écran l'utilise).

## Pas vérifié

- Aucune capture d'écran : le banc `vestiaire-fiches.cjs` est déjà rouge sur `main` (45 rouges :
  l'URL `?tab=annonces&site=vestiaire` ne monte plus `AnnoncesVestiaire`), et l'écran Annonces de
  tous les sites n'a pas de banc qui passe par `lireAnnoncesEgalite` (le banc `annonces-egalite`
  sert des fixtures à la vue). Les textes changés : une étiquette de ligne (« À confirmer · lu il y
  a … ») ; le reste ne change que des états (`data-vc-annonce-etat`, segments) et des nombres.
- Les vraies formes de `vc_ventes.ventes[].etat` pour une annulation chez Julien : la règle
  `vcVenteAnnulee` (famille `annulee` de `VC_VENTE_ETAPES`) est celle que le Stock utilisait déjà.
