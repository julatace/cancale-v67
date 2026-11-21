# État réel de l'agent eBay au 19 octobre — lu dans le code d'`origin/main`

**Rédigé le 19 octobre 2026.** Source : le code de `origin/main` au commit
`65eec06` (PR #592), lu ici — pas les notes, qui peuvent être en retard. Les
`fichier:ligne` renvoient à ce commit, sauf « (cette PR) ». Aucun appel à eBay,
aucune écriture en base. La section du 11 octobre (plus bas) reste comme
historique ; **ce tableau la remplace pour l'état**.

Légende : **FAIT** · **PARTIEL** · **RIEN** (pas commencé) · **GELÉ**.

| K | chantier | état | où (65eec06) |
|---|---|---|---|
| K0 | plusieurs comptes eBay + règle d'offre dans `main` | **FAIT** | registre `ebay_comptes` `api/_lib/ebay.js:191` (`normaliserRegistre`), `:227` (`comptesActifs`) ; règle d'offre `api/ebay.js:423` (`handleRegleOffre`), `:540` ; écran `src/App.jsx:17323` (`EbayReglesToutes`) |
| K1 | la paire vendue ailleurs ne reste pas sur eBay sans un mot | **FAIT (app ouverte)** | preuve par bordereau `src/App.jsx:24543` (`lireVentesVintedProuvees`) ; `doublesVenteEbay` `:40205` ; retrait auto `:39995` ; extension `capterPreuvesVente` `vinted-sync-extension/background.js:4949` ; double vente app fermée par email `api/email-inbound.js:730` |
| K2 | socle (status, suppression de compte, signatures d'évènements) | **PARTIEL** | suppression eBay = mode de `api/ebay.js:1542` (`handleDeletion`, `vercel.json:22`) ; `agent-evenements.js` (signatures, cache de clés publiques) **absent** |
| K3 | mémoire de l'agent (migration 014) | **ÉCRITE, PAS APPLIQUÉE** | `supabase/migrations/014-agent.sql` ; audit `scripts/audit-agent-sql.cjs` |
| K4 | coffre, jetons gardés, garde-quota | **RIEN** | aucun `api/_lib/coffre.js` ; jetons toujours dans `app_data` (`ebay_tokens*`) |
| K5 | moteur VRM fermé (battement, veille, « vendu sur eBay ») | **RIEN** | aucun `agent-ebay.js`, aucune migration 015, aucun mode `battement` ; `ebay_orders` ne se relit que sur synchro (`src/App.jsx:15782`, `:17848`) |
| K6 | écran « Agent » | **PARTIEL** | `EbayAgent` `src/ebayGestion.jsx:171` sur `preparerAgentEbay` `api/_lib/ebay-agent.js:4` : une liste de tâches à faire (préparation seulement), journal des actions (`executerAvecJournal`) — ni pouls, ni interrupteurs, ni familles |
| K7 | expédier sans argent (Colis, Ma journée, voie eBay) | **PARTIEL → avancé par cette PR** | avant : eBay → Ventes seulement (`EbayCommande` `src/ebayGestion.jsx:31` : adresse, suivi tapé `expedier` `api/_lib/ebay-gestion.js:84`, message) ; **cette PR** : la vente eBay dans Colis, Ma journée, la cloche, le widget, le rappel du matin, le bilan (voir plus bas). Reste : « Imprimer la journée », étiquette glissée et tamponnée, rappels J-1/J |
| K8 | doubles et retrait d'eBay VRM fermé | **RIEN** (dépend de K5) | le retrait auto existe **app ouverte** seulement |
| K9 | argent juste (Finances, signature UE) | **PARTIEL** | solde `api/ebay.js:1370` (`seller_funds_summary`) ; CA « l'argent reçu » dans `ventesDeclarables` ; pas de `ebay-signature.js` (transactions/payouts signés) |
| K10 | notifications d'eBay (l'oreille) | **RIEN** | aucun mode `ebay-notif` |
| K11 | suivi jusqu'au client | **RIEN** | le suivi n'est que listé dans `EbayCommande` ; pas d'étapes, pas de La Poste |
| K12 | photos chez eBay (Media API) | **RIEN** | `PictureURL` = liens Vinted (`api/ebay.js:246`) |
| K13 | messages au client et évaluation | **PARTIEL (sur son clic)** | message à l'acheteur `api/_lib/ebay-gestion.js:103`, réponses `:134`, évaluations positives `:202` ; aucun message automatique |
| K14 | bordereaux achetés par VRM | **GELÉ** (§2.8 : l'acheteur paie) | — |
| K15 | boîte, après-vente, niveau vendeur | **PARTIEL (sur son clic)** | retours, annulations, offres reçues, achats `api/_lib/ebay-apres-vente.js`, `src/ebayGestion.jsx:237` ; pas de niveau vendeur |
| K16 | annonces vivantes et prix | **PARTIEL** | baisse des paires qui dorment (clic), promotion `src/ebayGestion.jsx:284` ; rien d'automatique |
| K17 | « brancher ton agent », bilan de la semaine | **PARTIEL** | le bilan du lundi compte eBay dans vendu/reçu (`api/_lib/bilan-semaine.js`) et, **avec cette PR**, dans les colis ; pas de parcours « brancher » |

**Ce qui bloque le reste :** K5, K8, K10 et tout « VRM fermé » attendent la
**migration 014 appliquée** et l'**horloge (015, `pg_cron`/`pg_net`)**, sur un oui de
Julien ; K4 attend `VRM_COFFRE_CLE`. Rien de cela ne se fait sans lui.

## Ce que cette PR construit (19 octobre) — « rien ne se passe après une vente eBay »

Mesuré d'abord dans le code : une commande eBay payée n'était visible que dans
eBay → Ventes. `toShip` (Colis, Ma journée), `vrm_colis_aposter` (la cloche),
`api/widget.js` et `api/ship-reminders.js` ne comptaient que Vinted.

- **Une règle** (`api/_lib/ebay-a-expedier.js`, cette PR) : `colisEbay(orders)` →
  `null` (pas su) ou `{ aPoster, nePasPoster, horsEnvoi }`. À poster = payée
  (`etatCommandeEbay(o).peutExpedier`), pas expédiée, pas d'annulation demandée,
  un envoi (`fulfillmentInstructionsType` SHIP_TO, ou type absent — jamais un colis
  caché). « Ne poste pas » = annulation demandée (inconnue ⇒ demandée). Date
  limite = `lineItems[].lineItemFulfillmentInstructions.shipByDate` (l'ancien nom
  `fulfillmentInstructions` reste lu ; `ebay-agent.js` lisait SEULEMENT l'ancien,
  donc l'urgence de l'écran Agent ne s'allumait jamais si eBay suit sa doc —
  corrigé). Authentification d'eBay signalée (`program.authenticityVerification`).
- **Lue par** Colis (bloc « Ventes eBay à poster » : N° par le SKU `VRM-{n°}` via
  `numLigneEbay`, jours, emplacement au stock, « Étiquette sur eBay ↗ », « Suivi et
  message à l'acheteur » qui ouvre eBay → Ventes sur CETTE commande ; « Ne poste
  pas » en tête ; total du haut Vinted + eBay ; âge de la lecture des commandes
  au-delà de 6 h), Ma journée (« À envoyer » au même nombre, action « Ne poste
  pas »), `vrm_colis_aposter` (la cloche : `ebay`, `nePasPoster`), le widget
  (`ship.total` comprend eBay, `ship.ebay`, `ship.auMoins`), le rappel du matin
  (part aussi pour un vendeur eBay seul ; « colis eBay », « ne poste pas ») et le
  bilan du lundi (« au moins » si eBay illisible). Trois états partout.
- **Non mesuré** (aucune vente eBay chez lui) : les noms de champs de l'API
  Fulfillment (doc d'eBay) ; l'adresse `ebay.fr/sh/ord/details?orderid=` du Seller
  Hub (un lien, pas une promesse) ; la fraîcheur des commandes dépend de la synchro
  (manuelle, ou la relecture quand une règle d'offre est posée) tant que K5 n'existe
  pas — d'où l'âge affiché.
- **Preuves** : `scripts/audit-ebay-colis.cjs` (la règle + les VRAIES routes widget
  et rappel) — 9 rouges sur 65eec06, 3 mutations rouges (annulation comptée 7 ·
  widget sans eBay 1 · eBay illisible lu 0 1) ; banc `scripts/bancs/ebay-colis.cjs`
  (390 tactile + 1512, données inventées) — 28 rouges sur le build de 65eec06,
  mutation « Ma journée sans eBay » 2 rouges.

---

# État réel de l'agent eBay — ce qui est construit, ce que Julien a testé (11 octobre)

**Pour :** Julien, et les sessions qui construiront l'« agent eBay 100 % autonome ».
**Rédigé le :** 11 octobre 2026, vers 16 h (heure de Paris ; 14 h UTC).
**Sources, toutes lues ici, aucune devinée :**
- la feuille de route du 9 octobre et ses dix spécifications
  (`../agent-ebay/feuille-de-route.md`, `spec-*.md`) ;
- le code de la branche **`worktree-wf_30feaf2f-334-8`** (règle d'offre + plusieurs
  comptes eBay), dans `/home/user/cancale-v67/.claude/worktrees/wf_30feaf2f-334-8`.
  **Tous les `fichier:ligne` ci-dessous renvoient à CET arbre**, sauf mention
  « (production) » ou « (main) » ;
- le code de `origin/main` (ce qui est en ligne sur vrm.center) ;
- sa base Supabase, **en lecture seule et projetée** : aucun jeton, aucun
  `refresh_token`, aucun nom ni adresse d'acheteur n'a été lu ni n'est écrit ici ;
- la liste des **noms** des variables Vercel (jamais leurs valeurs) ;
- les cinq audits eBay de la branche, **exécutés en local** (aucun appel réseau).

**Aucun appel** n'a été fait à eBay, à un transporteur ou à Vinted.

---

## 0. En une page

1. **Ce que tu as testé, ce n'est pas le code le plus récent.** vrm.center tourne
   sur `main`. Le 10 octobre au soir, c'était la version du 9 octobre (PR #470,
   commit `e6bda5c`). Elle n'a **ni** « plusieurs comptes eBay », **ni** la
   « règle d'offre » (eBay accepte tout seul au-dessus d'un seuil). Ces deux
   chantiers sont **finis et prouvés**, mais ils vivent sur une branche à part,
   **jamais fusionnée**. Cette branche a aussi **32 commits de retard** sur `main`
   (numérotation en B, paires supprimées, abonnement à 12,99 €).

2. **Ce que tu as fait sur eBay depuis le 9 octobre** (mesuré dans ta base) :
   - le 10 octobre au soir, tu as **publié une paire depuis VRM**, la N°553
     (« Autry reelwind beige taille 36 », 120 €) ;
   - tu as **relié** ton annonce « Air Max 1 Aquatone » à la paire N°559 ;
   - tu as **allumé le retrait automatique** ;
   - aucune vente eBay, aucun brouillon, aucune programmation, aucun retrait
     automatique fait, et ton solde eBay n'a **jamais** pu être lu.

3. ⚠️⚠️ **La N°553 est en vente sur eBay alors qu'elle est déjà vendue sur Vinted.**
   La vente Vinted date du 10 octobre à **22 h 25** (heure de Paris). L'annonce
   eBay a été créée par VRM **3 min 40 s plus tard**, à **22 h 29**.
   - VRM ne pouvait pas le savoir : sa « preuve de vente » ne lit qu'une seule
     source, et cette source n'existe pas pour cette vente.
   - Pour la même raison, VRM ne l'a ensuite **ni retirée, ni signalée**.
   - Et même si la preuve avait existé, la règle du retrait automatique l'aurait
     **écartée exprès**, parce que l'annonce eBay est plus récente que la vente
     (§3).
   - Selon la dernière lecture d'eBay par VRM (10 octobre, 22 h 29), **l'annonce
     est toujours active**. **Le geste est à toi : retire-la d'eBay.**

4. **Pourquoi c'est « pas mal » et pas « incroyable »** :
   - **tout** ce que VRM fait sur eBay demande que **l'app soit ouverte** ;
   - **rien** ne se passe après une vente eBay : pas de numéro de carton, pas de
     date limite d'envoi, pas de bordereau, pas de suivi, pas de message à
     l'acheteur, rien dans Colis, Ma journée, le widget ou le rappel du matin ;
   - **8 chantiers sur 10** de la feuille de route ne sont **pas commencés**.

5. **Les fondations sont solides** : identité par SKU `VRM-n°`, comptes
   cloisonnés par vendeur, « pas su » qui n'agit jamais, 354 contrôles verts sur
   la route.
   Ce qui manque, ce sont **trois moteurs** :
   - un passage côté **serveur** (VRM fermé) ;
   - une **preuve de vente** qui lit aussi le bordereau ;
   - un **après-vente**.

---

## 1. Ce qui tourne où

| où | commit | ce qu'il contient pour eBay |
|---|---|---|
| **Production** (vrm.center, `origin/main`) | `61ef35a` depuis le 11 oct. 13 h 42 ; **`e6bda5c` (PR #470, 9 oct. 00 h 30) pendant ton test du 10 oct.** | connexion OAuth (**un seul compte**), publier une paire, vérifier sans publier, brouillons, planificateur et programmées, relier une annonce à une paire (SKU), offre aux observateurs, baisse de prix, retrait (clic ou automatique, **app ouverte**), solde, synchro. `main` porte en plus, depuis le 11 oct., la lecture du marqueur de numérotation dans le retrait (`api/ebay.js:784-794` (main), `numeroExterne`). |
| **Branche `worktree-wf_30feaf2f-334-8`** (23 commits hors de `main`) | `2a34c1c` | tout ce qui précède, **plus** : plusieurs comptes eBay par vendeur (`f77b5c2`, `df5c126`, `0623451`), revue p6-10 (`12c6f26`, `5cfa12e`, `1b19e62`), règle d'offre (`15f6fbb` … `2a34c1c`). **Jamais fusionnée.** Elle a **32 commits de retard** sur `main`. Les conflits attendus sont dans `src/App.jsx` (+978/−88 côté `main` depuis la séparation) et `api/ebay.js` (+13/−… côté `main`, retrait × numérotation). |

Audits de la branche, **relancés en local aujourd'hui** (aucun réseau) :

| audit | résultat |
|---|---|
| `audit-ebay-route.cjs` | **354 contrôles**, tous verts |
| `audit-ebay-retrait-auto.cjs` | 57 ✅ |
| `audit-ebay-deja-vendue.cjs` | 26 ✅ |
| `audit-offres-auto.cjs` | 16 contrôles, verts |
| `audit-fonctions-api.cjs` | vert (**12 fonctions sur 12 permises** : toute nouveauté doit être un *mode* d'une route existante) |

Variables Vercel (noms seulement, production) :
- **présentes** : `EBAY_APP_ID`, `EBAY_CERT_ID`, `EBAY_DEV_ID`, `EBAY_RUNAME`,
  `EBAY_VERIF_TOKEN`, `EBAY_DELETION_URL`, `CRON_SECRET`,
  `SUPABASE_SERVICE_KEY`, `VRM_OWNER_UID`, `VAPID_PRIVATE_KEY` ;
- **absentes** : toute clé de transporteur ou d'agrégateur. Aucune clé d'IA côté
  serveur n'est listée.
- ⇒ `EBAY_DEV_ID` existe déjà : c'est ce que la feuille de route demandait pour
  **vérifier les notifications d'eBay** (chantier `veille`). Ce point n'est donc
  plus bloquant.

---

## 2. Chantier par chantier : fait, partiel ou pas commencé

Légende : **FAIT** · **PARTIEL** · **RIEN** (pas commencé).
« Prod » = la fonction est en ligne aujourd'hui ;
« branche » = elle n'existe que dans `worktree-wf_30feaf2f-334-8`.

### Étape 0 — plusieurs comptes eBay (prérequis de la feuille de route)
**FAIT (branche), absent de la prod.**
- Côté serveur : registre `ebay_comptes`, `lireComptes`
  `api/_lib/ebay.js:175`, `normaliserRegistre` `:181`, `comptesActifs` `:208`,
  `resoudreCompte` `:350`, `accessToken(owner, suffixe)` `:411` ; contexte
  d'action `jetonDe`/`ligneDe` `api/ebay.js:36-37` ; le compte est validé avant
  tout appel `api/ebay.js:1607-1609`.
- Côté app : `lireEbayParCompte` `src/App.jsx:9363`, `lireEbayTous` `:9383`,
  `commandesEbayTous` `:9396`, sélecteur de compte `src/App.jsx:38200-38207`.
- Dans ta base : **aucune ligne `ebay_comptes`**. C'est normal, la prod ne
  l'écrit pas.

### La règle d'offre (décision du 9 octobre) — FAIT (branche), absente de la prod
- Route : `handleRegleOffre` `api/ebay.js:389`, `handleRegleOffreLire` `:505`.
- Relecture après écriture : `lectureRegleDe` `:291`, `lireRegleOffre` `:316`,
  `memeRegle` `:329`, `relireApres` `:337`.
- Rangement dans `ebay_offres{suffixe}` : `rangerReglesOffre` `:357`, lu par la
  synchro dans le même `GetItem` `:1334-1361`.
- Seuils à la création :
  - `itemXml` `api/ebay.js:640-646` pose `BestOfferAutoAcceptPrice` et
    `MinimumBestOfferPrice` ;
  - `regleDeItem` `:725` ;
  - `valideRegleOffre` et `seuilTropBas` vivent en copies identiques dans
    l'app et dans `api/_lib/ebay.js:483-496`.
- App : `etatRegleOffre` `src/App.jsx:9499`, « Une règle pour toutes »
  `EbayReglesToutes` `:11855`, relecture des ventes quand une règle est active
  `:12266-12290`.
- Preuves :
  - `audit-ebay-route.cjs` ;
  - `scripts/prouve-regle-offre.cjs`, `scripts/_xml-publication.cjs` ;
  - le banc `scripts/bancs/ebay-regle-offre.cjs` (765 lignes) ;
  - `audit-offres-auto.cjs`, qui refuse tout autre chemin d'acceptation que ce
    seuil, posé par `ReviseFixedPriceItem`.
- Dans ta base : **aucune ligne `ebay_offres`**. C'est normal, la prod ne la
  pose pas.

### 1. `socle` — RIEN des six points (sauf ce qui existait avant)
| point de la spec | état | où |
|---|---|---|
| 3.1 « relié » a trois états (ok · refusé · pas su), expiration annoncée | **RIEN**. `status` ne teste que la PRÉSENCE du jeton (`hasRefresh`). `accessToken` rend `reason:'refresh-failed'` pour tout échec, `invalid_grant` compris : pas de `revoque`, pas de `refuseLe`, pas d'`expireLe`. | `api/ebay.js:1549-1567`, `api/_lib/ebay.js:411-430` |
| 3.2 la synchro dit ce qu'elle a lu | **RIEN côté app**. La route rend `lu:{…}` (`api/ebay.js:1379`), mais l'app **ignore la réponse** (`try { await fetch(...) } catch (_) {}`). Synchro automatique seulement à l'ouverture de « Compte eBay », si la dernière capture a plus de 6 h. | `src/App.jsx:10447`, `:12261`, `:10462` |
| 3.3 commandes paginées, fusionnées, sans adresse d'acheteur | **RIEN**. Une seule page `order?limit=50`, **réécrite** à chaque synchro, rangée **brute** (adresse de livraison comprise). Pas de `lireCommandesEbay`/`fusionnerCommandes`/`commandeMinimale` dans la route (le `lireCommandesEbay` de `api/ship-reminders.js:156` est un lecteur du bilan, pas celui de la spec). | `api/ebay.js:1324`, `:1369` |
| 3.4 notification de suppression de compte (POST) | **RIEN**. Le défi GET est juste. Le **POST répond 200 sans rien faire** et sans vérifier de signature. | `api/ebay.js:1394-1406` |
| 3.5 « Publier » exige l'état ; `]]>` échappé | **RIEN**. `itemXml` pose encore `ConditionID` 3000 (« Occasion ») par défaut, et la description part en `CDATA` sans échapper `]]>`. `handlePublish` n'exige pas l'état (`handleProgrammer`, si). | `api/ebay.js:611`, `:619`, `:781-821` |
| 3.6 portées rangées avec le jeton | **RIEN**. `SCOPES` est une chaîne fixe de 5 portées ; `ebay_tokens` ne porte pas `portees` (mesuré : clés `refresh_token, saved_at, refresh_expires_days`). | `api/_lib/ebay.js:20-26` |

### 2. `veille` — RIEN
- Il n'existe ni `synchroniserCompte`, ni `ebay_veille`, ni `handleNotif`, ni
  `?mode=notif`, ni réécriture `/api/ebay-notif` dans `vercel.json`.
- Il n'existe ni mémo `ebay_ventes_annoncees` ni `ebay_doubles_annonces`, ni
  catégorie de notification `double` (`PUSH_DEFAUT` `api/_lib/push.js:98` n'a
  que `vente, argent, colis, offre…`), ni `api/_lib/ebay-regle.js`.
- Le cron du matin (`api/ship-reminders.js`, 08:00 UTC) **n'appelle jamais eBay**.
  Il ne lit que la ligne `ebay_orders` déjà rangée, pour le bilan de la semaine
  (`api/ship-reminders.js:156-170`, `:177-207`).
- Aucune vente eBay ne fait sonner ton téléphone. Une vente eBay n'apparaît que
  dans le centre de notifications de l'app (« N ventes eBay à expédier »), et
  **seulement à partir de la dernière synchro faite app ouverte**
  (`src/App.jsx:37415`, `:37499`).

### 3. `publier-lot` — PARTIEL (les briques d'avant, pas le lot)
**Existe (en prod depuis le 5 octobre)** :
- publier une paire `EbayPublier` `src/App.jsx:9641` ;
- brouillons `ebay_brouillons` (`modifierBrouillonsEbay` `:9222`) ;
- planificateur `EbayPlanificateur` `:11271` (`heuresDuLot` `:9112`, heure de
  Paris) ;
- programmées `EbayProgrammees` `:11696` ;
- côté route : `handleProgrammer` `api/ebay.js:886`, `handleReprogrammer`
  `:1010`, `handleDeprogrammer` `:983`, `fraisParNom` `:673` ;
- la garde « une paire, une annonce » `dejaChezEbay` `:765`, et « déjà vendue »
  `numerosDejaVendus` `src/App.jsx:32659`.

**RIEN** :
- `pairesPretesEbay` (« 9 prêtes, 31 à compléter ») ;
- préparer **tous** les brouillons d'un clic ;
- photos **copiées chez eBay** (Media API ou `UploadSiteHostedPictures`) ;
- tables d'états, de catégories et de prix (`vrm_ebay_etats`,
  `vrm_ebay_categories_ok`, `vrm_ebay_prix_regle`) ;
- l'écran `EbayPretes`.

⚠️ **Mesuré sur ta seule annonce publiée par VRM (N°553)** : eBay rend ses
**16 photos** sous des adresses **`images1.vinted.net`**. Tes deux annonces faites
à la main, elles, sont en **`i.ebayimg.com`** (hébergées par eBay).
- Les liens Vinted portent une signature (`?s=`). Le dossier a déjà vu de tels
  liens expirer. [à vérifier] : une annonce eBay qui pointe vers Vinted peut
  perdre ses photos.
- C'est exactement le point 4.3 de la spec `publier-lot`.

### 4. `expedier` — RIEN
- `aExpedierEbay` n'existe pas.
- **Colis** (`toShip`, `src/App.jsx:25276`) ne lit que les ventes **Vinted**
  (`sales.items`).
- Le widget (`api/widget.js`) ne contient **aucune** occurrence d'eBay.
- Le rappel du matin n'en a pas non plus.
- **eBay → Ventes** (`EbayVentes` `src/App.jsx:10643-10717`) liste titre, statut
  (« Paiement en attente / À expédier / Expédiée »), pseudo de l'acheteur et prix
  payé par l'acheteur. Il n'affiche **ni** le N° de carton (qui est pourtant dans
  le SKU), **ni** `shipByDate`, **ni** « annulation demandée », et ne propose
  **aucun geste**.
- Ni suivi (`createShippingFulfillment`), ni bordereau.

### 5. `retrait-serveur` — RIEN côté serveur ; le retrait automatique existe côté app
**Existe, côté app seulement** :
- `retraitsEbayAutoPermis` `src/App.jsx:32494` ;
- `passageRetraitEbayAuto` `:32561` et `retirerEbayAuto` `:32591`, au plus 5 par
  passage ;
- le déclenchement par la coque `:37442-37450`, **seulement app ouverte** ;
- les raisons dites à l'écran : `RAISON_RETRAIT_AUTO` `:32536` ;
- côté serveur, `handleRetirer` en mode `auto` revérifie : réglage relu,
  `GetItem` puis SKU comparé (`api/ebay.js:1176-1222`) ;
- le journal `ebay_retraits_auto{s}` (50 derniers).

**RIEN** : `retirerAnnonceAuto` (serveur), `passageRetraitServeur`,
`ebay_retraits_tentes`, l'étape dans `api/ship-reminders.js`, la synchronisation
de `vinted_accounts_blocked` vers le serveur. **Aucun retrait ne part VRM fermé.**

### 6. `argent` — RIEN
- Le CA eBay compte toujours **ce que l'acheteur a payé**
  (`pricingSummary.total`), port compris. Ta décision du 3 octobre (« l'argent que
  tu reçois ») n'est appliquée nulle part. Endroits concernés :
  - `caEbayPayees` `src/App.jsx:8320-8325` ;
  - `ventesDeclarables` / `ventesFaites` `api/_lib/ventes-regle.js:132-145`,
    `:168-174` ;
  - l'affichage de `EbayVentes` `:10710`.
- Ni signature numérique (`signerRequete`, `ebay_signature`), ni versements
  (`ebay_versements`), ni `getTransactions`.
- Le solde (`handleFinances` `api/ebay.js:1227`) n'est **jamais** arrivé en base
  (aucune ligne `ebay_finances`). D'après la feuille de route, eBay exige une
  signature numérique sur les lectures d'argent d'un vendeur européen
  [à vérifier, non mesuré ici].
- Aujourd'hui **0 vente eBay** : rien de faux dans tes chiffres, mais c'est à
  livrer **avant** la première.

### 7. `boite` — RIEN (la règle d'offre de la branche en est la seule part)
- Aucune lecture des offres reçues (`GetBestOffers`).
- Aucune réponse (`RespondToBestOffer`), aucune question (`GetMemberMessages`,
  `AddMemberMessageRTQ`).
- Aucun message eBay dans l'écran Messages.
- L'**offre aux observateurs** existe (`handleOffre` `api/ebay.js:1112`,
  `eligiblesOffre` `:1085`) : c'est la seule chose qui « parle » aux acheteurs.

### 8. `annonces-vivantes` — PARTIEL
**Existe** :
- changer le prix ou le stock (`handleRevise` `api/ebay.js:538`,
  `ReviseInventoryStatus` `:526`) ;
- relier par SKU (`handleSku` `:1060`) ;
- retirer (`handleRetirer` `:1176`) ;
- l'annonce retirée sort aussitôt de la liste (`sortirDesAnnonces` `:1169`) ;
- la baisse des paires qui dorment.

**RIEN** : modifier titre, description ou photos ; « hors stock » (pause) ;
remettre en vente (`RelistFixedPriceItem`, `VerifyRelistItem`) ; « la paire te
revient ».

### 9. `litiges` — RIEN
Ni annulations, ni retours, ni réclamations, ni litiges de paiement, ni
évaluations. Aucune nouvelle portée demandée (`sell.payment.dispute` absente).

### 10. `visibilite` — RIEN (sauf les observateurs)
- Le nombre d'**observateurs** est lu (`WatchCount` → `observateurs`,
  `api/ebay.js:167-179`).
- Ni vues, ni impressions (`traffic_report`), ni annonces sponsorisées.

### Bilan

| chantier | état |
|---|---|
| Étape 0 · plusieurs comptes | FAIT (branche) |
| Règle d'offre | FAIT (branche) |
| 1 socle | RIEN |
| 2 veille | RIEN |
| 3 publier-lot | PARTIEL (une paire à la fois, brouillons, planificateur) |
| 4 expedier | RIEN |
| 5 retrait-serveur | RIEN (le retrait app ouverte existe) |
| 6 argent | RIEN |
| 7 boite | RIEN (offre aux observateurs seulement) |
| 8 annonces-vivantes | PARTIEL (prix, stock, relier, retirer) |
| 9 litiges | RIEN |
| 10 visibilite | RIEN (observateurs seulement) |

---

## 3. Sa base, depuis le 9 octobre (lecture seule, projetée)

⚠️ `updated_at` ment : il garde la date de **création** de la ligne (§4.3). Les
dates de capture viennent de `data.capturedAt`. Toutes les lignes eBay
appartiennent au propriétaire `74eea6e7-…` (Julien) : **aucun autre vendeur n'a
de ligne `ebay_*`**.

### 3.1 Les lignes eBay qui existent

| ligne | contenu (compté, rien de personnel) | capture |
|---|---|---|
| `ebay_tokens` | jeton présent ; rangé le **6 oct. 13 h 54 UTC** ; durée annoncée 548 jours (expire vers **avril 2028**) ; **pas de `portees`** | — |
| `ebay_listings` | **3 annonces actives** (le 9 oct. : 2) ; voir 3.2 | **10 oct. 20 h 29 min 12 s UTC** |
| `ebay_programmees` | 0 programmée ; `enLigne` = les 3 mêmes ; `complet: true` ; ligne **créée le 10 oct. à 17 h 43 UTC** (première synchro qui l'écrit) | 10 oct. 20 h 29 UTC |
| `ebay_orders` | **0 commande** (statut 200 : eBay a bien répondu « aucune ») | 10 oct. 20 h 29 UTC |
| `ebay_inventory` | 0 article (Inventory API : tes annonces sont en Trading, c'est normal) | 10 oct. 20 h 29 UTC |

**Absentes** (jamais écrites) :
- `ebay_comptes`, `ebay_offres` (fonctions de la branche, pas en prod) ;
- `ebay_brouillons` : **aucun brouillon enregistré** ;
- `ebay_retraits_auto` : **aucun retrait automatique fait** ;
- `ebay_finances` : **solde jamais lu** ;
- `ebay_veille`, `ebay_ventes_annoncees`, etc. (rien de la veille).

Dans `main` (ses réglages synchronisés) :
- `vrm_ebay_retrait_auto` = **`"true"`** : il a **allumé** le retrait automatique ;
- `vrm_ebay_rythme` : absent, le planificateur n'a jamais été réglé ;
- `vrm_numerotation` : **absent**, la migration 013 « anciens numéros en B » n'est
  **pas** appliquée ;
- 425 fiches numérotées.

**Emails** : **0** ligne `email_*` dont l'expéditeur ou le sujet contient
« ebay ». Aucun email eBay n'arrive dans VRM, et `api/email-inbound.js` ne
contient aucune règle eBay.

**Vinted, pour mesure** : sur ses 7 comptes liés, relus le 11 oct. vers 13 h 44
UTC, **20 paires en ligne, toutes numérotées**. Le 9 octobre il y en avait 45 ;
il a tout supprimé pour republier. **2 de ces paires portent un SKU eBay**
(N°559 en ligne ; N°553 vendue).

### 3.2 Les trois annonces eBay

| annonce | SKU | en ligne depuis (UTC) | prix | photos | qui l'a faite |
|---|---|---|---|---|---|
| `128086452103` | **VRM-559** | 18 sept. 20 h 24 | 68 € | 12, `i.ebayimg.com` | à la main sur eBay, **reliée à la N°559** (Vinted `10313117068`, numérotée le 10 oct. 10 h 38, encore en ligne sur Vinted à 67 €). Il l'a donc reliée **le 10 octobre**, après 10 h 38 UTC. |
| `128101592740` | *(aucun)* | 27 sept. 15 h 17 | 74 € | 13, `i.ebayimg.com` | à la main ; **toujours reliée à aucune paire** |
| `128127336988` | **VRM-553** | **10 oct. 20 h 29 min 08 s** | 120 € | **16, `images1.vinted.net`** | **publiée par VRM** : SKU canonique, synchro 4 s après, liens de photos Vinted |

Ce qu'on ne peut **pas** savoir par la base : s'il a essayé l'offre aux
observateurs (elle ne laisse aucune trace), la vérification à blanc ou la règle
d'offre (pas en prod).

### 3.3 ⚠️⚠️ La N°553 : vendue sur Vinted, toujours en vente sur eBay — pourquoi le retrait n'a rien fait

**La chronologie, mesurée** (heures UTC ; ajouter 2 h pour Paris) :

| quand | quoi | source |
|---|---|---|
| 10 oct. 08:15 | l'annonce Vinted `10312412617` reçoit le **N°553** (compte `3175765377`, 115 €) | `main.vinted_annonce_numeros` |
| **10 oct. 20:25:28** | **vendue sur Vinted** (100 €), transaction `23052006117` | `harvest_3175765377_orders_sold` |
| **10 oct. 20:29:08** | **VRM crée l'annonce eBay `128127336988`** avec le SKU `VRM-553` (120 €) | `ebay_listings.depuis` |
| 10 oct. 20:29:12 | synchro eBay (la dernière à ce jour) | `capturedAt` |
| 10 oct. 21:55 | le bordereau est capté ; sa ligne porte **`item: 10312412617`** (l'identité de l'annonce vendue) | `harvest_3175765377_label_23052006117` |
| 11 oct. 13:43 | dressing et ventes relus : l'annonce Vinted est **fermée**, la vente est « Bordereau envoyé au vendeur » | `harvest_3175765377_listings`, `_orders_sold` |

**Pourquoi rien n'a été fait** (d'après le code et les données) :

1. **La preuve de vente ne regarde qu'UNE source, absente ici.**
   - Ce qu'elle fait : `lireVentesVintedProuvees`, en prod comme dans la branche
     (`src/App.jsx:19632-19651`, `preuvesVentesVinted` `:19597`), ne lit **que**
     les lignes `harvest_*_txn_*` (transaction → `item_id`).
   - Ce qui manque : **il n'existe aucune ligne `harvest_3175765377_txn_23052006117`**.
     Les détails de transaction de ce compte n'ont plus été écrits depuis le
     **6 octobre**. Il n'y a pas non plus de conversation captée pour cette vente.
   - Ce qui existait pourtant : l'identité **existait** dans la ligne du
     bordereau (`label.item`). L'extension lit même le détail de la transaction
     pour aller chercher le PDF (`recupererLabel`,
     `vinted-sync-extension/background.js:5609` (main)), puis n'en garde que
     `item`/`items` dans la ligne du bordereau (`:5696-5705`), jamais la
     transaction.
   - Conséquence : `vendusVinted` ne contient pas `10312412617`, et
     `doublesVenteEbay` (`src/App.jsx:32704`) ne met **pas** la N°553 dans « à
     retirer d'eBay ». Il n'y a **ni alerte, ni retrait automatique, ni ligne
     « pourquoi »**. Le silence est total.
   - **Mesuré sur tous ses comptes**, ventes des 7 derniers jours (hors
     annulées) :

     | ventes | avec ligne de transaction | avec ligne de bordereau | sans aucune identité |
     |---|---|---|---|
     | **14** | **7** | **10** | **2** |

     ⇒ La preuve actuelle **rate une vente récente sur deux**, précisément dans
     la fenêtre où le risque de double vente existe. Les ventes de 8 à 30 jours
     sont mieux couvertes (35 sur 44), parce que les dates de versement
     finissent par faire lire la transaction.

2. **Même avec la preuve, la règle du retrait automatique l'aurait écartée.**
   - La règle : `retraitsEbayAutoPermis` (branche, `src/App.jsx:32517-32519`)
     écarte une annonce eBay mise en ligne **après** la vente (`ebay-apres-vente`).
   - Son motif, écrit au-dessus (`:32476-32478`) : « publiée APRÈS, c'est une
     remise en vente voulue (la paire est revenue) ».
   - Le cas 553 : ici, 20:29:08 vient après 20:25:28. Mais ce n'était **pas**
     une remise en vente : VRM a publié parce qu'il **ne savait pas**.
   - Ce qui suffirait : le cas « la paire est revenue » est **déjà** couvert par
     ailleurs (une AUTRE annonce Vinted de ce N° en vente et pas vendue,
     `doublesVenteEbay` `:32742`).
   - `audit-ebay-retrait-auto.cjs` protège cette règle (« annonce eBay
     antérieure »). Il **passerait au rouge** si on la retirait : ce sera une
     décision à prendre, pas un oubli.
   - En prod (`e6bda5c`), cette règle n'existe pas encore. Seule la cause 1 a
     joué.

3. **La publication elle-même n'a pas été bloquée.**
   - La garde : `gardePublier` (production, `src/App.jsx:10142` dans `main`).
     Elle se fie à la même preuve (`numerosDejaVendus`, transactions seulement).
     Pour une paire choisie dans la liste « en ligne » (`pairSel`), elle ne
     revérifie pas que l'annonce Vinted est encore en ligne.
   - La conséquence : à 20 h 29 le dressing capté datait d'avant la vente
     [à vérifier : l'heure exacte de la capture précédente n'est pas gardée],
     donc la paire « était » en ligne pour VRM.
   - La garde du serveur (`dejaChezEbay`, `api/ebay.js:765`) ne regarde
     **qu'eBay**. Elle ne peut pas savoir qu'une paire est vendue sur Vinted.

4. **De toute façon, tout cela ne tourne que l'app ouverte.**
   - Le retrait automatique est lancé par la coque (`src/App.jsx:37442` branche ;
     `:36454` main).
   - Le cron ne touche pas eBay, et aucune synchro eBay n'a eu lieu depuis
     20 h 29.
   - VRM ne sait donc pas non plus si l'annonce a été vendue ou terminée sur
     eBay depuis.

5. **Piège à venir — la numérotation.**
   - 553 et 559 sont des numéros « provisoires » (553 et plus). La migration 013,
     pas encore appliquée, prévoit de les renuméroter (`renum`).
   - Elle prévoit aussi qu'un SKU eBay posé **avant** la coupure désigne
     l'ANCIENNE paire (`numeroExterne`, `api/_lib/numerotation.js:47` (main)).
   - Le jour où 013 est appliquée, `VRM-559` risque de ne plus désigner la paire
     en ligne : l'identité eBay est cassée tant que le SKU n'est pas réécrit.
     [à vérifier dans `main`, qui lit le marqueur côté serveur et côté app]

---

## 4. Les trous : pourquoi « c'est pas mal » mais pas « incroyable »

### 4.1 Ce qui demande encore son clic, ou l'app ouverte
- **La relecture d'eBay** se fait :
  - à l'ouverture de « Compte eBay », si la dernière capture a plus de 6 h
    (`src/App.jsx:10462`) ;
  - après une publication ou une modification (`resync`, `:12259`) ;
  - ou, dans la branche, quand une règle d'offre est active (`:12266`).
  Il n'y a **rien** VRM fermé. Dernière relecture : le 10 oct. à 20 h 29 UTC, **soit ~17 h 40 avant ce relevé** (11 oct. 14 h 07 UTC).
- **Le retrait automatique** ne tourne que dans la coque de l'app ouverte.
- **Publier** se fait paire par paire, en environ 6 gestes : choisir la paire,
  « Trouver la catégorie eBay », état et caractéristiques, prix, « Vérifier sans
  publier », « Publier sur eBay », puis « Oui, publier ».
- **Programmer** : le planificateur existe, mais il faut d'abord un brouillon
  par paire. Il n'a jamais servi (0 brouillon).
- **Relier** une annonce faite à la main : un clic par annonce.
  `128101592740` reste non reliée.
- **Retirer** d'eBay ce qui est vendu sur Vinted : en clic, ou en automatique
  app ouverte (voir 553).

### 4.2 Ce qui n'arrive jamais après une vente eBay
- Rien ne sonne : pas de notification « vendu sur eBay ».
- Pas de numéro de carton (il est pourtant dans le SKU), pas de date limite
  (`shipByDate` n'est ni lu ni affiché), pas de « ne poste pas, annulation
  demandée ».
- Rien dans **Colis**, **Ma journée** (sauf un compteur dans la cloche, sur des
  données de la dernière synchro), le **widget** ou le **rappel du matin**.
- Pas de bordereau, pas de numéro de suivi envoyé à eBay, pas de suivi du colis,
  pas de message à l'acheteur, pas d'évaluation, rien sur les retours, les
  annulations ou les litiges.
- Le CA eBay serait **faux** (prix acheteur, port compris) : la décision du
  3 octobre n'est pas appliquée.
- **« retire-la de Vinted »** existe (`aRetirerVinted`), mais seulement à
  l'ouverture de l'app.
- Côté données : les commandes sont rangées **brutes**, adresse d'acheteur
  comprise (socle 3.3). Aucune n'est en base aujourd'hui, mais la première y
  entrerait. Elles sont **réécrites** à chaque synchro (une page de 50) : une
  vente plus ancienne sortirait de VRM, et donc du CA.

### 4.3 Ce qui est lent
- **Une synchro**, par compte et à la file, c'est :
  - 3 lectures en parallèle (commandes, inventaire, `GetMyeBaySelling`) ;
  - puis **jusqu'à 20 `GetItem` l'un après l'autre** (`api/ebay.js:1339-1352`) ;
  - plus `apprendrePrincipal`.

  C'est le chemin de tous les écrans eBay. Les durées réelles ne sont **pas**
  mesurées : aucun appel à eBay n'a été fait d'ici.
- **L'Inventory API est relue à chaque synchro pour rien** : 0 article, puisque
  ses annonces sont en Trading.
- **Rien n'est incrémental** : chaque synchro relit tout.

### 4.4 Ce qui est confus à l'écran
- **eBay → Annonces** (`EbayAnnonces`, `src/App.jsx:12062-12868`, ~800 lignes)
  empile, **avant la première carte**, une quarantaine de blocs conditionnels
  (attributs `data-` comptés) :
  - à annuler, à retirer, raisons du retrait automatique (commune et par
    ligne), retirer de Vinted, vendues ;
  - l'interrupteur et le journal du retrait automatique ;
  - annonces illisibles, « pas su » ;
  - engagement des règles, fenêtre des ventes, relire, règles « pas su »,
    causes, bloquées, lot interrompu ;
  - sans observateur, non reliées ;
  - plus le publieur, les brouillons, le planificateur et les programmées.
- **Le silence de la 553 est le pire défaut.** L'interrupteur du retrait
  automatique est allumé, et l'écran ne dit **rien** de la seule paire qui
  pose problème. Elle n'est même pas candidate (cause 1). Il est allumé,
  et il en conclura que tout va bien.
- **eBay → Ventes** affiche le prix payé par l'acheteur, sans N° de carton,
  sans date limite, sans geste.
- **eBay → Achats** est une page vide (« pas encore récupérés »,
  `src/App.jsx:12870`).
- Le résumé eBay ne montre qu'une case (« Ventes payées »).
- Le retrait automatique se règle dans **Annonces**, alors que ses
  conséquences sont des **ventes**.
- Photos de la N°553 servies depuis Vinted (§2, chantier 3).

---

## 5. Les points d'accroche pour un agent autonome (à réutiliser, pas à refaire)

### 5.1 Côté serveur (là où l'agent doit vivre)
- **Le cron du matin, déjà par vendeur** :
  - `traiterVendeur` `api/ship-reminders.js:260`, exécuté dans
    `contexteVendeur.run({owner})` `:427` (8 vendeurs à la fois) ;
  - lectures `scoped()` `:72`, paginées `fetchPaginated` `:123` ;
  - dédoublonnage vérifié `ecrireDedup` `:103` ;
  - notifications `sendPushToAll`/`pushCategorieActive` (import `:19`),
    préférences `PUSH_DEFAUT` `api/_lib/push.js:98`.
  - **C'est l'endroit où greffer une étape « eBay »** (veille, retrait,
    après-vente). On n'ajoute aucun cron : un cron refusé bloquerait tous les
    déploiements.
- **La route eBay, déjà cloisonnée et multi-comptes** (branche) :
  - dispatch `ACTIONS` `api/ebay.js:1586-1604`, modes `handler` `:1616` : une
    nouvelle capacité = une **action** ou un **`?mode=`**, jamais une 13ᵉ
    fonction ;
  - `jetonDe`/`ligneDe` `:36-37`, `tradingCall` `:140` (⚠️ niveau de
    compatibilité **1149** ; la recherche « bordereaux » dit qu'il faut **1455
    ou plus** pour lire `ShippingLabelPolicy`) ;
  - `sansAck` `:81` (« incertain » ≠ « refusé ») ;
  - `numDeSku`/`memePaire` `:74-75` (SKU comparé par le N°) ;
  - `listeVendeur` `:208`, `tradingGetItem` `:229`, `dejaChezEbay` `:765`,
    `sortirDesAnnonces` `:1169` ;
  - **`handleRetirer` en mode `auto`** `:1176-1222` : il relit déjà le réglage
    **chez le vendeur**, puis le SKU chez eBay, et tient un journal. C'est le
    cœur de `retirerAnnonceAuto` (spec `retrait-serveur`) : il suffit de
    l'extraire pour qu'il ne dépende plus de la requête.
  - `handleSync` `:1315` est à extraire en `synchroniserCompte` (spec `veille`) ;
  - `handleFinances` `:1227` ; `fraisParNom` `:673` ; `itemXml` `:602`.
- **Jetons et comptes** (`api/_lib/ebay.js`) :
  - `portee(owner)` `:94` (filtre `owner=eq.`), `ecrireLignes` `:106` ;
  - `lireComptes` `:175`, `comptesActifs` `:208`, `resoudreCompte` `:350`,
    `lireRefresh` `:386`, `accessToken(owner, suffixe)` `:411` ;
  - `lireReglageVendeur` `:439` (trois états), `lireDonnee` `:452`.
  - Un jeton n'est jamais lu pour un autre vendeur.
- **Session et accès** : `vendeurExige` `api/_lib/session.js:48`,
  `baseCloisonnee` `:35`, `accesVendeur` (`api/_lib/abonnement.js`),
  `contexteVendeur` `api/_lib/owner.js:30`.
- **Recopier une règle de l'app vers le serveur** :
  - le mécanisme `--recopie` de `scripts/audit-bilan-semaine.cjs:59-67`, qui
    refabrique `api/_lib/ventes-regle.js` depuis `App.jsx`, déclaration par
    déclaration, puis compare le code ET les sorties ;
  - la même méthode est prévue pour `api/_lib/ebay-regle.js` ;
  - à y mettre : `doublesVenteEbay`, `numerosDejaVendus`,
    `retraitsEbayAutoPermis`, `preuvesVentesVinted`, `etatsVentesFrais`,
    `etatRevient`, `commandeEbayEngagee`, `numDeSkuEbay`, `skuEbayDe`,
    `cleNum`, `PAS_UNE_VENTE`, `aExpedier`, `limiteExpedition`.
- **Numérotation** (`main` seulement) : `api/_lib/numerotation.js`
  (`cleNum` `:27`, `numeroExterne` `:47`, `lireMarqueur` `:80`). Le retrait
  serveur de `main` l'utilise déjà (`api/ebay.js:784-794` (main)).

### 5.2 Les règles de l'app à réutiliser telles quelles (`src/App.jsx`, branche)

| fonction | ligne |
|---|---|
| `doublesVenteEbay` | `:32704` |
| `numerosDejaVendus` | `:32659` |
| `retraitsEbayAutoPermis` | `:32494` |
| `passageRetraitEbayAuto` | `:32561` |
| `retirerEbayAuto` | `:32591` |
| `RAISON_RETRAIT_AUTO` / `CONDITIONS_RETRAIT_AUTO` | `:32535-32547` |
| `preuvesVentesVinted` | `:19597` |
| `etatsVentesFrais` | `:19583` |
| `lireVentesVintedProuvees` | `:19632` |
| `fetchTxnItemIds` | `:2638` (même source : transactions seulement) |
| `commandeEbayEngagee` | `:32444` |
| `numDeSkuEbay` | `:32434` |
| `skuEbayDe` | `:32441` |
| `cleNum` | `:4341` |
| `aExpedier` | `:3491` |
| `limiteExpedition` | `:3517` |
| `toShip` | `:25276` (publie `vrm_colis_aposter` `:25335-25337`) |
| `caEbayPayees` | `:8320` |
| `lireEbayTous` / `commandesEbayTous` | `:9383` / `:9396` |
| `heuresDuLot` | `:9112` |
| `modifierBrouillonsEbay` | `:9222` |
| `etatRegleOffre` | `:9499` |
| `PUSH_CATS` | `:33649` |

### 5.3 Les lignes de données
- **eBay** :
  - `ebay_tokens{s}` (jamais renvoyé au navigateur) ;
  - `ebay_comptes` (branche) ;
  - `ebay_listings{s}` (`items[].sku`, `depuis`, `fin`, `detail`) ;
  - `ebay_programmees{s}` (`items`, `enLigne`, `complet`) ;
  - `ebay_orders{s}` ;
  - `ebay_brouillons`, `ebay_retraits_auto{s}`, `ebay_offres{s}` (branche),
    `ebay_finances{s}`.
- **Réglages** (`main`) : `vrm_ebay_retrait_auto`, `vrm_ebay_rythme`,
  `vinted_annonce_numeros`, `vrm_numerotation`.
- ⚠️⚠️ **La source d'identité inutilisée :
  `harvest_{uid}_label_{tx}.item` (et `.items` pour un lot)**.
  - Ce que c'est : la transaction → l'annonce, posée par l'extension à partir
    du détail de transaction (`background.js:5696-5705` (main)). C'est une
    **identité**, pas une ressemblance.
  - Ce qui la lit : l'écran Annonces (`labelsCaptes[tx].item`).
  - Ce qui l'ignore : la preuve de vente.
  - ⇒ Avec elle, la 553 aurait été prouvée vendue **dès 23 h 55** le 10 octobre.
  - Au même endroit : `harvest_{uid}_orders_sold` (état de la vente par
    `transaction_id`) et `harvest_{uid}_txn_{tx}` (`meta->>item_id`,
    `status`, `status_title`).
- `vinted_accounts_blocked` reste local à l'appareil : la spec `retrait-serveur`
  prévoit de le faire remonter.

### 5.4 Les audits et bancs à étendre (branche)
- `scripts/audit-ebay-route.cjs` (1 834 lignes, **354 contrôles**) : il exécute
  la vraie route contre un faux eBay et une fausse base, deux vendeurs et
  plusieurs comptes. Toute nouvelle action s'y ajoute.
- `scripts/audit-ebay-retrait-auto.cjs` (57) : il portera la décision sur
  `ebay-apres-vente` et la preuve par bordereau.
- `scripts/audit-ebay-deja-vendue.cjs` (26).
- `scripts/audit-offres-auto.cjs` (16) : il refuse toute acceptation hors du
  seuil natif. **Un agent qui « répond aux offres » doit rester dans ce cadre.**
- `scripts/audit-fonctions-api.cjs` : le plafond de 12 fonctions.
- `scripts/audit-bilan-semaine.cjs` (`--recopie`).
- Côté serveur, par vendeur :
  - `scripts/bancs/serveur.cjs`, `ship-multi.cjs` (2 vendeurs),
    `widget-multi.cjs`, `bilan-semaine.cjs` ;
  - `audit-fusion.cjs` (lire-fusionner-réécrire, lecture KO / écriture OK) ;
  - `audit-statuts.cjs` (`aExpedier`).
- Écrans : `scripts/bancs/ebay-annonces.cjs`, `ebay-programmer.cjs`,
  `ebay-regle-offre.cjs`, `ebay-comptes.cjs`, `ebay-form.cjs`, `ebay-write.cjs`,
  `ebay-api.cjs`, `ebay-callback.cjs`, `ebay-deletion.cjs`, `ebay.cjs`,
  `poste-sans-depart.cjs`, `postes.cjs`.
- Le cas **553** doit devenir un contrôle. Il n'existe nulle part. Les trois
  sources qu'il met en jeu :
  - une vente prouvée **par bordereau seul** (aucune ligne de transaction) ;
  - une annonce eBay créée **minutes après** la vente ;
  - aucune autre annonce Vinted de ce N°.

  ⇒ Attendu : l'annonce eBay est retirée (ou au moins signalée), et la
  publication est refusée.

### 5.5 Ce qu'il faudra fusionner avant de construire
La branche (multi-comptes + règle d'offre) et `main` (numérotation 013 côté
serveur, suppressions 5.166/5.167, 12,99 €) doivent être réunies **d'abord**.
- Toutes les specs sont écrites sur la forme multi-comptes (`ctx`, `jetonDe`,
  `ligneDe`).
- Le retrait de `main` lit le marqueur de numérotation avec la signature
  `owner` d'avant.
- Le conflit dans `handleRetirer` est certain.

---

## 6. Ce qui n'a pas été mesuré

- **L'état réel de l'annonce `128127336988` sur eBay maintenant.** VRM ne l'a pas
  relue depuis le 10 octobre à 20 h 29 UTC. Elle était alors active, à 120 €,
  avec 0 observateur.
- L'heure de la capture du dressing de `3175765377` juste avant 20 h 29 (seule la
  dernière capture est gardée).
- Si eBay garde ou pas les photos Vinted d'une annonce dans le temps (les liens
  portent une signature).
- Les durées réelles d'une synchro (aucun appel à eBay d'ici).
- Si eBay exige bien une signature numérique pour lire le solde d'un vendeur
  européen. C'est ce que dit la feuille de route ; ici, on mesure seulement
  qu'aucun solde n'a jamais été rangé.
