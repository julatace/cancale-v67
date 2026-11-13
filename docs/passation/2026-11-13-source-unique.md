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
  20 s, retour du réseau (`online`).
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
- **Compteur d'exécutions** : `performance.mark('vrm:commandes:<sorte>')`, une marque par fusion des
  commandes. Banc **`scripts/bancs/source-unique.cjs`** (1512 clair, 390 tactile sombre, 24 verts) :
  - M : au montage, ventes fusionnées 1 fois pour les 2 moteurs de Ventes ; achats 1 fois pour les 3 d'Achats ;
  - A / H : signal « ventes » / « achats » sans compte ⇒ 1 fusion, chaque ligne de commandes relue 1 fois ;
  - **K « lecture KO, écriture OK »** (§5) : lectures de commandes en 500, écritures en 201, signal ⇒ une
    seule tentative pour les deux moteurs, 14 lectures ratées servies, 13/13 ventes encore à l'écran,
    aucune écriture ne publie moins de ventes qu'avant.
  - **Mutation** (`loadOrders` sans `partager`) : rouge — « 3 fusion(s) » au montage d'Achats et au signal.
    Le build d'avant n'a pas le compteur (0 ⇒ rouge aussi, mais seule la mutation prouve).
- **Lectures réseau (budget-vitesse, même heure, build d'avant → après)** : Ma journée 152 → 152 ;
  Ventes appareil neuf 157 → 153 lectures (29 → 25 en double), 2ᵉ ouverture 144 → 140 (21 → 17) ;
  Achats 168 → 166 (29 → 27), 2ᵉ ouverture 163 → 161 (29 → 27). `scripts/budget-vitesse.json` ABAISSÉ
  (ventes, achats ; aucune valeur relevée ; les lectures en double `harvest_*_suivi_*` et `colis_suivi_*`
  retirées) : le build d'avant y est **rouge** (« NOUVELLE lecture en double ×2 : harvest_*_suivi_* »).
  `audit-budget-lectures` 20/0, `audit-lectures-lourdes` vert.
- **Aucun chiffre ne change** (`chiffres-volume` + `compare-chiffres-volume`, deux builds dans la même heure) :
  20 000 ventes **35/35** (deux séries) ; base par défaut **35/35** (même heure).
  ⚠️ Trouvé en passant, **AVANT ce lot** : sur la base par défaut, `vrm_stats_ventes` [9] (date de versement)
  d'UNE vente (tx 22000001000) vaut tantôt la date, tantôt « » d'une passe à l'autre — le build d'avant
  seul : 2 passes « date », 3 passes « » ; le build d'après : 1 « date », 3 « ». Chaque écran passé seul
  donne la date (les deux builds). C'est une course entre deux lectures des dates de versement
  (`fetchVersementsVinted`, copie sur l'appareil `lireFamilleCopiee`) et la publication ; elle n'est pas
  causée par ce lot (le magasin la rend seulement « la dernière lecture gagne pour tous ») — à suivre.
- **Rendus de `Comptabilite` avant « prêt »** (`_mesure-demarrage RENDUS=1`, 390 tactile, ×4, 4G, 20 000
  ventes ; avant → après, deux séries) : Ma journée 16 → 15 puis 14 → 18 ; Ventes 20 → 21 puis 16 → 18 ;
  Achats 38 → 35 puis 35 → 44. Prêt (s) : 12,4 → 12,5 / 12,5 → 14,2 / 8,5 → 9,6 puis 7,9 → 7,7 /
  9,1 → 7,8 / 9,9 → 10,0. **Aucun gain de vitesse prouvé** : les deux séries se contredisent (machine
  partagée, écrans bimodaux). Le travail lourd est le calcul DÉRIVÉ que chaque instance refait (≈300 états),
  pas la lecture ni la fusion.
- Audits verts : tdz, variables, coherence, identite, icones, bilan-semaine (54/0), une-regle,
  lectures-lourdes, budget-lectures, robustesse-donnees (34) ; balayage de tous les `audit-*.cjs`
  comparé au build d'avant (voir §6). Bancs : panne (vert), temps-reel 26/0, ventes-relecture-compte 12/0,
  budget-vitesse 28/0 (ventes, achats) et 42/0 (journée, ventes, achats), source-unique 24/0.
- Captures regardées (scratchpad, non commitées) : Ma journée, Ventes, Achats en 390 tactile et 1512,
  clair et sombre — aucune différence visible ; aucune erreur de page.

## 4. Pas 4 — publieur sans écran et écrans consommateurs : PAS FAIT
La règle du lot : seulement si 1–3 sont prouvés. 1–3 sont justes (chiffres, lecture KO, compteur, lectures
en baisse) mais **sans gain de vitesse mesurable** ; le pas 4 voudrait que Ma journée / Ventes / Achats
cessent d'être des `Comptabilite` (ce sont elles qui calculent ce qu'elles montrent) : un publieur dans
`AppCoeur` serait un moteur de PLUS tant que les écrans gardent le leur. `<Comptabilite` reste à 7,
`tab===` à 41.

## 5. Pour reprendre
- Le magasin est en place (`useEtatPartage`, `_magasinCommandes`) : y mettre d'autres données lues par
  plusieurs moteurs se fait en remplaçant leur `useState` (clé `{sorte}|{vendeur}`), et `partager` pour la
  lecture d'ouverture.
- Le vrai levier de vitesse : moins de moteurs montés (Achats en monte 3 : la liste par point, ses outils,
  la liste), ou sortir les calculs dérivés lourds (`cartesColis`, `totals`, `propositionsPrix`) dans des
  modules qui mémorisent par IDENTITÉ des données partagées (désormais les mêmes objets pour tous).
- La course `vrm_stats_ventes` [9] (§3) : publier seulement quand les dates de versement sont lues, ou
  fusionner les dates déjà lues — décision de règle, pas faite ici.

## 6. Balayage des audits
(voir plus bas)

## 5. Gestes de Julien
Aucun.
