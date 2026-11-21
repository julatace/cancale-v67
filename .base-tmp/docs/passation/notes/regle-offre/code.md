# Règle d'offre eBay (« au-dessus du seuil, eBay accepte ») — carte du CODE

Branche lue : `worktree-wf_d62e1db4-b5c-1` (HEAD `0623451`, multi-comptes eBay),
dossier `/home/user/cancale-v67/.claude/worktrees/wf_d62e1db4-b5c-1`. **Rien n'a
été modifié** dans ce dossier (`git status` propre hors `node_modules`, lien
symbolique). Tous les chemins ci-dessous sont relatifs à ce dossier ; `W:` = ce
dossier.

Rappel de la décision : sur eBay, avec le réglage NATIF d'eBay (Best Offer :
`ListingDetails.BestOfferAutoAcceptPrice`, option `MinimumBestOfferPrice`),
posé sur l'annonce **sur son clic**. C'est eBay qui accepte. VRM n'appelle
jamais une route d'acceptation. Vinted et l'extension ne sont pas touchés.

---

## 0. En bref — où la fonction se branche

| couche | point d'entrée | modèle à copier |
|---|---|---|
| serveur | nouvelle entrée dans `ACTIONS` (`api/ebay.js:1202-1218`), JAMAIS un nouveau fichier `api/` (12/12) | `handleRevise` (`api/ebay.js:243-257`) pour les trois issues ; `handleSku` (`api/ebay.js:692-704`) et `handleReprogrammer` (`api/ebay.js:642-668`) pour un `ReviseFixedPriceItem` dans `<Item>` ; `handleDeprogrammer` (`api/ebay.js:615-639`) pour « relu chez eBay avant d'agir, relu après » |
| serveur, publication | `itemXml` (`api/ebay.js:277-317`), seul constructeur du `<Item>` d'AddFixedPriceItem / VerifyAddFixedPriceItem | la façon dont `scheduleTime`/`uuid` sont validés par la route puis émis (`avecSku` `api/ebay.js:379-387`) |
| app, annonce en ligne | `EbayAnnonceCard` (`src/App.jsx:10069-10284`) | le geste « ✏️ Modifier le prix / le stock » (`src/App.jsx:10159-10170`, rendu `10262-10277`) et « Faire une offre aux observateurs » (`envoyerOffre` `10114`, envoi `10129`, rendu `10230-10245`) |
| app, nouvelle annonce | `EbayPublier` (`src/App.jsx:9063-9587`) → `brouillonCourant` (`9205`) → `itemDeBrouillon` (`8889-8904`) | le champ Prix (`9537`) |
| app, brouillons/planificateur | `itemDeBrouillon` (une règle, §11) consommé par `EbayBrouillons` (`10290`, vérif `10315`) et `EbayPlanificateur` (`10408`, `pubverify` `10508`, `programmer` `10573`) | — |
| preuves | `scripts/audit-ebay-route.cjs` (route exécutée), `scripts/bancs/ebay-annonces.cjs` (rendu) | §3 ci-dessous |

---

## 1. Serveur — `api/ebay.js` et `api/_lib/ebay.js`

### 1.1 L'aiguillage et le compte de chaque action (multi-comptes)

- `handler` `api/ebay.js:1229-1234` : `?mode=deletion` / `?mode=callback` / sinon `handleApp`.
- `handleApp` `api/ebay.js:1111-1227` :
  - GET = santé (`1112-1115`) ; POST seul.
  - **Session obligatoire** `vendeurExige` (`1121-1122`) → `owner = u.id`.
  - `baseCloisonnee()` (`1131`) ; base non cloisonnée et vendeur ≠ `VRM_OWNER_UID` ⇒ 403 (`1132`).
  - abonnement coupé ⇒ 402 (`1137`, `accesVendeur`), « pas su » ne coupe pas.
  - `keysReady()` sinon 503 (`1140`).
  - actions SANS compte (gérées à la main) : `authurl` `1142`, `apptoken` `1155`, `exchange` `1160`, `status` `1165`, `deconnecter` `1186` (exige `confirme === true` AVANT tout, `1189`).
  - **Toutes les autres** passent par la table `ACTIONS` `1202-1218` : `sync, revise, pubinfo, pubverify, finances, publish, sku, offreinfo, offre, retirer, programmer, programmees, deprogrammer, reprogrammer, limites`. Action inconnue ⇒ 400 (`1219`).
  - Le compte : `resoudreCompte(b.compte, owner)` (`1220`) AVANT tout appel eBay, puis `ACTIONS[action]({ owner, compte: rc.compte })` (`1222`). Une exception ⇒ 502 « eBay injoignable » (`1224-1226`).
  - ⚠️ La confirmation (`confirme === true`) n'est PAS vérifiée par l'aiguillage : chaque handler la vérifie en PREMIÈRE ligne (`handleProgrammer:524`, `handleDeprogrammer:616`, `handleReprogrammer:643`, `handleOffre:747`, `handleRetirer:809`). Une nouvelle action qui engage doit faire pareil, avant `jetonDe`.
- `resoudreCompte` `api/_lib/ebay.js:350-366` : `compte` absent ⇒ principal (`{cle:'', suffixe:''}`) ; clé mal formée (`/^[0-9a-f]{16}$/`) ⇒ 400 ; base non cloisonnée + clé ⇒ 404 ; registre illisible ⇒ 503 ; clé inconnue ⇒ 404 ; compte déconnecté ⇒ 409. Rend `{cle, pseudo, principal, suffixe}`.
- Le contexte : `jetonDe(ctx)` = `accessToken(ctx.owner, ctx.compte.suffixe)` (`api/ebay.js:32`) ; `ligneDe(base, ctx)` = `base + suffixe` (`33`) ; `nomCompte(c)` (`34`).
- `accessToken` `api/_lib/ebay.js:411-430` : trois états via `lireRefresh` (`386-401`) ; 503 base, 401 non relié, `refresh-failed` sinon. Aucun `scope=` au refresh (`418-422`).
- `comptesActifs` `api/_lib/ebay.js:208-214`, `suffixeCompte` `143`, registre `ebay_comptes` (`139`, `lireComptes 175`, `modifierComptes 197-203` : lecture ratée ⇒ rien écrit).
- Côté app, le corps porte le compte par `corpsCompteEbay(ref)` (`src/App.jsx:8938`) : `{}` pour le principal, `{compte: clé}` sinon. Une annonce lue porte `_compte` / `_pseudo` (`marquerEbay` `src/App.jsx:9004`) : un geste sur une carte envoie `...corpsCompteEbay(it._compte)` (ex. `revise` `10166`, `sku` `10107`, `offre` `10129`, `retirer` `11232`).

