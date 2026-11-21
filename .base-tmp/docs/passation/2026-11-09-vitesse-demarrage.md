# 9 nov. 2026 — Vitesse du démarrage (Julien : une app rapide pour ses clients payants)

Branche `claude/vitesse-demarrage` (depuis `origin/main` `b3ec1b17`). Rien de métier, aucun
chiffre ni aucune règle changés : ce qui change, c'est ce qui est CALCULÉ (et écrit) pendant
l'ouverture. Pas de PR ni de fusion (consigne de la session).

## 1. Mesure d'abord

Outil : `scripts/bancs/_mesure-demarrage.cjs` (existant), enrichi ce jour de :
`PROFIL=<préfixe>` (profil CPU du démarrage, agrégé par fonction, `PROFIL_BRUT=1` pour le
`.cpuprofile`), `TRACE=<préfixe>` (trace Chrome, compilation V8 comprise), `RENDUS=1`
(chaque rendu de `Comptabilite` avant « prêt »), `JALONS=1` (tâches longues + chaque
`vrm:save` daté), `COMPLET=1` (l'heure où TOUTES les données essentielles sont là).
Profil : 390 px tactile, 4G (9 Mb/s, 60 ms), processeur ×4, base inventée au poids réel.
⚠️ Conteneur partagé : charge 1 à 2 au début, **30 à 45 ensuite** (autres agents) ; les
temps absolus varient du simple au double, d'où les passages entrelacés et les médianes.

**Avant** (`origin/main`, charge ~2, 3 passages) : Ma journée « prête » en **6,7–7,2 s**
(médiane 6,8 s), Colis ouvert directement 6,0–6,9 s ; 77 lectures (2,2 Mo) avant « prêt » ;
tâches longues 5,4–7,6 s ; **13 rendus de `Comptabilite`** avant « prêt ».

Le déroulé d'une ouverture de Ma journée (avant) :
- 0 → 1,3 s : téléchargement du morceau App (850 Ko compressés, 2,6 Mo) ;
- 1,3 → 1,9 s : son évaluation (0,6 s) ; 1,9 s : la sonde du schéma ;
- 2,0 → 3,2 s : UNE tâche de 1,2 s = le premier rendu (AppCoeur + `Comptabilite`), dont une
  grande part de **compilation paresseuse** V8 (trace : `V8.CompileCode` ~1,6 s sur le fil
  principal avant 5 s, 3 169 fonctions compilées à leur premier appel) ;
- 3,0 s : l'écran est monté (squelette) ; ses lectures partent ;
- puis les réponses arrivent une par une et chacune refait un rendu de `Comptabilite`
  (~250 ms au téléphone) ;
- **« prêt » = le PLAFOND** (`AttenteEcran`, ~2,5 s après le montage, retardé par les tâches
  longues) : sur cette base, les données essentielles `notifs` et `carte` n'arrivent qu'à
  8,5 s et 12,6 s (la carte attend `vrm_benefice_jours`, publié quand Leboncoin/eBay sont
  lus, ~12 s). Mesuré sans plafond (build d'essai, plafond 60 s) : Ma journée complète à
  12,7 s.

### Les 10 plus gros postes (avant, CPU ×4, du chargement au calme ; temps inclusifs)
| # | poste | coût mesuré | suite donnée |
|---|---|---|---|
| 1 | Rendus de `Comptabilite` (13 avant « prêt ») | 3,2 s | réduit (2, 5, 6) → 1,75 s |
| 2 | **La Tournée** de Ma journée, retirée de l'écran le 1er nov. (`TOURNEE_SUR_JOURNEE = false`) mais encore CALCULÉE à chaque rendu : toutes les cartes de Colis (`cartesColis`), les points, les étapes — résultat jeté | ~1,0 s (dont `cartesColis` 0,76 s) | **retiré** |
| 3 | Premier rendu (montage, compilation paresseuse du morceau App) | tâche de 1,2 s | pas touché (voir §4) |
| 4 | Téléchargement + évaluation du morceau App (2,6 Mo) | ~1,3 s + 0,6 s | pas touché (voir §4) |
| 5 | Écriture du cache des ventes (`sessionStorage` `vrm_acct_cache`, ~1,5 Mo : `JSON.stringify` + `setItem`) pendant l'ouverture | 0,53 s | **déplacé** hors de l'ouverture |
| 6 | `achatDuColis` / `suivisAchat` / `entreeIndexAchat` : chaque colis relisait tous les achats et leurs n° | ~0,8 s | **indexé** |
| 7 | Recalculs de style (feuille App de 1,08 Mo : 9 651 règles, 280 `:has`) | 1,1 s + 0,16 s d'analyse | pas touché (chantier style en cours, consigne) |
| 8 | Enveloppes de `fetch` (partage, garde d'écriture, filtre des comptes supprimés, mémo) | ~0,3 s | pas touché |
| 9 | Formats de date refaits à chaque appel : `dateJourFr` (`toLocaleDateString` ×2), `murParis`, `dateParis` | 0,23 + 0,07 s | **créés une fois** |
| 10 | Mesures de mise en page : `UneLigne` (`vider`/`tient`) 0,22 s, `CarteMois.ajuste` 0,15 s | 0,37 s | pas touché (mesures utiles, coût = la mise en page elle-même) |

## 2. Ce qui a changé
1. **La Tournée cachée n'est plus calculée** (`App.jsx`, `const tournee` : `if (!TOURNEE_SUR_JOURNEE) return null`).
   Rien ne l'affichait (le build la gardait seulement parce que l'appel pouvait avoir des
   effets ; il n'en a aucun : `lignesLot`, `cartesColis`, `colonnesColis`, `pointsARetirer`,
   `etapesTournee`, `arretsTournee` sont des calculs). Si Julien redemande la Tournée,
   repasser le drapeau à `true` suffit.
2. **`achatDuColis` et `suivisAchat` indexés pour UN calcul synchrone** (`src/liensColis.js`,
   la règle de `memoRendu` : vidé à la microtâche suivante). Même règle : la boucle d'origine
   reste (`achatDuColisCalc`) et sert de référence ; l'index rend les MÊMES candidats (clé
   « compte:transaction », le dernier gagne comme `Map.set`, deux achats ⇒ personne).
   Preuve : `scripts/tests/liens-colis-memo.test.mjs` (3 000 colis au hasard sur des achats
   piégés — même transaction sur deux comptes, même n° sur deux achats, entrée d'un autre
   compte, n° écrits autrement — identiques à la boucle ; copie rendue ; jamais un résultat
   d'avant une modification). Les mutations d'`audit-suivi-colis` portent toujours (la règle
   vit dans `suivisAchatCalc`/`entreeIndexAchat`).
3. **Le cache des ventes s'écrit hors de l'ouverture** (`_persistAcctCacheBientot`) : quand
   la page est quittée ou cachée (`pagehide`, `visibilitychange` → caché : rechargement,
   autre onglet, iPhone qui la met de côté), sinon ~15 s plus tard quand le navigateur est
   libre (`requestIdleCallback`, 5 s au plus). Un EFFACEMENT reste écrit tout de suite. Le
   cache ne sert qu'au rechargement de cet onglet : une écriture perdue relit la base.
4. **Formats de date créés une fois** : `dateJourFr` (App.jsx), `murParis` et `dateParis`
   (`api/_lib/bilan-semaine.js`, aussi utilisé par le serveur). Même texte : vérifié sur
   2 503 instants de 2025-2026 (`dateParis`) et sur les jours/mois (`dateJourFr`) ;
   `audit-bilan-semaine` 50/50.
5. Photos Vinted `decoding="async"` (décodées hors du fil qui dessine).
6. **Les autres formats de date de Ma journée** (les 14 jours de `joursVenduRecu`, les 6
   derniers mois, le nom du mois, le jour de Paris de `useComptesARelier`, `ymParis` de la
   carte) passent par `src/formatsDate.js` (`dateLocale` : un format par langue+options).
   Mesuré : 469–546 formats créés avant « prêt » → 17.

## 3. Mesures (après)
Trois passages ENTRELACÉS avant (`origin/main` `b3ec1b17`) / après (le build de cette
branche), même profil, médianes. ⚠️ Charge du conteneur 10 à 20 pendant la mesure (au
lieu de ~2 le matin) : les temps absolus sont gonflés, l'écart se lit d'une colonne à
l'autre.

| moment | avant | après |
|---|---|---|
| Ma journée « prête » (ouverture de l'app) | 7,97 s (8,7/7,8/8,0) | **7,82 s** (7,8/7,7/8,7) |
| tâches longues avant « prêt » (Ma journée) | 7,8 s | **6,7 s** (−15 %) |
| lectures avant « prêt » (Ma journée) | 82 | 72 |
| Colis ouvert directement, « prêt » | 8,24 s | 8,13 s |
| tâches longues avant « prêt » (Colis) | 8,0 s | **6,8 s** (−16 %) |
| **Colis, premier passage** (toucher → affiché) | **6,0 s** (4,1/6,0/6,4) | **4,1 s** (4,1/2,8/4,2) |
| Colis, tâches longues du premier passage | 5,6 s | **3,6 s** |
| Ventes, premier passage | 1,38 s | **0,88 s** |
| Annonces, premier passage | 1,97 s | 1,73 s |
| formats de date créés avant « prêt » (banc `demarrage-vitesse`) | 469 / 546 / 521 | **17 / 17 / 18** |
| écritures du cache des ventes avant « prêt » | 2 | **0** |
| rendus de `Comptabilite` : temps total (profil, charge ~2) | 3,2 s | **1,75 s** |

Ce que ça veut dire : le processeur du téléphone travaille nettement moins pendant
l'ouverture et au premier passage sur Colis (le gain le plus visible : ~2 s), mais
**l'heure où Ma journée apparaît ne bouge presque pas** — elle est fixée par le plafond
d'attente (voir §4). L'objectif « < 3 s » n'est PAS atteint ; « Colis < 2,5 s » non plus
sous cette charge (2,8 s au meilleur passage).

## 4. Ce qui reste — et pourquoi « < 3 s » n'est pas atteint
- **« Prêt » vaut aujourd'hui « montage + plafond »** : tant qu'une donnée essentielle
  manque, l'écran attend ~2,5 s après son montage (règle d'`AttenteEcran`, demande de Julien
  du 6 nov. : « de vrais écrans de chargement »). Sur ce profil, le montage arrive à ~3 s et
  `carte`/`notifs` bien après le plafond ; Ma journée ne peut donc pas être « prête » avant
  ~5,5 s sans (a) changer ce plafond — une décision de Julien, pas prise ici — ou (b) que la
  carte et les notifications soient là plus tôt : la carte attend `vrm_benefice_jours`, qui
  attend que Leboncoin ET eBay soient lus (~12 s ici). Piste : publier/afficher la carte
  depuis la dernière publication rangée (elle est synchronisée) et la compléter en place.
- **Le premier rendu (1,2 s) et le morceau App (2,6 Mo)** : la compilation paresseuse de
  milliers de fonctions au premier appel. Remèdes : sortir de `App.jsx` ce que Ma journée
  n'utilise pas (passation générale §2.1, `scripts/decouper-app.cjs`) ; `Comptabilite` EST
  Ma journée (`only='journee'`), le découper ne sert que si la section journée devient un
  composant à part.
- **Le nombre de rendus** : chaque réponse de la base refait un rendu de `Comptabilite`
  (13 à 17 avant « prêt »). Regrouper les arrivées (un seul état « données de départ ») ou
  rendre la section journée mémorisable diviserait ce poste.
- **La feuille de style** (1,08 Mo, 280 `:has`) : à reprendre après le chantier style.
- Le service worker met déjà les morceaux `/assets/` en cache d'abord (`public/sw.js`) ;
  les écrans paresseux sont déjà des morceaux à part.

## 5. Preuves
- **Banc nouveau `scripts/bancs/demarrage-vitesse.cjs`** (D1 prêt ≤ 9 s, D2 tâches longues
  ≤ 6,5 s, D3 aucun `vrm_acct_cache` écrit avant « prêt », D4 ≤ 60 formats de date avant
  « prêt », D5 aucune erreur ; `PILES=1` dit d'où viennent les formats). Sur la branche :
  D2-D5 verts, D1 vert sous charge normale (rouge à 6,5 s sous charge 15-20 : seuil relevé
  à 9 s, c'est une garde contre un recul). Sur `origin/main` : **D3 et D4 rouges** (2
  écritures ; 469-546 formats), D1/D2 rouges sous la même charge. **Mutation** :
  l'ancienne écriture à 400 ms remise ⇒ D3 rouge (2 écritures).
- Tests : `scripts/tests/liens-colis-memo.test.mjs` (3 000 colis, = la boucle d'origine),
  `scripts/tests/formats-date.test.mjs` (chaque format de l'app = `toLocaleDateString`
  sur deux ans d'instants ; `dateParis`/`minuitParis` en été et en hiver) : 6/6 verts.
  `retraits-confirmes.test.mjs` : 17/18 comme sur `origin/main` (le test « vraie
  réception » échoue aussi avant).
- Audits verts : `audit-variables` (après correction : `window.requestIdleCallback`),
  `audit-tdz`, `audit-coherence`, `audit-identite`, `audit-statuts`, `audit-suivi-colis`
  (mutations comprises), `audit-bilan-semaine` (50/50). `npm run build` vert.
- Bancs (un à la fois, build de la branche) : verts `ecrans-gardes`, `fluidite`,
  `garde-ecrans`, `journee-chiffres` (24), `journee-widgets`, `colis-envoi` (118),
  `colis-envoyes-tri` (60), `beaute`, `compte-relie` (105). `iphone-reprise` : 5 rouges
  « O … les groupes Vendre · Gérer · Argent · Plateformes » IDENTIQUES sur `origin/main`
  (la colonne par tâches du 8 nov. n'a plus « Plateformes ») ; un rouge B1 vu une fois
  sous charge 40, vert au passage suivant. `chargement` : des CLS de 0,01 à 0,16 qui
  changent d'écran d'un passage à l'autre (garage, messages, annonces) — `origin/main`
  sous la même charge rougit aussi (autre ligne : « la navigation Ventes → journée ») ;
  rien de ce chantier ne touche la mise en page.
- Captures regardées : Ma journée 390 clair et sombre (banc `beaute`, build de la branche)
  et Ma journée au plafond sur la base au poids réel (banc `demarrage-vitesse`) :
  identiques à avant, « À faire » en chargement au plafond comme prévu.

## 6. Geste de Julien
Aucun.
