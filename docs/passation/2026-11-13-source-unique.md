# 13 nov. — Source unique (second agent, branche `claude/agent2-source-unique`)

Partie de `claude/agent2-moteur-compta` (24fdbdc7a), `origin/main` fusionné (vrai merge) au début et à la fin.
But demandé : une SEULE copie des données lues de la base pour toutes les instances de `Comptabilite`,
puis — seulement si c'est prouvé — un publieur sans écran et des écrans qui consomment.
**Fait : les pas 1 à 3 pour les commandes (ventes, achats), les suivis et les dates de versement.
Pas fait : le pas 4 (publieur + écrans consommateurs), faute d'un gain de vitesse prouvé aux pas 1–3.**

## 1. Inventaire (pas 1) — ce que lit `Comptabilite` (App.jsx, ~22 000 lignes)
Comptés : `<Comptabilite` 7 fois dans App.jsx, `tab===` 41 (inchangés). Ventes en monte 2 (« À expédier »
= `only="bordereaux"` + la liste), Achats 3 (colis, outils « À retirer », la liste), Ma journée 1.

**Ce qui était DÉJÀ partagé entre instances (au niveau du module, avant ce lot)** — le réseau ne lit
qu'une fois ; chaque instance garde pourtant SA copie (état React, clone `structuredClone` de `fetchMemo`)
et refait ses fusions :
- `cachedRow` (60 s, la requête EN COURS partagée) : commandes par compte (`o:{uid}` ⇒
  `harvest_{uid}_orders_*d`, projection `SEL_COMMANDES`), annonces, conversations ; oubli par
  `viderCacheLignes`, `oublierCommandesCompte` (signal de l'extension, 4 s).
- `fetchMemo` (60 s, GET seulement, vidé par toute écriture vers `/rest/v1/` ou `/api/`, `vrm:ext`,
  retour au premier plan) : `panel_colis_collected`, `panel_colis_relais`, `panel_a_confirmer`,
  `panel_num_reserves`, `panel_bords_done`, `panel_buyprices`, `vinted_listing_dates`,
  `vinted_lbc_posted`, `lbc_ventes`, `lbc_accounts`, `panel_accounts_off`…
- `lireTxnMeta` (famille `harvest_%_txn_%` en scalaires, copie sur l'appareil `lireFamilleCopiee`),
  `fetchVersementsVinted`, `fetchEmailTracking`, `fetchTranspLignes`, `fetchColisMondialRelay`,
  `fetchDescLens`, `fetchCapturedLabelMetas`, `fetchLabelFrais`, `fetchTransactionsLots`, `fetchHarvest`,
  `lireObjet`, `lireSupprimeesTous`.
- `_acctCache` (sessionStorage, 3 min, `etatOrdersDuCache`) : ventes, achats, annonces, conversations,
  avec leurs comptes ratés (`failedUids`) et les comptes couverts (`comptes`).

**Ce que chaque instance lisait ELLE-MÊME (non partagé)** : `lireSuivisVintedVal`
(`harvest_*_suivi_*`, scalaires `meta->>`), `lireSuivisManuelsVal` (`colis_suivi_*`), `fetchEmailAchats`,
`fetchEmailBordereaux` (`email_bord_*`, scalaires), `fetchEmailSales`, `fetchWalletEscrow`, `fetchLotItems`,
`fetchTxnItemIds`, `fetchRetoursAchat`, `fetchHarvestBoosts/Conversation/PickupPoints`,
`fetchOffres/ResumesConversations`, `fetchVintedConversationDetail`, `lireEbayTous`, `lireRegistre`,
`lireDeclarations`, les lectures `id=in.(…)` de photos/transactions d'achats par lots de 100, le relevé du
mois (`harvest_*_releve_{mois}`), `vinted_brouillon_*`, `coffre_*`, `ebay_brouillons*`, `ebay_listings*`.
- 40 réglages synchronisés `useStateCle` (+ 23 `onCloudReady`) : lus du `localStorage` (la ligne `main`
  est lue par la coque, une fois), ne remplacent que ce qui est resté vide.
- Rechargements : signal de l'extension `vrm:ext` (`maj` ventes / achats / retrait / suivi / confirmer /
  versements), sonde des ventes de 60 s (scalaires `cap:meta->>capturedAt`), retour au premier plan après
  20 s, retour du réseau (`online`), temps réel (`vrm:temps-reel`).
- Écritures (inchangées par ce lot) : publications de l'écran propriétaire (`vrm_benefice_jours`,
  `vrm_stats_ventes`, `vinted_urssaf_mois`, `vrm_colis_aposter/retirer`, `widget_stats`…) dans le
  `localStorage` puis `main` ; verrous `txnLink` ; réglages `save()` ; `modifierDonnee` (comparer-et-échanger
  sur `data.rev`) ; aucune écriture n'est faite par le magasin.

## 2. Le magasin (pas 2) — `src/magasinPartage.js`
Un module, sans lecture ni écriture : une valeur par clé, des abonnés, le numéro de lecture partagé
(`numero`/`estCourant` : deux lectures qui se croisent, seule la plus récente écrit — pour TOUS les
moteurs), la lecture en cours partagée (`partager(cle, sig, lancer)`). Partie la dernière instance, la clé
est oubliée : un écran remonté plus tard repart de `etatOrdersDuCache`, comme un `useState` neuf.
Dans App.jsx : `useEtatPartage` (`useSyncExternalStore`), clé `{sorte}|{vendeur}` (`AUTH.user.id`) —
les données d'un vendeur ne passent jamais à un autre. Rien n'est monté dans `App` (§5) : ce sont les
instances de `Comptabilite`, montées dans `AppCoeur` après la session, qui s'abonnent.

Mis dans le magasin :
- **les ventes et les achats** (`sales`, `buys`) ; `loadOrders` rejoint une lecture identique en cours
  (même sorte, mêmes comptes, même mode, même liste de comptes à relire, rien oublié depuis :
  `_genLectures`, qui monte à chaque `viderCacheLignes` / `oublierCommandesCompte`). Une lecture forcée
  part toujours. Les règles d'avant sont intactes : cache de 3 min AVEC ses échecs, relecture discrète qui
  garde ce qu'on montrait d'un compte raté (et le nomme), échec total ⇒ `error`, jamais `[]` présenté comme
  complet. Une liste déjà montrée pour ces comptes ne repasse plus par le squelette (relecture discrète).
  Un geste sur un achat (masquer, garder le double) se voit aussitôt dans les trois moteurs d'Achats.
- **les suivis Vinted et les n° ajoutés à la main** (`suivisVinted`, `suivisManuels`) : la lecture
  d'ouverture est rejointe ; une relecture voulue (`maj suivi`, un n° ajouté) relit toujours.
- **les dates de versement** (`versements`).
- Le signal de l'extension SANS compte (« ventes rangées », « achats rangés »), le retour au premier plan
  et le retour du réseau oublient la mémoire des lignes UNE fois pour tous les moteurs
  (`oublierLignesUneFois`, 4 s) : les suivants rejoignent la relecture du premier.

Pas mis (et pourquoi) : les ~80 autres lectures sont déjà partagées au réseau (liste ci-dessus) ou ne sont
faites que par UNE instance (un écran). Les mettre au magasin ne baisse ni les lectures ni le calcul.

## 3. Preuves
(à compléter plus bas)

## 4. Pas 4 — publieur sans écran et écrans consommateurs : PAS FAIT
(à compléter plus bas)

## 5. Gestes de Julien
Aucun.