### 1.2 `tradingCall`, erreurs, « incertain »

- `tradingCall(token, callName, inner)` `api/ebay.js:127-146` : POST `https://api.ebay.com/ws/api.dll`, en-têtes `X-EBAY-API-CALL-NAME`, `SITEID 71`, `COMPATIBILITY-LEVEL 1149`, `X-EBAY-API-IAF-TOKEN` ; corps `<?xml…><{call}Request xmlns="urn:ebay:apis:eBLBaseComponents">{inner}</{call}Request>`. Rend `{status, ok, ack, err, erreurs, avertissements, xml}` ; réseau ⇒ `{status:0, ok:false}` (`145`). `ok` = HTTP ok ET `Ack` Success|Warning (`137`).
- `erreursTrading` `103-120` : TOUTES les `<Errors>` `{code, severite, message, params}` ; `err` = première de sévérité Error (`139-140`).
- `sansAck(r)` `api/ebay.js:80` : `!r || r.status === 0 || !r.ack` ⇒ « incertain » (504, `reason:'incertain'`), jamais « refusé ».
- `messageEbaySur` `86-89` : nettoie tout ce qui ressemble à un jeton, 300 car. ; `ID_EBAY = /^\d{1,19}$/` (`83`) ; `esc` (`264`) ; `dexml` (`92-93`) ; `lireBalise(xml, t)` (`318`).
- ⚠️ Incohérence existante à NE PAS recopier : `handleSku` (`701`) teste `r.status === 0` au lieu de `sansAck(r)` — un 503 HTML après pose du SKU sortirait « eBay a refusé ». La nouvelle action doit utiliser `sansAck` comme `handleRevise` (`250`).

### 1.3 `itemXml` — publication, vérification à blanc, programmation

- `itemXml(it)` `api/ebay.js:277-317` : UN `<Item>` pour `AddFixedPriceItem` (`tradingAddFixedPriceItem` `319-322`) ET `VerifyAddFixedPriceItem` (`tradingVerifyAddFixedPriceItem` `367-371`, qui force `uuid:''`). Éléments émis, dans cet ordre : `Title`, `SKU` (si posé), `Description`, `PrimaryCategory`, `StartPrice` (`toFixed(2)`, **sans `currencyID`**), `Quantity`, `ListingType FixedPriceItem`, `ListingDuration GTC`, `ScheduleTime` (si validé), `Currency EUR`, `Country FR`, `Location`, `ConditionID` (défaut 3000), `PictureDetails`, `ItemSpecifics`, `DispatchTimeMax`, `ShippingDetails` (seulement si `!ebayGere`), `ReturnPolicy`, `UUID` (ajout seulement).
- **Aucun `BestOfferDetails` ni `ListingDetails` aujourd'hui** (grep `BestOffer` : 0 occurrence dans `api/` et `src/`).
- `itemXml` ne lit QUE des champs nommés : un champ glissé dans `item` par le navigateur ne part pas tant qu'`itemXml` ne le lit pas. `avecSku` `379-387` recopie `...it` puis efface `scheduleTime`/`uuid` (seule la route les pose) et pose `sku` depuis `numero`. ⇒ Un seuil ajouté à `itemXml` doit être **validé par la route** (nombre > 0, deux décimales, strictement < prix, minimum < seuil) et injecté par elle, comme `scheduleTime` (`handleVerify:494-496`, `handleProgrammer:534-538`), jamais émis brut depuis `it`.
- Les trois chemins qui construisent un `<Item>` : `handlePublish` `432-454` (garde « une paire, une annonce » `dejaChezEbay` `447-450`, pas de `confirme`) ; `handleVerify` `485-503` (200 `ok:false` = « eBay refuserait ») ; `handleProgrammer` `523-565` (confirme, N°, état, UUID, frais vus ⇒ relecture → vérif sans UUID → ajout avec UUID).
- ⚠️ L'audit exige que vérif et ajout envoient le **même `<Item>` à l'UUID près** (`scripts/audit-ebay-route.cjs:820-821`) : un seuil émis dans l'un doit l'être dans l'autre — c'est automatique s'il passe par `itemXml`.

### 1.4 `handleRevise` (le modèle des trois issues) et les autres `Revise*`

