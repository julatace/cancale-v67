# 21 nov. 2026 — Transporteurs sur tous les sites et « + Dépense » en deux touchers (lot `transp-depenses`)

Branche `claude/transp-depenses` (partie de `claude/integration-21nov`). Pas de PR ni de fusion : l'intégrateur le fait.
Base mesurée AVANT de coder (lecture seule, projections) : `ebay_orders` 0 commande, `lbc_ventes` 0 vente, `vc_ventes`
0 vente — aucune donnée réelle des trois sites à mesurer chez lui ; les formes viennent du code de capture de l'extension
(`extraireVentesLbc`, `vc_ventes`) et de la doc de l'API Fulfillment d'eBay (comme `api/_lib/ebay-a-expedier.js`).

## Ce que Julien a choisi (21 nov.)

6. **Statistiques par transporteur sur tous les sites** — Leboncoin, eBay et Vestiaire dans la MÊME règle, transporteur et
   dates lus par identité, « inconnu » à part, colonne / filtre Site ; combler les deux trous « à capter » si possible.
8. **Saisie rapide des dépenses** — « + Dépense » en deux touchers dans Argent, six catégories, montant, date du jour par
   défaut, note et photo facultatives (sans lecture IA), liste du mois, modifier / supprimer ; dans le bénéfice NET par la
   règle existante ; Aujourd'hui dit « net du jour » quand les dépenses du jour sont notées.

## 6. Transporteurs — ce qui est fait

