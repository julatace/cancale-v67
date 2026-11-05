# 5 novembre 2026 — Le Stock = tes annonces actuelles

Branche locale `v32-stock-annonces` (depuis `v31-stock-2d`, 79b6268d). Rien n'est poussé.

## Ce qu'il a dit (mot pour mot)
« pour le stock onglet je veux que ça soit les annonces actuelles ».

## Ce que montrait le Stock avant (mesuré)
- Sur `v31-stock-2d`, `StockMeubles` fabriquait ses articles depuis **toutes les fiches
  numérotées** (`vinted_annonce_numeros`), moins les déclarées parties et les comptes
  écartés, plus les paires eBay/Leboncoin publiées par l'écran Annonces
  (`vinted_nums_physiques.autres`) ; seuls les vendus PARTIS sans case sortaient
  (`resteAuStock`). Une fiche d'une annonce supprimée depuis longtemps restait « à ranger ».
- Lecture seule de la vraie base (5 nov., projetée, aucune donnée réécrite) : chez
  Julien, **521 fiches numérotées** (dont **401 « B »** d'archive), **56 annonces
  Vinted ouvertes ou masquées** dans les dressings captés (48 ouvertes + 8 masquées,
  avant la règle « en ligne » et les comptes écartés) — toutes ont une fiche numérotée ;
  `vrm_meubles` = 2 meubles, `vrm_slots` = 3 cases posées ; `lbc_listings` = 186
  annonces captées, `ebay_listings` = 5.
- Donc « À ranger » proposait des centaines d'anciennes paires pour ~60 vraies annonces.

## Ce qui est fait
### 1. Une règle pure : `src/stockAnnonces.js` (§11)
- `annoncesActuelles({ vinted, numeros, ebay, lbc, vendus, cle, clePhoto })` : RÉUNIT les
  annonces déjà jugées par la règle unique « en ligne » — elle ne juge rien elle-même :
  - Vinted : par compte, `enLigne` + `aConfirmer` + `masquees` (= `annoncesPresentes`),
    telles que `fetchVintedListings` les rend (bloc `<enligne-regle>`, lecture COMPLÈTE
    la plus récente, plus de 24 h ⇒ à confirmer, masquée = chez lui) ; les masquées
    déclarées parties sortent (`masqueesPresentes`, comme `annoncesPresentes`) ;
  - eBay (`lireEbayEnLigne`, SKU « VRM-{n°} ») et Leboncoin (`lireLbcEnVente`,
    `annonceLbcEnVente` + N° par identité) — les MÊMES lectures que l'écran Annonces,
    sorties de `Comptabilite` en fonctions de module pour être partagées ;
  - une paire = l'union par **identifiant d'annonce, N° (`cleNum`), photo exacte** —
    jamais le titre. N°2 sur Vinted ET Leboncoin = une paire, deux plateformes ;
  - une annonce eBay/Leboncoin d'un N° **prouvé vendu** (`vrm_stock_vendus`) n'est pas
    une annonce actuelle (même exclusion que `articlesAutresPlateformes`) ;
  - une annonce eBay/Leboncoin **sans N°** n'est pas comptée (rien ne dit quelle paire
    c'est) : elle est comptée à part et met le total en « au moins » ;
  - une lecture qui manque (compte Vinted en échec, eBay ou Leboncoin pas lus) est
    NOMMÉE (`manque`) et met « au moins » ; rien lu du tout ⇒ `su: false`.
- `classerRangees({ slots, actuelles, vendus, garder, jugeable })` : chaque case posée est
  `actuelle` · `vendue` (l'emporte toujours : la case reste allumée jusqu'à « Je l'ai
  sortie » ou le départ du colis) · `gardee` · `plusenligne` · `passu`. « Plus en ligne »
  seulement si TOUTES les lectures qui pourraient porter ce N° ont répondu (les comptes de
  ses fiches, eBay, Leboncoin) ; sinon « pas su » — elle n'est dite ni présente ni partie.

### 2. L'écran Stock (`StockMeubles`, App.jsx)
- Il lit lui-même (`lireAnnoncesStock`, au montage, quand les comptes sont lus) : chaque
  compte Vinted gardé (`comptesStockEcartes` inchangé : masqués, retirés, supprimés, plus
  liés ne sont pas lus) par `fetchVintedListings`, eBay et Leboncoin. Plus de dépendance
  à la liste publiée par Annonces (`vinted_nums_physiques`) ni aux 521 fiches.
- **En tête** : « N annonces actuelles » (« au moins » si une lecture manque), « R rangées
  · P pas encore rangées », « dont K à confirmer (compte, lu il y a X — repasse sur Vinted
  avec ce compte) », « dont M masquées par Vinted (toujours chez toi) », « S sans N° »,
  « pas lu : compte_beta sur Vinted… ». Lecture en cours ⇒ « … » ; rien lu ⇒ « — » et la
  raison, jamais « aucune annonce ».
- **Filtres** (commodité par appareil, `localStorage`) : plateforme (Toutes · Vinted ·
  Leboncoin · eBay, montré s'il y en a plusieurs) et compte (Tous par défaut). Ils filtrent
  les chiffres, « À ranger » et la liste ; sur les étagères, ce qui ne correspond pas est
  terni (rien ne bouge de case).
- **Vendues à sortir** : chaque paire rangée prouvée vendue, sa case, « Voir la case »,
  « ✓ Je l'ai sortie » (le même `sortir` qu'avant). La case garde son halo à l'accent.
- **Plus en ligne** : chaque paire rangée qui n'est plus une annonce actuelle, sa case
  (anneau **ambre**, fixe, pastille « Plus en ligne »), « Voir la case », « Je l'ai
  retirée » (libère la case, le N° reste pris, jamais redonné), « Elle est encore là »
  (`vrm_stock_garde_hors_ligne`, synchronisée, posée sur son clic seulement : la case
  n'est plus signalée).
- **Pas vérifiées** : une ligne discrète nomme les paires rangées dont la lecture manque.
- **À ranger** : les annonces actuelles SANS case (et une paire « Remise » à la main dont
  la case était prise, comme avant) ; plus jamais une vieille fiche.
- **Tes annonces actuelles** (sous les étagères) : chaque paire une fois, ses plateformes,
  ses comptes, « à confirmer » / « masquée par Vinted », sa case ou « pas encore rangée »
  avec « Voir › » / « Ranger › » ; 60 par 60.
- Inchangé : la recherche, le glisser/toucher, « Voir l'état », la sortie automatique
  (`libererCasesPartis`), « Cases libérées toutes seules », l'explication animée.

## Preuves
- `npm run build` vert.
- `node scripts/audit-stock-annonces.cjs` : **29/29** ; `--prouve` : **12/12 mutations**
  attrapées (N° qui n'unit plus, photo ignorée, TITRE qui unit, masquées oubliées, à
  confirmer oubliées, compte KO lu comme vide, Leboncoin pas lu lu comme vide, « au moins »
  tu, vendu qui revient par eBay/Leboncoin, « plus en ligne » sans lectures complètes,
  vendue éteinte par une autre annonce, « Elle est encore là » ignoré). Sur l'arbre de
  `v31-stock-2d` : la règle n'existe pas (rouge au chargement).
- Banc `scripts/bancs/stock-annonces.cjs` (données inventées, 2 comptes Vinted dont un lu
  il y a 3 jours, 1 Leboncoin ; une paire sur deux sites ; une masquée ; une rangée puis
  vendue ; une rangée plus en ligne ; une vieille fiche ; trois scénarios : tout lu, un
  compte pas lu, rien lu ; 390 tactile et 1512 souris, clair et sombre) : **100 verts** ;
  sur `v31-stock-2d` (arbre extrait, banc copié dedans, build fait là) : voir le chiffre
  rouge plus bas. Captures regardées (en-tête, étagère, liste, « au moins », « — »).
- Voisins : `audit-enligne` 101/101, `audit-coherence`, `audit-identite`, `audit-icones`,
  `audit-fonctions-api` verts ; `audit-stock-2d` 49/49 ; bancs `stock-2d`,
  `stock-2d-revue`, `stock-plateformes` : voir plus bas.

## Ce qui reste
- Vestiaire n'est pas dans le Stock (il ne l'était pas avant non plus) : ses annonces
  (`vcfiche`) n'ont pas encore de N° par identité côté Stock.
- Le Stock relit au montage seulement (pas sur le signal « maj annonces » de l'extension).
- « Elle est encore là » vaut jusqu'à ce qu'il la retire : si la paire revient en ligne
  puis repart, elle n'est plus signalée (à reprendre si ça le gêne).
- Une annonce eBay/Leboncoin sans N° n'est pas montrée (comptée seulement) ; une annonce
  Vinted sans N° est comptée et dite « sans N° : pas rangeable ».
- Geste de Julien : ouvrir Stock, regarder le nombre en tête (il doit ressembler à ses
  annonces en ligne), sortir du carton ce qui est dans « Plus en ligne », ranger le reste.
