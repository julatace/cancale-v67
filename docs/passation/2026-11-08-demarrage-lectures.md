# 8 nov. 2026 — Démarrage : moins de lectures, moins d'octets

Branche `claude/demarrage-lectures` (depuis `origin/main` b700b4b2). Julien (8 nov.) :
« c'est encore beaucoup trop long à charger… imagine quand il y en aura mille ».
Rien de réel : base inventée (`_base-volume`), aucune ligne écrite nulle part.

## 1. Comment c'est mesuré

`node scripts/bancs/_mesure-demarrage.cjs <dist> [port]` (nouveau) : Chromium 390 px
tactile, 4G (9 Mb/s, 60 ms), processeur ×4, base inventée au poids réel
(`fabriquer({ volumeReel: true, qr: true })` — `qr` = nouvelle option : 60 suivis
Chronopost à la forme réelle, image du QR gardée sur la ligne, colis retirés compris).
- **prêt** = `[data-attente]` vaut `pret` (ou `plafond`) et l'écran de démarrage est
  parti — le signal du banc `chargement.cjs` (l'ancien critère « 200 caractères dans
  `.vrm-main` » était faux) ;
- **calme** = aucune lecture depuis 3 s ;
- `DETAIL=<préfixe>` écrit chaque requête (URL décodée, octets, départ, arrivée, pile
  d'appel ; `PILE=1` avec un build non minifié pour les noms de fonctions) ;
  `ETATS=1` : les états de l'attente (quelle donnée manque, quand) ; `EVAL=<expr>` ;
  `REPRISE=1` : deuxième ouverture dans le même navigateur.
- ⚠️ Le conteneur est partagé (charge 4 à 6) : les temps varient de ±20 % d'un passage
  à l'autre ; les NOMBRES de lectures et les octets, eux, sont stables.

## 2. Inventaire (Ma journée, 390 px, AVANT = b700b4b2)

91 lectures `/rest/v1/`, 2 487 Ko, 2 écritures (`widget_stats`, `lbc_a_retirer`).
Prêt au **plafond** (2,5 s après le montage) : `stats notifs carte annonces messages`
manquaient encore — le processeur est saturé (tâches longues 5,5 à 7 s sur 8 s).
Première lecture à ~3 s : avant, c'est le JavaScript (1,4 Mo compressé) — le
découpage d'App.jsx (autre chantier).

| lecture (famille) | n | octets | qui | 1er écran ? | traité |
|---|---|---|---|---|---|
| `harvest_*_orders_*d` (ventes + achats, projetés) | 1 | 1 485 Ko | `prechargerDemarrage` | oui (ventes, à expédier) | non — c'est la liste elle-même (voir §5) |
| `email_track_*` `select=id,data` | 1 | **243 Ko** (dont ~150 Ko d'images de QR) | `fetchEmailTrackingBrut` | oui (à retirer) | **sans le QR des colis retirés** |
| `harvest_{uid}_listings` + `_inbox`, un par compte | **14** | 337 Ko | `fetchHarvestBrut` (annonces, messages, cloche) | oui | **une lecture `in.(…)`** |
| `vinted_item_details` (fiches par clé) | 1 | 111 Ko | `lireFichesPage` (longueur des descriptions) | non (8,4 s) | non |
| `harvest_%_txn_%` (2 pages) | **4** (2 × 2) | 2 × 94 Ko | `fetchTxnItemIds`, `fetchVersementsVinted` | oui | **relue 0 fois** (mémoire gardée) |
| `main` | 1 | 67 Ko | chargement du nuage | oui | — |
| `email_bord_*` (méta) | 1 | 61 Ko | bordereaux reçus | oui (Colis) | — |
| `email_*` (compte, date) | 1 | 35 Ko | `fetchEmailsParCompte` | non | — |
| `harvest_*_enligne` | 1 | 6 Ko | règle « en ligne » | oui (Annonces) | — |
| `email_journal` | 1 | 5 Ko | `fetchEmailsParCompte` | non | — |
| `harvest_{uid}_label_%`, un par compte | 7 | 3 Ko | `fetchCapturedLabelMetas` | oui (Colis) | non (voir §5) |
| petites lignes `id=eq.X&select=data` (`panel_*`, dates d'annonces, Leboncoin…) via `fetchMemo` | **10** | ~0 | un effet chacune | oui | **une lecture `in.(…)`** |
| `harvest_%_releve_%` | 2 | ~0 | `fetchVersementsVinted` (sans mémoire) | non | **mémorisée** |
| Vestiaire `vc_*` (4 formes), `panel_num_reserves` ×2, `relais_ext` ×2 | 9 | ~0 | numérotation Vestiaire, relais | — | voulues fraîches (numéros) : gardées |
| eBay, Leboncoin, `depart_*`, `transp_*`, `mr_colis_*`, `colis_suivi_*`, brouillons, coffre, e-mails « à trancher »… | ~25 | ~0 | écrans et cloche | en partie | — |

Doublons mesurés : 9 lectures identiques sur Ma journée, 12 sur Colis. Cause principale :
**chaque écriture vidait toute la mémoire `fetchMemo`** — la publication de
`widget_stats` puis `lbc_a_retirer`, la relecture du nuage au premier chargement
(`vrm:nuage-relu` : toutes les clés « changent ») et six `POST /api/compte?mode=photo`
(qui DÉCLARENT pourtant `vrmInvalideSiChange`).

## 3. Ce qui a changé (cinq commits, chacun poussé vert)

1. **`src/memoEcritures.js`** — une écriture ne retire de la mémoire `fetchMemo` que
   les lectures qui PEUVENT porter ses lignes (la règle de `lecturesPartagees` :
   `idsEcrits` / `lecturePeutPorter`) ; `vrmInvalideSiChange` vers `/api/` ne vide
   rien (le passage des transporteurs qui CHANGE vide lui-même, mémoire comprise) ;
   la relecture du nuage ne retire que ce qui peut porter `main`. Tout ce qui n'est
   pas sûr vide tout, comme avant. Le relevé (`harvest_%_releve_%`) est mémorisé
   comme les transactions. `audit-memo-ecritures` (7 mutations rouges).
2. **`src/lectureGroupee.js`** — les demandes d'UNE ligne faites dans le même tour
   (`setTimeout 0`) et la même session partent en `id=in.(…)` (40 au plus). Chaque
   appelant reçoit les lignes de SON id (égalité stricte) ; ligne absente = `[]` ;
   réseau / illisible / 401 / 403 / 408 / 429 = `null` pour tous (pas su) ; 5xx et
   autre 4xx = chaque ligne relue seule ; réponse vide, ligne sans id, id pas
   demandé, doublon = chaque ligne relue seule (on ne devine jamais). Branché sur :
   - `fetchHarvestBrut` (dressings et boîtes de réception, projetés `SEL_MOISSON`), un lot PAR FAMILLE (sur réseau lent, Messages n'attend pas les dressings) ;
   - `fetchMemo` pour la forme EXACTE `app_data?id=eq.X&select=data` sans autre
     en-tête que la clé et la session (`idLigneData`).
   `audit-lecture-groupee` (13 mutations rouges, dont 50 comptes identiques).
3. **`src/suivisSansQr.js`** — `email_track_*` en trois lectures PARALLÈLES :
   `select=id,meta,<recuSur,sms,extraitLieu,extraitCode>` (la colonne `meta` de la
   migration 004 porte tous les scalaires ≤ 600 octets — c'est déjà ce que lisent le
   widget et le rappel du matin, `SELECT_SUIVI_META`) ; l'image du QR des lignes
   dont l'état rangé n'est pas `delivered` (`or=(…is.null,…neq.delivered)` : un état
   NULL garde son QR) ; l'id des lignes retirées qui ont un QR. Une ligne rangée
   « retiré » que `relireLigneSuivi` remet en jeu a son QR relu aussitôt ; un colis
   retiré garde `qrOmis` et son QR se relit à la vue en grand (`lireQrDeLigne`). Une
   ligne sans `meta` est relue entière. Une lecture ratée ⇒ `null` pour tout le suivi.
   `audit-suivis-sans-qr` (9 mutations rouges : ligne identique à l'ancienne lecture,
   aucune image de QR d'un colis retiré sur le réseau, pannes, 1 205 lignes).
4. `scripts/bancs/_base-volume.cjs` : option `qr`, colonne `meta` entière (règle
   `vrm_meta`), `or=(data->>…)`, `neq` à la SQL (NULL n'est pas « différent »).
   `audit-supprimees` charge le lecteur groupé (sinon il levait, §6.3).

## 4. Chiffres (même conteneur, même base `qr`, un passage chacun)

Deux passages alternés avant/après (b700b4b2 / 654d2e8a), chacun : ouverture à froid
puis deuxième ouverture dans le même navigateur (`REPRISE=1`). Valeurs des deux passages.

| écran (390 px, 4G, ×4) | lectures | dont avant « prêt » | Ko lus | prêt (ms) | calme (ms) | tâches longues (ms) | lectures identiques |
|---|---|---|---|---|---|---|---|
| Ma journée avant | 96 / 93 | 81 / 78 | 2 488 | 10 382 / 8 007 (plafond) | 13 144 / 11 404 | 10 308 / 8 528 | 13 / 10 |
| Ma journée après | **84 / 80** | 72 / 71 | **2 290** | 9 646 / 8 927 (plafond) | 11 900 / 10 691 | 8 399 / 7 892 | 10 / 6 |
| Colis avant | 93 / 93 | 78 / 81 | 2 487 | 8 679 / 9 064 (plafond) | 11 185 / 11 317 | 8 312 / 8 530 | 10 / 10 |
| Colis après | **78 / 81** | 68 / 71 | **2 289** | 10 922 / 8 514 (plafond) | 13 677 / 11 530 | 10 268 / 7 856 | 4 / 7 |
| Ventes avant | 77 / 77 | 71 / 72 | 2 375 | 8 982 / 8 349 | 9 742 / 8 851 | 5 204 / 4 701 | 6 / 6 |
| Ventes après | **65 / 65** | 61 / 61 | **2 177** | **7 317 / 7 183** | 8 319 / 8 183 | 3 757 / 4 262 | 3 / 3 |
| 2ᵉ ouverture Ma journée avant → après | 93/92 → 81/81 | | 2 298 → 2 100 | 8 915/8 874 → 9 496/10 681 | | 7 652/7 755 → 9 174/9 134 | |
| 2ᵉ ouverture Ventes avant → après | 74 → 65 | | 2 095 → 1 988 | 8 304/8 904 → 7 683/7 189 | | 4 857/5 201 → 3 996/4 013 | |

Lecture honnête :
- **Lectures : −12 à −15 par ouverture (−13 à −16 %)**, octets **−200 Ko (−8 %)**,
  lectures en double divisées par ~2. C'est stable d'un passage à l'autre.
- Au banc, les petites lignes `panel_*` N'EXISTENT PAS : leur lot rend vide et chacune
  est relue (règle de prudence, §5.5). Chez un vendeur dont ces lignes existent, c'est
  10 lectures de moins encore (≈ −25 par ouverture au total).
- Le QR : le banc ne range que 60 suivis Chronopost (52 retirés) — 243 → 155 Ko. Chez
  lui le gain grandit avec l'historique (chaque colis retiré garde ~2,5 Ko d'image).
- **Temps : Ventes s'ouvre ~1,2 s plus tôt** (prêt 8,3–9,0 s → 7,2–7,3 s, tâches
  longues −1 s). **Ma journée et Colis : pas de gain mesurable** — elles s'ouvrent
  au PLAFOND (2,5 s après le montage) avant ET après, et la variation d'un passage à
  l'autre (±1,5 s) dépasse l'effet. Le goulot y est le processeur (§5.1), pas le réseau.
- Deuxième ouverture : les octets baissent pareil ; le temps reste celui du calcul.

## 5. Ce qui reste (par gain attendu)

1. **Le processeur, pas le réseau** : sur 8 s, 5,5 à 7 s de tâches longues ; l'écran
   s'ouvre au plafond de 2,5 s parce que `stats`, `notifs`, `annonces`, `messages`
   se calculent tard. Moins de réponses = moins de rendus, mais le gros est le calcul
   (`Comptabilite` remonté à chaque écran) et la compilation d'App.jsx — le
   découpage en cours.
2. **Les commandes (1,5 Mo, 60 % des octets)** : c'est la liste `my_orders` elle-même.
   PostgREST ne projette pas champ par champ dans un tableau : il faudrait une capture
   plus mince (extension) ou une vue/fonction en base (migration).
3. **Deuxième ouverture instantanée (instantané local) : PAS FAIT, exprès.** Ce qui
   existe : les `/assets/` dans le service worker (pas de re-téléchargement), la ligne
   `main` dans le stockage local, `vrm_acct_cache` en `sessionStorage` (3 min,
   rechargement), la photo hors réseau de Colis (`vrm_hl_photo_*`), `memoireEcrans`
   (mémoire, 3 min). Un instantané IndexedDB de toutes les lectures, peint avant la
   relecture, se heurte à : (a) les publieurs uniques (§5 : `vrm_colis_aposter`,
   `widget_stats`…) publieraient un état d'hier comme frais ; (b) les gestes (bordereau,
   « J'ai retiré », numérotation) partiraient sur une vente annulée depuis ; (c) les
   trois états : chaque écran devrait distinguer « instantané » de « lu ». Plan
   proposé : un instantané PAR ÉCRAN (comme `journeeHorsLigne`), clé = uid VRM,
   effacé à la déconnexion, écran en lecture seule (gestes grisés « mise à jour… »)
   et ligne « Dernier état du … — mise à jour » tant que la relecture n'est pas
   revenue ; aucun publieur ne lit l'instantané ; une relecture ratée garde la ligne
   d'état ambre. À mesurer avant : le gain est borné par le point 1 (le calcul se
   refait de toute façon).
4. Les bordereaux captés, un `like` par compte (7 × 0,5 Ko) : groupables en
   `or=(id.like.…)`, mais une liste vide y est une vraie réponse et beaucoup de bancs
   ne servent pas `or=` — pas fait.
5. Une réponse groupée VIDE est relue ligne par ligne (règle de prudence pour les
   serveurs qui ne comprennent pas `in.`) : pour un vendeur NEUF dont aucune
   petite ligne n'existe, c'est +1 lecture. Pour un vendeur installé, 10 → 1.
6. La vue équipe lit encore `email_track_*&select=id,data` (rare, pas touchée).

## 6. Mille vendeurs

Par ouverture d'un vendeur installé (7 comptes) : −14 lectures de dressings/boîtes,
−9 petites lignes, −2 à −4 relectures des transactions (≈ 190 Ko et le balayage le
plus coûteux de la base, `pg_stat_statements`), −1 relevé, et les images de QR des
colis retirés (≈ 2,5 Ko par colis retiré avec QR, à chaque ouverture). Soit ≈ −25 à
−28 requêtes PostgREST par ouverture (≈ −30 %), autant de vérifications de jeton et
de connexions du pooler en moins ; à 1 000 vendeurs × quelques ouvertures par jour,
des dizaines de milliers de requêtes et quelques Go d'égress par mois en moins.

## 7. Preuves

- `npm run build` ; nouveaux audits verts avec mutations : `audit-memo-ecritures`
  (7/7), `audit-lecture-groupee` (13/13), `audit-suivis-sans-qr` (9/9) — sur l'arbre
  d'avant (b700b4b2) ils échouent (modules et câblage absents) ;
- audits verts : `audit-tdz`, `audit-variables`, `audit-identite`, `audit-statuts`,
  `audit-coherence`, `audit-fonctions-api`, `audit-lectures-partagees`,
  `audit-lectures-lourdes`, `audit-supprimees` (retouché : charge le lecteur groupé),
  tous les audits qui touchent `email_track` (17) et tous ceux qui contiennent
  `select=data` (49) ; seul rouge : `audit-export-donnees` X6 — **identique sur b700b4b2** ;
- bancs (un à la fois) : `hors-reseau`, `hors-ligne`, `iphone-reprise` (139/139),
  `fluidite`, `colis-qr` (100/100) verts ;
  rouges **identiques sur b700b4b2** (relancés depuis l'arbre d'avant) : `colis` (4,
  bordereaux captés), `retrait` (3), `chiffres-coherents` (2, widget HTTP 503),
  `journee-coherence` (E9), `a-confirmer` (2) ;
  `chargement` : 390 lent sombre, CLS `garage` 0,038 et `messages` 0,18 — **instables
  avant aussi** (avant : messages 0,184 1 fois sur 3, garage 0,038 2 fois sur 3 ;
  après le lot par famille : messages 0,006 puis 0,185, garage 0,038). Le premier
  état de ce chantier (un seul lot dressings + boîtes de 337 Ko) mettait Messages à
  0,18 à chaque passage : corrigé (lot par famille, commit 654d2e8a). Le reste du
  banc `chargement` (4 combinaisons × 8 écrans) est vert.
- Pas lancés : `journee-*` autres que `journee-coherence`, `colis-*` autres que
  `colis` et `colis-qr` (limite d'un banc à la fois, ~15 min pour `chargement`).