- `tradingReviseInventoryStatus` `api/ebay.js:236-241` : `ReviseInventoryStatus` (`<InventoryStatus><ItemID/><StartPrice/><Quantity/>`). Ne sait PAS toucher Best Offer.
- `handleRevise(b, ctx)` `243-257` : `itemId` `/^\d+$/` sinon 400 ; rien à modifier ⇒ 400 ; `jetonDe` ; `sansAck` ⇒ **504 `incertain`** ; `!r.ok` ⇒ 422 (`err` d'eBay) ; sinon 200. Pas de `confirme`, pas de relecture.
- `ReviseFixedPriceItem` existe déjà deux fois, dans `<Item>` :
  - `handleSku` `692-704` : `<Item><ItemID/><SKU/></Item>`, pas de confirmation.
  - `handleReprogrammer` `642-668` : `confirme` d'abord ; heure validée ; relecture `listeVendeur` (doit être dans `L.programmees`) ; `<Item><ItemID/><ScheduleTime/></Item>` ; `sansAck` ⇒ 504 ; relecture après (`verifie: true|false|null`).
- `handleDeprogrammer` `615-639` : le meilleur modèle de « l'annonce doit être À CE COMPTE » — `listeVendeur(at.token)` puis `L.programmees.some(itemId)` avant d'agir, relecture après.
- Pour un seuil sur une annonce EN LIGNE, `listeVendeur` (`195-214`, `GetMyeBaySelling` ActiveList+ScheduledList, 5 pages × 200, `complet`) rend déjà `actives[].price` (`extraireItem:160`, `CurrentPrice || BuyItNowPrice || StartPrice`) : de quoi vérifier « seuil < prix lu chez eBay maintenant » ET « l'annonce est bien sur ce compte », sans faire confiance au prix envoyé par l'écran.

### 1.5 Lire l'état : ce qu'eBay renvoie aujourd'hui, ce qui est rangé

- `extraireItem(blk)` `api/ebay.js:148-176` (une annonce de `GetMyeBaySelling`) rend `{itemId, title, price, qty, vendus, vues, observateurs, sku, photo, depuis, fin, url}`. Rien sur Best Offer.
- `tradingGetItem(token, itemId)` `216-233` (`DetailLevel ReturnAll` + `IncludeItemSpecifics`) rend `{description, categoryId, categoryName, condition, photos, specifics}`. Rien sur Best Offer non plus. C'est ici qu'il faudrait lire `BestOfferDetails/BestOfferEnabled`, `ListingDetails/BestOfferAutoAcceptPrice`, `ListingDetails/MinimumBestOfferPrice` (noms documentés, **non mesurés** sur son compte).
- `handleSync(ctx)` `947-1001` : `Promise.all` commandes + inventaire + `listeVendeur` ; **GetItem borné à 20 annonces** (`967`, `lst.slice(0, 20)`) ⇒ au-delà de 20, le seuil d'une annonce serait « pas su », jamais « aucun ». Écrit SEULEMENT si la source a répondu (`981-986`) : `ebay_listings{suffixe}` = `{items, ack, status, complet, capturedAt}` ; `ebay_programmees{suffixe}` ; `ebay_orders{suffixe}` ; `ebay_inventory{suffixe}`. Réponse `lu:{annonces, programmees, commandes, stock}` (`995`).
- **Forme MESURÉE sur sa base** (9 octobre, lecture seule, projetée) : une seule ligne par famille — `ebay_listings`, `ebay_orders`, `ebay_inventory` (pas de `ebay_comptes`, pas de `ebay_programmees`, pas de `ebay_brouillons`, aucune ligne suffixée : un seul compte, principal implicite). `ebay_listings.data` = `{ack, capturedAt, items, status}`, **2 annonces**, captées le 2026-10-08 17:20 UTC, clés de chaque item = `depuis, detail, itemId, observateurs, photo, price, qty, sku, title, url, vendus, vues` (pas de `fin` : capture antérieure à ce champ), `detail` = `categoryId, categoryName, condition, description, photos, specifics`. **Aucune des deux n'a de SKU**, prix 68.0 et 74.0. Dans `main` : aucune clé `*ebay*` (retrait automatique jamais allumé), `vinted_offres_auto = "false"`, `vinted_buyprice_by_num` = 1 entrée, et sur 401 fiches `vinted_annonce_numeros`, **8 seulement** portent un `buyPrice`.

### 1.6 Écritures en base gardées (« rien lu ne vaut pas rien »)

- `storeData(id, data, owner)` `api/_lib/ebay.js:432-434` → `ecrireLignes` `106-118` (vrai seulement si écrit ; `portee` `94-104` : base cloisonnée ⇒ `owner=eq.` + cible `owner,id`).
- `lireDonnee(id, owner)` `452-463` : `undefined` pas su · `null` absente · `data`.
- `lireReglageVendeur(cle, owner)` `439-450` : un scalaire de `main` (`select=v:data->>{cle}`), trois états — c'est ainsi que la route relit `vrm_ebay_retrait_auto` (`api/ebay.js:816`).
- `sortirDesAnnonces(itemId, ctx)` `api/ebay.js:801-807` : lire-fusionner-réécrire GARDÉ de `ebay_listings{suffixe}` (`undefined` ou pas de liste ⇒ `null`, rien écrit). Modèle direct pour « mettre à jour le seuil de CETTE annonce dans la liste rangée » après un succès, sans attendre une synchro.
- `handleRetirer` `808-857` : journal `ebay_retraits_auto{suffixe}` écrit seulement sur lecture réussie (`843-850`) — modèle si l'on veut garder trace de ce qui a été posé en son nom.

### 1.7 Anti double vente sur tous les comptes (à ne pas casser)

- `comptesAVerifier` `api/ebay.js:395-415`, `dejaChezEbay` `416-431` : relit chaque compte actif chez eBay (SKU canonique `memePaire` `74`). Utilisé par `publish` et `programmer`. Une action « seuil » sur une annonce existante n'en a pas besoin (elle ne crée rien) ; une publication avec seuil passe par `publish` qui l'a déjà.

### 1.8 Squelette de l'action (à valider, rien n'est écrit)

Nom d'exemple : `seuiloffre`. Entrée dans `ACTIONS` (`api/ebay.js:1202`). Ordre, toutes les gardes AVANT eBay :
1. `b.confirme !== true` ⇒ 400 `reason:'confirmation'` (fixer un seuil vend la paire sans lui demander : ça engage, comme `offre`).
2. `ID_EBAY.test(itemId)` sinon 400 « annonce eBay invalide » (l'audit a une boucle d'identifiants `scripts/audit-ebay-route.cjs:561-569`).
3. seuil : nombre fini, > 0, deux décimales ; option plancher : < seuil ; `null`/`''` = retirer le seuil.
4. `jetonDe(ctx)` ; `listeVendeur(at.token)` : pas `ok` ⇒ 503 `pas-su` ; annonce absente de `actives` (et de `programmees`, si on l'autorise) ⇒ 409 ; prix lu chez eBay ⇒ seuil ≥ prix ⇒ 409 (eBay le refuserait — non mesuré).
5. `tradingCall(token, 'ReviseFixedPriceItem', '<Item><ItemID>…</ItemID><BestOfferDetails><BestOfferEnabled>true</BestOfferEnabled></BestOfferDetails><ListingDetails><BestOfferAutoAcceptPrice currencyID="EUR">…</BestOfferAutoAcceptPrice>…</ListingDetails></Item>')` ; retrait : `<DeletedField>Item.ListingDetails.BestOfferAutoAcceptPrice</DeletedField>` (hors `<Item>`).
6. `sansAck` ⇒ 504 `incertain` ; `!ok` ⇒ 422 avec `r.err` (le message d'eBay) ; sinon relecture `GetItem` et rendre le seuil QU'eBAY TIENT (`verifie: true|false|null`), puis mise à jour gardée de la ligne rangée (modèle `sortirDesAnnonces`).

---

## 2. App — `src/App.jsx`

### 2.1 `EbayAnnonceCard` (`10069-10284`)

- Props : `it, first, onSaved, numero, eligible, paires, numsConnus, titreDeNum, pris, onSku, onOffre, compteNom` (`10069`). Peau `E = EBAY_SKIN` (`10070`).
- Ligne résumé `10182-10200` : pastille `data-relie` (N° ou « pas reliée », `10190`), observateurs, photos, âge, compte (`data-ebay-carte-compte` `10194`, seulement si la liste mélange plusieurs comptes). Prix à droite `10198`.
- Gestes visibles sans déplier `10204-10209` : « Relier à une paire » (si pas de N°) et « Faire une offre aux observateurs » (si `eligible === true`).
- Panneau « Relier » `10210-10229` ; panneau offre `10230-10245` (remise %, prix résultant `prixRemise` `10084`, message ; `envoyerOffre` `10114` : confirmation `askConfirm` `10119-10123`, envoi `{action:'offre', listingId, remise, confirme:true, ...corpsCompteEbay(it._compte)}` `10129`). Résultat dit sur la carte (`info`, `data-ebay-info` `10247`).
- Détail déplié `10247-10281` : état/catégorie, `specifics`, description, puis « ✏️ Modifier le prix / le stock » → `enregistrer` `10163-10170` = `resultatReviseEbay(await appelEbay({action:'revise', itemId, price, quantity, ...corpsCompteEbay(it._compte)}))`, trois issues ; « Changer la paire reliée » `10267` ; « Voir sur eBay ↗ ».
- ⚠️ §7 : le message « ✓ Modifié sur eBay » est coloré `INV_STATUS.online.color` (`10278`) = `#0F8A6A` (`src/App.jsx:18196`), un vert hors `EBAY_SKIN`. Ne pas recopier : la peau eBay n'a qu'un accent `#3665F3` (`EBAY_SKIN`, `src/App.jsx:8636-8640` : `bg #000000, card #1C1C1E, card2 #2C2C2E, border #3A3A3C, text #FFFFFF, muted #8E8E93, accent #3665F3, accentSoft #5B86FF, warn #FFB340, danger #FF453A`).
- Ce que la carte ne reçoit PAS aujourd'hui : le prix d'achat de la paire, ni un seuil. Il faudrait les calculer dans `EbayAnnonces` et les passer en props (comme `numero`).

### 2.2 `EbayAnnonces` — la liste eBay → Annonces (`10966-11531`)

- États (trois états partout) : `items` (`10973`), `commandes`, `vendusVinted`, `eligibles` (`10979`), `retraitAuto` (`10985`), `brouillons`, `programmees` (`11008-11009`)…
- Lectures : `charger` `11045-11061` = `lireEbayTous('ebay_listings', 'items:data->items', 'items', comptesEbay)` (projection §4.4) + `ebay_orders` ; un compte illisible est NOMMÉ (`illisiblesAnnonces`), tous illisibles ⇒ `null`. `status` `11067-11075` (comptes reliés). `chargerEligibles` `11080-11093` (`offreinfo` compte par compte). `resync(ref)` `11141-11145` (`sync` puis relire).
  - ⚠️ Projection : si un seuil est rangé DANS chaque item de `ebay_listings.items`, il arrive tel quel (`items:data->items`). S'il est rangé ailleurs, il faut l'ajouter au `select`.
- `fiches` `11147` = `load('vinted_annonce_numeros')` (fiches par id d'annonce Vinted : `numero`, `title`, `buyPrice`…) ; `numsConnus` `11200`, `titreDeNum` `11201` (N° → titre), `pris` `11202` (N° → itemId eBay), `dejaSurEbay` `11207`.
- Vue (sélecteur) : `plusieursComptes`/`vueSeule`/`dansVue` `11247-11250` ; `comptesPub`/`compteDefautPub` `11255-11261`.
- Au-dessus de la liste, UNE phrase par sujet (§7) : `data-ebay-sans-observateur` `11508`, `data-ebay-non-reliees` `11513`. C'est là qu'une phrase « comment marche la règle d'offre » se dirait une fois ; sur la carte, seulement une pastille qui distingue.
- Rendu des cartes `11517-11528` : `<EbayAnnonceCard it={it} … numero={numDeSkuEbay(it.sku)} eligible={…} paires numsConnus titreDeNum pris onSku onOffre />`.
- Bloc « Retrait automatique d'eBay » `11432-11447` (`data-ebay-retrait-auto`, bouton `basculerRetraitAuto` `10994-11003` : allumer = `askConfirm`, éteindre = direct, `save('vrm_ebay_retrait_auto', …)`), le journal de ce qui est parti en son nom `11442-11446`. C'est l'exemple existant de « réglage + ce qui a été fait en ton nom, relisible ».
- Ordre de déclaration (§4.6) : tout `useMemo` neuf qui lit `fiches`, `items`, `pris` doit être posé APRÈS `11202` (et après `ventesConnues`/`dv` s'il les lit).

### 2.3 `EbayPublier` — le formulaire de mise en vente (`9063-9587`)

- Compte de publication : `comptePub` / `plusieursPub` / `nomComptePub` `9068-9072`.
- Champs : `titre, prix (9080), qty, cond, desc, photos, cat, asp` ; `pairSel` ; rendu en `BlocEbay` (`8642-8653`). Bloc « 4 — Prix & livraison » `9535-9553`, champ Prix `9537` (`onChange` remet `setCheck(null)` : tout nouveau champ qui change l'annonce doit faire pareil).
- `brouillonCourant()` `9205-9216` → `buildItem()` `9219` = `itemDeBrouillon(brouillonCourant())`. Un nouveau champ « seuil » doit entrer dans `brouillonCourant` ET dans `itemDeBrouillon` (sinon vérifié ≠ publié).
- `enregistrerBrouillon` `9223-9244` (relire-fusionner-écrire `modifierBrouillonsEbay`, refuse de réécrire un brouillon déjà parti) ; réouverture d'un brouillon `9245-9270` (remettre le champ seuil depuis `d`).
- `verifier` `9274-9285` : `pubverify` + `...corpsCompteEbay(comptePub)` ; affichage `data-publier-frais` `9563`.
- `gardePublier` `9294-9316` (vendue partout, pas su, déjà en vente/programmée, plus en vente sur Vinted) ; `publier` `9317-9342` : `askConfirm` seulement si plusieurs comptes (`9321-9328`) — avec un seuil, la confirmation devrait le dire (ça vend sans lui demander) ; `appelEbay({action:'publish', item, ...corpsCompteEbay(comptePub)})` `9332` ; trois issues `9333-9339`.
- Boutons : « Vérifier sans publier » `9568`, « Publier sur eBay » `data-publier-ebay="1"` `9569`, « Enregistrer en brouillon » `data-publier-brouillon` `9576`.

### 2.4 Brouillons et planificateur

- `lireBrouillonsEbay` `8855-8864`, `modifierBrouillonsEbay(changer)` `8865-8880` (ligne dédiée `ebay_brouillons`, lecture ratée ⇒ rien écrit, `false` = rien à écrire), `idBrouillonEbay` `8881`, `uuidEnvoiEbay` `8884`.
- `itemDeBrouillon(d)` `8889-8904` — LA règle brouillon → `item` (§11) : catégorie, requis, photos, prix, `numero` si SKU lisible ; rend `{item:{title, categoryId, price, quantity, conditionId, description, photos, aspects, ebayGere:true, numero?}}`. Un seuil s'ajoute ICI (et sa validation, une seule fonction partagée avec la carte).
- `cleVerifEbay(item, utc)` `8906` : la clé de vérification est l'`item` entier ⇒ changer le seuil invalide la vérif (voulu).
- `EbayBrouillons` `10290-…` : liste `10298`, « Vérifier la sélection » `verifierSelection` `10315` (`pubverify` par brouillon).
- `EbayPlanificateur` `10408-…` : `rythme` (`vrm_ebay_rythme`) `10418-10424`, appel `limites` `10446`, SKU déjà en ligne `10454`, analyse du lot `10458-…` (`itemDeBrouillon` dans `analyse`), vérif `pubverify` `10508`, UUID rangé avant l'envoi `10564-10570`, envoi `{action:'programmer', confirme:true, uuid, fraisVus, scheduleTime, item: l.item, ...corpsCompteEbay(compteLot)}` `10573`. Le seuil suivrait `l.item` sans autre changement.
- `EbayProgrammees` `10823`, `programmeesConnues` `10809`, `brouillonEncoreAttendu` `10797`.

### 2.5 La baisse de prix eBay (assistant des paires qui dorment, dans `Comptabilite`)

- `repriceList` (calcul Vinted, plancher = prix d'achat) `src/App.jsx:22278-22302`.
- `ebayVivantes` `22319` (lu à l'ouverture du panneau, `lireEbayTous('ebay_listings', 'items:data->items,cap:data->>capturedAt', 'items')` `22340`, SKU → `{itemId, prix, titre, url, compte}`, deux annonces pour un N° ⇒ `ambigu` `22350`).
- `fichesParNum` `22330` (un N° porté par plusieurs fiches ⇒ ambigu).
- `baisseEbayDe(r)` `22360-22386` (même proportion que Vinted, jamais sous le prix d'achat `prixAchatDe` `22382`, mémo `vrm_ebay_baisses`) ; `baisserSurEbay` `22388-22410` (`askConfirm` puis `revise` + `resultatReviseEbay`). Rendu `27722`.
- ⚠️ Interaction avec un seuil : baisser le prix à ou sous le seuil d'acceptation — eBay le refuserait (contrainte documentée « le prix d'acceptation doit être inférieur au prix », **non mesurée**). `resultatReviseEbay` affichera le message d'eBay (`src/App.jsx:9034-9040`) ; mieux : la baisse connaît le seuil (s'il est rangé) et le dit avant d'envoyer, ou propose d'abaisser le seuil dans le même geste (à trancher). Même remarque pour « Modifier le prix » de la carte.

### 2.6 Le sélecteur de compte eBay

- `ListeComptes` `src/App.jsx:19438-19453` (une seule forme, partagée avec Vinted `SelecteurCompte` `19410`).
- La vue : `ebayVue` / `setEbayVue` / `ebayVueEff` `35081-35085` (`vrm_ebay_vue` synchronisé, rattrapé par `onCloudReady` seulement s'il est resté à `'*'`). Rendu de l'onglet eBay `36561-36592` ; sélecteur `36585-36588` (seulement à partir de deux comptes) ; `EbayAnnonces` reçoit `vue`/`comptesEbay` `36591`.
- Helpers : `CLE_COMPTE_EBAY` `8930`, `suffixeCompteEbay` `8933` (comparé au serveur par l'audit), `refCompteEbay`, `corpsCompteEbay` `8938`, `comptesEbayActifs` `8941`, `nomCompteEbay` `8950`, `lireComptesEbay` `8955`, `useComptesEbay` `8972`, `lireEbayParCompte` `8988`, `lireEbayTous` `9008`, `dansVueEbay` `9026`.
- Règle : le sélecteur ne change que ce qu'on VOIT ; un geste sur une annonce part TOUJOURS sur le compte de l'annonce (`it._compte`), jamais sur la vue.

### 2.7 Le prix d'achat d'une paire par son N° (SKU `VRM-{n°}`)

- `numDeSkuEbay(sku)` `src/App.jsx:30834-30840` (lecture STRICTE, « VRM-030 » = 30, « 12345-ABC » = rien), `skuEbayDe` `30841` ; côté serveur `numDeSku` `api/ebay.js:73`, `cleNum` `60-64` (comparés par l'audit `scripts/audit-ebay-route.cjs:326-336`, contrôles `583-606`).
- `prixAchatDe(fiche, buyByNum)` `src/App.jsx:9047-9055` : `fiche.buyPrice`, sinon `vinted_buyprice_by_num[numero]` ; rend un nombre ou `null` (jamais un plancher inventé).
- Chemin SKU → prix d'achat : `numDeSkuEbay(it.sku)` → N° → la/les fiche(s) de `fiches` (`11147`) dont `cleNum(f.numero)` = N° → `prixAchatDe(fiche, load('vinted_buyprice_by_num', {}))`. `buyByNum` n'est PAS chargé dans `EbayAnnonces` aujourd'hui. Un N° porté par plusieurs fiches est ambigu (`fichesParNum`, `22330`) : ne rien proposer.
- Mesuré : 8 fiches sur 401 portent un prix d'achat, 1 entrée par N° ; ses 2 annonces eBay n'ont pas de SKU. Une suggestion « seuil ≥ prix d'achat » ne s'appliquera presque nulle part aujourd'hui : afficher « — » plutôt qu'un plancher inventé.

### 2.8 Le réglage du retrait automatique (`vrm_ebay_retrait_auto`) — le modèle d'un réglage eBay

- Synchronisé : `SYNC_KEYS` `src/App.jsx:871`, entrée `884` (aussi `vrm_ebay_baisses` 887, `vrm_ebay_rythme` 895, `vrm_ebay_vue` 896, `vrm_ebay_compte_pub` 897).
- Lu au montage + `onCloudReady` `10985-10986` ; bascule `10994-11003` ; affichage `11432-11447` ; raison commune / par paire `11384-11411` (`RAISON_RETRAIT_AUTO` `30936`, `CONDITIONS_RETRAIT_AUTO` `30935`).
- La coque l'exécute à l'ouverture : `passageRetraitEbayAuto` `30961` appelé `35822-35830` (`continuer: () => … load('vrm_ebay_retrait_auto') === true`) ; la route le RELIT dans `main` (`api/ebay.js:816-818`).
- Pour une règle d'offre, ce modèle ne sert que si l'on veut un réglage GLOBAL (ex. « par défaut, 90 % du prix ») : il serait synchronisé (SYNC_KEYS + `onCloudReady`, remplacé seulement s'il est resté au défaut), et le seuil resterait posé annonce par annonce, sur son clic. Aucune passe en arrière-plan ne doit poser un seuil.

---

## 3. Les preuves à étendre

### 3.1 `scripts/audit-ebay-route.cjs` (1 293 lignes, la route EXÉCUTÉE)

- Lancement : `node scripts/audit-ebay-route.cjs` (depuis la racine du dossier) ; `--src <dossier>` pour la preuve §6.1 sur un autre arbre (`59-60`) ; il relance lui-même un processus `--non-cloisonnee` (`1280-1288`).
- Environnement : `J`, `B`, `C` (`67-69`), JWT factices (`71`), variables d'env `73-77`.
- **Fausse base** : `lignes` `(owner,id,data)` (`86-87`), honore `owner=eq.` et `select=` (`projette` `89-101`) ; écritures enregistrées dans `journal` (`ou:'base'`) et appliquées (`278-287`) ; lectures `288-298` ; pannes ligne par ligne `mode.mainKo / journalKo / listingsKo / comptesKo` (`293-296`).
- **Faux eBay, un compte par jeton** : `ebay['at-J'|'at-B'|'at-A2'|'at-A3'] = {actives, programmees}` (`remettreEbay` `111`), identités GetUser (`116`) ; `itemFake` (`119`) émet `ItemID, Title, SKU, WatchCount, QuantityAvailable, Variations, CurrentPrice, StartTime, EndTime, ViewItemURL` ; `repListe` (`120-133`). Dans `global.fetch` (`149-300`) : jetons `oauth2/token` (`165-181`), Trading `182-252` dont `GetUser` (`184-188`), `GetMyeBaySelling` (`189-193`), `GetItem` (`194-199` — rend ItemID/SKU/Description/StartTime, **pas le prix**), `VerifyAddFixedPriceItem` (`200-208`), `AddFixedPriceItem` (`209-231`), `EndFixedPriceItem` (`232-239`), `ReviseFixedPriceItem` (`240-248` — n'applique que `ScheduleTime`), autres appels Trading (`249-251`) ; négociation `find_eligible_items` / `send_offer_to_interested_buyers` (`259-267`).
- Modes : `remettre()` `142` (`liste, trading, revise, getitem, add, end…`) ; `mode.trading = 'reseau' | 'refus'` sert à tous les appels non spécialisés.
- Outils de jugement : `app(jwt, corps)` `342-347` (rend `{code, corps, journal}`), `chezEbay` `359`, `auCompte` (sans le renouvellement de jeton) `362`, `appels(j)` `363`, `sansJeton` `365`, `ecrit(j, id)` (dernière ligne écrite) `366-370`. Règles de l'app extraites et exécutées (`cleNum`, `numDeSkuEbay`, `skuEbayDe`, `suffixeCompteEbay`) `326-336`.
- **Ajouter une action** (ex. `seuiloffre`) :
  1. la liste `TOUTES` `411` (sans session ⇒ 401, zéro appel eBay) ;
  2. la boucle de confirmation `540-552` (sans `confirme:true`, ou `'true'`, ou `1` ⇒ 400 `confirmation`, zéro appel) ;
  3. la boucle d'identifiants `561-569` ;
  4. le faux `ReviseFixedPriceItem` (`240-248`) doit ENREGISTRER `BestOfferAutoAcceptPrice` / `DeletedField` sur l'annonce, et `GetItem`/`itemFake` doivent le RENDRE (sinon le contrôle « ce qu'eBay tient après » est vert sur un code qui n'écrit rien — §6.3) ; ajouter un mode `seuil: 'refus-prix'` qui rend l'erreur d'eBay « prix d'acceptation ≥ prix » ;
  5. les blocs multi-comptes : `1183-1198` (« chaque action part sur SON compte », jeton `at-A2`) et `1199-1214` (B désigne le compte de Julien ⇒ 404/403, zéro appel) ;
  6. publication/programmation : le seuil doit être dans le `<Item>` de la vérif ET de l'ajout (contrôle d'égalité `820-821` déjà en place), jamais recopié brut du navigateur (modèle `614-620`), et refusé (400, zéro appel) quand il est ≥ prix ;
  7. **réaffaiblir pour prouver** (§6.1) : retirer la garde `confirme`, accepter un seuil ≥ prix, oublier `sansAck` — chaque mutation doit faire passer au rouge.
- Résultat aujourd'hui (lancé le 9 octobre, lecture seule) : **230 contrôles, 0 rouge**.

### 3.2 `scripts/bancs/ebay-write.cjs` (118 lignes, route exécutée, sans navigateur ni port)

- Faux `fetch` minimal (`14-48`) : `lastCall`/`lastBody` du dernier appel Trading (`11`) ; `tradingMode = 'ok'|'fail'|'deuxErreurs'|'sansTotal'`. Juge l'appel ET le corps (`/<StartPrice>72\.00<\/StartPrice>/` `78`). Bon endroit pour « le seuil part en `<BestOfferAutoAcceptPrice currencyID="EUR">` dans `ReviseFixedPriceItem` » et « un refus d'eBay remonte avec son message ».
- `node scripts/bancs/ebay-write.cjs` : vert aujourd'hui.

### 3.3 Les bancs de RENDU (Chromium, données inventées, `dist/` du dossier)

Tous : `require('/home/user/cancale-v67/node_modules/playwright')`, Chromium `/opt/pw-browsers/chromium-1194/chrome-linux/chrome` (`--use-angle=swiftshader --no-sandbox`), `DIST = path.join(__dirname,'..','..','dist')`, deux tailles 390 et 1512 px, `metaVersData` (`_meta.cjs`), fausse PostgREST avec `projette` et écritures GARDÉES, `/api/ebay` intercepté (route enregistrée APRÈS le fourre-tout `**/api/**`, §6.6), jugement sur les `data-*` et sur le CORPS envoyé (`envois`), `feuille(pg)` = la feuille de confirmation (`div[style*="z-index: 2000"]`).

| banc | port | ce qu'il sert / juge | où brancher le seuil |
|---|---|---|---|
| `scripts/bancs/ebay-annonces.cjs` (494 l.) | 4711 | annonces `EBAY_ANNONCES` (`67-73`, avec `price`, `sku`, `observateurs`, `depuis`), fiches `MAIN` (`49-56`), ventes Vinted ; `ouvrir()` `162-221`, faux `/api/ebay` `194-220` (`envois` filtré `199` : `offre, retirer, sku, publish, deprogrammer`) ; `versAnnoncesEbay` `222-229` ; `lire()` `231-248` (`data-relie`, `data-offre-ouvrir`…) ; offre : Annuler n'envoie rien, Oui envoie le corps exact (`292-306`) | ajouter l'action à `envois` (`199`) et sa réponse ; poser `data-*` sur la carte (seuil affiché, bouton, panneau) ; exiger : Annuler n'envoie RIEN, Oui envoie `{action, itemId, seuil, confirme:true}` + le compte ; seuil ≥ prix n'envoie rien ; une annonce SANS seuil connu ne dit pas « aucun seuil » quand ce n'est pas lu |
| `scripts/bancs/ebay-programmer.cjs` (679 l.) | 4721 | horloge figée mardi 20 oct. 2026 10:00 Paris, navigateur à New York (`186-192`) ; brouillons ; faux `/api/ebay` `226-262` qui pousse TOUT dans `envois` (`231`) ; contrôles sur `e.item.numero`, `confirme`, `fraisVus` (`420`) | vérifier qu'un brouillon avec seuil le garde à l'enregistrement, et que `pubverify` ET `programmer` portent le même `item.seuil…` |
| `scripts/bancs/ebay-comptes.cjs` (319 l.) | 4812 | trois comptes inventés, lignes suffixées, registre `ebay_comptes` (`50`), `envois` filtré `134` (`publish, deconnecter, programmer, retirer`) | le seuil d'une annonce du compte 2 part avec `compte: K2`, jamais celui de la vue |
| `scripts/bancs/ebay-form.cjs` (189 l.) | 4331 | le formulaire `EbayPublier` (paires 401/402), `pubinfo`/`pubverify` simulés (`45-64`) ; il compte les `[data-poster="ebay"]` | le champ seuil du formulaire, son effet sur « Vérifier » |
| `scripts/bancs/ebay-api.cjs`, `ebay-callback.cjs`, `ebay-deletion.cjs` | — | route exécutée (OAuth) | non concernés |

Commandes (depuis `W:`) :
```
node scripts/audit-ebay-route.cjs
node scripts/bancs/ebay-write.cjs
node scripts/audit-offres-auto.cjs
node scripts/audit-fonctions-api.cjs
node scripts/audit-tdz.cjs
node scripts/audit-ebay-retrait-auto.cjs
node scripts/audit-ebay-deja-vendue.cjs
npm run build        # ⚠️ jamais pendant qu'un banc sert dist/ (une autre passe travaille dans ce dossier)
node scripts/bancs/ebay-annonces.cjs     # 4711
node scripts/bancs/ebay-programmer.cjs   # 4721
node scripts/bancs/ebay-comptes.cjs      # 4812
node scripts/bancs/ebay-form.cjs         # 4331
```
Lancés le 9 octobre (lecture seule, sans `npm run build` ni port, pour ne pas gêner la passe en cours) : `audit-ebay-route` 230/0, `ebay-write` vert, `audit-offres-auto` 12/0, `audit-fonctions-api` 12/12, `audit-tdz` vert, `audit-ebay-retrait-auto` vert, `audit-ebay-deja-vendue` vert. Les bancs de rendu n'ont PAS été lancés.

---

## 4. Ce qui contraint la fonction

### 4.1 12 fonctions `api/` — `scripts/audit-fonctions-api.cjs`
`api/` compte **12** fichiers (plafond 12, `PLAFOND` ligne 10). Toute nouvelle route = une ACTION de `api/ebay.js` (ou un `?mode=` + réécriture `vercel.json`). L'audit vérifie aussi que chaque réécriture vise une route existante (`17-25`).

### 4.2 §4.6 TDZ — `scripts/audit-tdz.cjs`
Suit la liaison Babel de tout identifiant lu AU RENDU (`useMemo`, `useState(() => …)`, dépendances, `.map` immédiat). Dans `EbayAnnonces`, un memo « seuil par annonce » qui lit `fiches` (`11147`), `items`, `pris` (`11202`) ou `buyByNum` doit être déclaré après eux. `EbayAnnonceCard` est un composant séparé : y ajouter des props ne crée pas de TDZ.

### 4.3 §7
- UNE couleur d'accent : dans l'onglet eBay c'est `EBAY_SKIN.accent` (`#3665F3`) ; `warn` pour ce qui demande un geste ; pas de vert (`INV_STATUS.online.color` `10278` est un écart existant, ne pas le recopier), pas de rouge (réservé aux deux paires sous un N°).
- UNE phrase une fois : l'explication de la règle (« c'est eBay qui accepte, au prix que tu fixes ; en dessous, l'offre t'arrive comme d'habitude ») au-dessus de la liste (comme `data-ebay-non-reliees` `11513`), et sur chaque carte seulement la pastille du seuil (comme `data-relie` `10190`).
- Un seuil inconnu (non lu chez eBay, > 20 annonces) s'écrit « — », jamais « aucun ».

### 4.4 `scripts/audit-offres-auto.cjs` — ce qu'il interdit EXACTEMENT (et un seuil eBay le laisse vert si…)
Il lit `vinted-sync-extension/background.js` et `src/App.jsx` **sans leurs commentaires** (Babel, chaînes conservées) :
1. `background.js` : toute occurrence de `accept` près de `offer|offre|/accept|quoi:'accept'` hors de la liste `EXEC_PERMIS` ⇒ rouge (`53-68`). **Non concerné** (l'extension n'est pas touchée).
2. `background.js` : restes du moteur (`autoAccepterOffres`, `panel_min_prices`, `planchers`…) (`70-77`). Non concerné.
3. `App.jsx` (`79-91`) :
   - `/Min\. accepté/` ⇒ rouge — **ne jamais libeller le champ « Min. accepté »** ;
   - `/onCommit=\{[^}]*minPrice/` ⇒ rouge — **ne pas nommer la donnée `minPrice`** ;
   - `EXT_CAPACITES` sans `offres:`/`offresapp:`, aucun `extSait('offres')` — une règle eBay passe par le serveur, AUCUNE capacité d'extension ;
   - la regex de promesse, insensible à la casse, sur le code SANS commentaires : `/accept\w*[^\n<>{}]{0,40}(automatiquement|tout(?:e)?\s+seule?)|acceptation\s+auto/gi` ⇒ rouge. **Une chaîne comme « eBay accepte automatiquement… », « offres acceptées toutes seules », « acceptation automatique » fait tomber l'audit**, même si elle parle d'eBay. (En JSX, un `<`, `>`, `{` ou `}` entre « accept » et « automatiquement » casse la correspondance — ne pas compter dessus.) Formulations qui passent : « eBay accepte pour toi les offres à partir de 60 € », « Accepter les offres dès … € (c'est eBay qui le fait) ». Les noms d'identifiants (`seuilAccept`, `BestOfferAutoAcceptPrice`) ne matchent pas la seconde moitié.
4. L'autre sens (`93-103`) : `EXEC_PERMIS` garde l'acceptation manuelle, la messagerie garde « Accepter », `vinted_offres_auto` reste dans `SYNC_KEYS`.
- Le même motif est cherché dans le TEXTE RENDU de l'écran Annonces VINTED par `scripts/bancs/capacites.cjs:181` (`PROMESSE`) et `245` (`Min\. accept`). Si le seuil eBay s'affiche aussi sur les cartes Vinted (menu « ⋯ », « Publier aussi ailleurs »), la même contrainte de formulation s'applique.
- Invariant à AJOUTER (proposition) : `api/ebay.js` ne contient jamais `RespondToBestOffer` ni une route de la Negotiation API qui accepte ; le seuil ne s'écrit que par `ReviseFixedPriceItem` / `itemXml`. Aujourd'hui : 0 occurrence de `BestOffer` dans `api/` et `src/`.
- Dossier : la ligne du §3 à préciser est `CLAUDE.md:52` (et la section `CLAUDE.md:4743`, « ⛔ L'acceptation automatique des offres est RETIRÉE »).

---

## 5. Non mesuré — à vérifier avant de promettre quoi que ce soit

1. Les noms et la place exacte des éléments eBay (`BestOfferDetails/BestOfferEnabled`, `ListingDetails/BestOfferAutoAcceptPrice`, `ListingDetails/MinimumBestOfferPrice`, `DeletedField Item.ListingDetails.BestOfferAutoAcceptPrice`) viennent de la documentation Trading, **jamais appelés** sur son compte.
2. `currencyID="EUR"` : `itemXml` émet `StartPrice` sans attribut (la `<Currency>` de l'item suffit à l'ajout) ; un `ReviseFixedPriceItem` n'a pas de `<Currency>` — l'attribut est probablement nécessaire. À vérifier.
3. L'ordre des éléments dans `<Item>` : la publication a un filet (`pubverify`), **la révision n'en a pas** (pas d'équivalent « vérifier à blanc » pour `ReviseFixedPriceItem`) ⇒ relire `GetItem` après et dire ce qu'eBay tient.
4. Contraintes eBay supposées : seuil < prix ; plancher < seuil ; Best Offer refusé dans certaines catégories ; effet d'une baisse de prix (`ReviseInventoryStatus`, `handleRevise`) sous le seuil. Aucune mesurée.
5. Une annonce PROGRAMMÉE accepte-t-elle `ReviseFixedPriceItem` avec Best Offer ? Non mesuré (déplacer une programmée l'est seulement par la doc).
6. `GetMyeBaySelling` rend-il le seuil ? Non mesuré ; `GetItem` (borné à 20 par synchro, `api/ebay.js:967`) est la lecture sûre.
7. Ses deux annonces eBay actuelles n'ont **pas de SKU** : sans lien à une paire, aucun prix d'achat ne peut éclairer le seuil (et 8 fiches sur 401 seulement ont un prix d'achat).