**Une règle** : `src/statsTransporteurs.js` garde `ligneVente` / `ligneAchat` / `statsTransporteurs` ; chaque ligne porte
désormais `site` (une ligne d'avant sans site est Vinted). Lignes propres aux sites, PURES, par identité seulement :

| site | transporteur | dates | identité |
|---|---|---|---|
| Leboncoin (`ligneVenteLbc`) | `deliveryMethod` / `deliveryLabel` de la transaction | ligne `depart_` du n° de SON bordereau (`label.reference`) | n° exact ; un n° partagé ne prouve rien |
| Vestiaire (`ligneVenteVc`) | `transporteur` de la vente, sinon la ligne de son n° | ligne `depart_` de `suivi` ; la limite Vestiaire LUE juge « à temps » | n° exact |
| eBay (`ligneVenteEbay`) | `fulfillmentStartInstructions[].shippingStep.shippingCarrierCode` (étiquette gérée par eBay), sinon inconnu | aucune (la commande rangée n'a ni n° ni date de dépôt) | la commande ; annulée / remboursée en entier écartée |
| achats Vestiaire (`ligneAchatVc`) | transporteur nommé, ligne `transp_` de son n° | trajet lu de cette ligne | n° exact |
| achats Leboncoin (`ligneAchatLbc`) | `deliveryMethod` | aucune (pas de n°) | la transaction |

- **Aucun montant** dans une ligne ni dans la publication (liste blanche `CHAMPS_PUB_TRANSP`) : le port eBay n'est ni
  recette ni charge (§2.8).
- `suivisPartages` : un n° porté par deux colis (deux ventes, une vente et un achat) ne prouve rien pour aucun.
- **Publication par site** (`clePubTransp(sens, site)` : `vrm_stats_transporteurs_ventes` reste Vinted, `_ventes_leboncoin`,
  `_ventes_ebay`, `_ventes_vestiaire`, `_achats_vestiaire`, `_achats_leboncoin`) : un site pas lu n'écrit rien et n'efface
  pas les autres. Statistiques les réunit (`reunirPubTransp`) et NOMME ceux qui ne sont pas publiés (« pas encore lus ici :
  Vestiaire »), jamais comptés à zéro.
- **Écran** (`src/natif/ecrans/StatsTransporteurs.jsx`, aucun calcul) : à l'ordinateur, colonne « Sites » (logo + nombre par
  site) et filtre Site dans la tête (Tous + les sites présents dans la fenêtre, gardé `vrm_stats_transp_site`) ; au
  téléphone, pas de sélecteur (décision du 20 nov.) : les logos des sites sur chaque rangée, leur nombre dans le détail.

### Les deux trous « à capter »
1. **Dépôt → livraison** (l'arrivée perdue au retrait) — comblé des deux côtés :
   - serveur (`api/_lib/depart-colis.js` `ligneDepartApresEssai`) : `arriveeAt` posée à la première lecture « disponible »
     / « livré », jamais remplacée ni effacée (comme `priseAt`) ; lue en scalaire `meta->>arriveeAt` (`SELECT_DEPART_META`,
     `departDeMeta`) — la colonne `meta` copie déjà les scalaires (migration 004), aucune migration ;
   - app : `memoArrivee` garde sur cet appareil la première arrivée vue d'un n° (`vrm_stats_arrivees`, par compte).
   ⚠️ Les colis déjà retirés AVANT cette version n'ont pas d'arrivée : elle est perdue, ils restent hors du calcul (« sur N »).
2. **Historique du transporteur des achats** (paiement → expédition, expédition → point) — comblé côté app : l'écran Achats
   lit, ≤ 40 lignes par passe, les `data->evenements` des lignes `transp_` des achats de la fenêtre (Vinted et Vestiaire)
   dont le trajet n'est pas gardé pour leur état actuel, et garde les dates prouvées (`memoTrajet` → `vrm_stats_trajets`,
   600 lignes au plus) ; relues seulement quand la ligne change (`etatAt`). Une lecture ratée ne garde rien.

### Ce qui reste à capter (précisément)
- **eBay** : la route `api/ebay` (relecture des commandes) devrait ranger, par commande, les `shipping_fulfillment` d'eBay
  (`GET /sell/fulfillment/v1/order/{orderId}/shipping_fulfillment` : `shipmentTrackingNumber`, `shippingCarrierCode`,
  `shippedDate`) en scalaires sur la commande rangée (ou une ligne `ebay_expeditions{suffixe}`) ; le n° ouvrirait alors la
  ligne `depart_` (dépôt, arrivée) et `shippedDate` le délai vente → dépôt. Aujourd'hui ils ne sont lus qu'à la demande
  (`src/ebayGestion.jsx`, écran de la commande). Non mesuré : aucune commande eBay chez lui.
- **Colissimo et les autres** : les lignes `depart_` n'existent que pour Chronopost, Vinted Go et Mondial Relay
  (`DEPART_CARRIERS`, `RE_ID_DEPART`) ; une vente Vestiaire ou Leboncoin en Colissimo n'a donc ni dépôt ni livraison lus
  (« dates pas lues », dit). Il faudrait étendre la lecture des départs à Colissimo (l'analyseur `transp_colissimo` existe).
- **Leboncoin** : `label.reference` est supposé être le n° du bordereau — NON MESURÉ (aucune vente Leboncoin en base).
  Si ce n'est pas un n° de suivi, aucune ligne `depart_` ne lui correspond et les délais restent « — » (jamais faux).
- Taux de réponse des favoris et automatisations par compte : inchangés (voir `2026-11-21-journee-stats.md` (b)).

## 8. « + Dépense » — ce qui est fait

- **Argent** (vue Résumé, sous « Mois ») : carte « Dépenses de novembre · N » — le total des charges du mois vient de LA
  règle de Comptabilité (`comptaChargesMois`, la même que le bénéfice) ; la liste du mois (`depensesDuMois`), la plus
  récente d'abord ; titre en casse normale (`src/natif/ecrans/DepensesMois.jsx`, aucun calcul).
- **Deux touchers** : « + Dépense » (le montant est prêt à taper), puis la catégorie ⇒ ajoutée et la feuille se ferme.
  Date = aujourd'hui (modifiable, jamais dans le futur), note facultative (sinon le libellé est la catégorie), photo du
  ticket facultative rangée dans sa ligne `depense_ticket_{id}` SANS lecture (§2.9). Toucher une dépense ⇒ la même feuille :
  Enregistrer, ou « Mettre à la corbeille » (le chemin existant, `gesteCorbeille`, 30 jours).
- **Six catégories** (`CATEGORIES_DEPENSE`, src/depensesTicket.js, une liste pour les deux formulaires) : Emballage ·
  Essence et transport (clé rangée `Envois`, celle d'avant) · Frais de plateforme (hors commission ET hors boosts : déjà
  retirés vente par vente) · Matériel · Abonnement · Autre ; libellés par `tr('dep.cat.*')`.
- **Écriture** (`src/depensesRapides.js` `ecrireDepense`) : nuage pas arrivé ⇒ rien ; lecture ratée ⇒ rien
  (`lireComptaPourEcrire`, src/App.jsx : la valeur en attente d'abord, une ligne illisible LÈVE au lieu de rendre le
  défaut) ; sinon lire-fusionner-réécrire de `vrm_compta` (la ligne existante, synchronisée, fusion à trois voies de `save`).
  Une dépense rejouée (même id) n'est comptée qu'une fois.
- **Bénéfice** : `beneficePeriode` (src/App.jsx) au JOUR retire désormais les dépenses notées CE jour
  (`comptaDepensesJour`, la même liste que le mois, découpée au jour) ; coûts fixes, packs et abonnements restent au mois.
  `chargesAuMois` n'est vrai que s'il n'y a aucune dépense du jour ; `depensesJour` rend leur nombre. Ma journée :
  « net du jour » (`v2.stats.netDuJour`) quand des dépenses du jour sont notées, la mention « avant dépenses (comptées au
  mois) » sinon (`modele.js` `duJour`).
- L'ancien formulaire de Comptabilité (« Dépenses » du Résumé, avec lecture locale du montant par Tesseract) reste : même
  ligne, mêmes catégories.

## Preuves

- `node scripts/audit-transp-depenses.cjs` : **35 verts** ; `MUTATION=toutes` : **22 mutations, toutes rouges** (port eBay
  dans une ligne ou dans la publication, n° partagé accepté, filtre Site ignoré, site pas lu compté à zéro, arrivée perdue
  ou prise au retrait, mémo d'arrivée tardif, trajet périmé resservi, `arriveeAt` du serveur absente ou écrasée, dépense
  rejouée comptée deux fois, lecture ratée qui écrit, nuage pas arrivé qui écrit, montant nul, date future, jour sans
  dépense, jour = tout le mois, mention gardée, lecture qui rend le défaut, vue qui recalcule le total, Leboncoin pas publié).
  Sur le code d'avant (`git archive` 7287afed) : rouge (modules absents ; avec les modules neufs copiés : 7 rouges — T14,
  T15, D9, S1, S2, S4, S5).
- `scripts/bancs/transp-depenses.cjs` (390 tactile et 1512, clair et sombre) : **66 verts** ; mutations `sites`, `ecrit2` :
  rouges ; sur le code d'avant : rouge à la construction (écrans absents).
- Audits adaptés : `audit-journee-stats` 34 verts (importations relatives de `statsTransporteurs.js` vers le dépôt ; ses 8
  mutations Transporteurs toujours rouges) ; `audit-benefice` 50 verts (+ `comptaDepensesJour` ; la dépense du test « aujourd'hui »
  datée d'hier, quel que soit le jour du banc).
- Verts : `audit-urssaf`, `audit-traduction` (45), `audit-quoi-de-neuf`, `audit-coherence`, `audit-icones`,
  `audit-aujourdhui` (69), `audit-suivi-commandes` (59), `audit-suivi-ventes-mr`, `audit-colis-sortants`,
  `audit-fonctions-api`, `audit-safari` ; banc `journee-stats` 118 verts ; build vert.
- Captures regardées (390 d'abord) : Transporteurs 4 sites (rangées avec logos, détail Colissimo), 1512 (tableau, colonne
  Sites, filtre Leboncoin) ; Dépenses : carte, feuille ouverte (montant prêt), ajoutée (clair, sombre), « pas encore lues ».

Geste de Julien : aucun (la prochaine relecture serveur des départs pose `arriveeAt` d'elle-même).
