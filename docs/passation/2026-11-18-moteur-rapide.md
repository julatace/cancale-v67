# 18 nov. 2026 — Moteur rapide (branche `claude/moteur-rapide`, partie de `claude/rendus-groupes`)

Julien, sur son iPhone : « tout est lent, c'est une cata ». Diagnostic hérité (cache-onglets, rendus-groupes) : le temps
est du CALCUL — `Comptabilite` (24 000 lignes, ~1 200 hooks) est rendue 15 à 40 fois avant « prêt », et chaque rendu
recalculait les 2 200 lignes de Ma journée (tuiles, `commandesAVerifier`, la grille) : 200 à 600 ms au ×4.

## ÉTAT À LA REPRISE
- Étape 1a (PR #1265, `claude/moteur-rapide`, contient #1264) : **Ma journée cachée ne se recalcule plus**.
- Étape 1b partielle (PR suivante, `claude/moteur-rapide-1b`, empilée sur 1a) : **« commandes à vérifier » refait seulement
  si une de ses entrées change** (§5). Le reste de 1b (Ma journée ENTIÈRE par sa clé) : mesuré, PAS livré (§4, risque dit).
- Fusions gelées jusqu'à #1246 (design-v2) : rien n'est fusionné.

## 1. Étape 1a — Ma journée cachée garde l'arbre de son dernier calcul (`journeeGelee`, src/App.jsx)
Tant que l'écran attend ses données (src/AttenteEcran.jsx : monté, invisible, squelette ou instantané devant), chaque
lecture arrivée rendait `Comptabilite` ET les 2 200 lignes de Ma journée, pour un écran que personne ne voit. Caché
(`useEcranMontre()` faux), Ma journée rend le MÊME élément React que la fois d'avant : React ne reparcourt pas l'arbre.
- Ce qui continue seul : le corps de `Comptabilite` (lectures, publications `vrm_benefice_jours`, `vinted_urssaf_mois`,
  `vrm_colis_retirer`…, `useEssentiel` des ventes/achats/annonces/messages) et les composants qui lisent eux-mêmes.
- La carte du mois (`CarteStatsApp`, essentiel `carte`) dépend de `liveStats` et `premierJour` (props) : s'ils changent,
  l'arbre est recalculé, sinon la carte attendrait des props figées et l'écran tomberait au plafond (20 s avec instantané).
- Dès que l'écran se MONTRE (`tout` ou plafond), il est recalculé avec les données du moment ; ensuite, plus rien n'est gelé.
- Aucun calcul ne se fait au rendu de Ma journée qui écrive quelque part (vérifié : les `save` sont dans des gestes).

### Mesures (Ma journée, 390 tactile, ×4, 4G, 5 000 ventes ; `ab.cjs` = `_mesure-demarrage` RENDUS=1, passes alternées)
| ouverture | build | prêt (ms) | tâches longues (ms) | rendus de Comptabilite | validations React |
|---|---|---|---|---|---|
| 2e (instantané : le cas de Julien) | rendus-groupes dc630d0 | 15 787 | 11 308 | 35 | 49 |
| 2e | moteur-rapide | **13 675** | **8 898** | 38 | 52 |
| 1re (squelette, plafond 2,5 s) | rendus-groupes | 8 587 · 8 645 | 13 485 · 12 705 | 18 · 19 | 30 |
| 1re | moteur-rapide | 8 538 · 10 078 | 11 908 · 12 909 | 20 · 23 | 31 · 36 |
(médianes de 3 passes ; 1re ouverture : deux séries de 3, voir §3 pour la série de 4.) Le nombre de rendus ne baisse pas
(chaque rendu caché coûte ~55 ms au lieu de 200–600) : ce sont les tâches longues qui baissent.

### Preuves
- chiffres-volume (1512, 5 000 ventes, Ma journée, Ventes, Achats, Colis, Argent, Déclarer, Stats + 12 publications) :
  34/35 identiques ; le 35e : sur UNE balise de Ma journée, `data-vestiaire=0` et `data-ebay=0` dans un autre ORDRE (même
  ensemble de 105 attributs, mêmes valeurs — l'élément est créé d'un coup au lieu d'être complété).
- Mutation « gelé même montré » (rendu figé = lecture périmée) : chiffres-volume ROUGE (Ma journée : comptes et attributs).
- source-unique 25 ✓ · versements-course 26 ✓ · temps-reel 38 ✓ (build moteur-rapide).
- Captures 390 (1re et 2e ouverture) : identiques à rendus-groupes. Seul écart vu : le bandeau « Les photos de Vinted ne
  s'affichent pas ici » (coque, `PhotosBloquees`) arrive ~2 s plus tard — il attend des photos ratées, que l'arbre caché ne
  monte plus ; 8 s après le calme il est là, l'écran est le même.

## 2. Ce qui coûte encore (profil non minifié, 2e ouverture, après 1a)
`Comptabilite` inclusif 3,1 s (Ma journée 0,96 s ; le corps ~55 ms × ~38 rendus, éparpillé : aucun calcul > 200 ms) ;
mesures de texte (`ajusterChiffre`, `UneLigne` vider/tient, `attendrePolices`, `echelleTexte`) ~1,5 s ; React ~2 s.
Tâches longues restantes : 1,6 s à ~3,6 s (évaluation du morceau App, 2,2 Mo : hors de ce lot), ~1 s à l'arrivée des
ventes (5 000 commandes fusionnées + rendu), ~1 s au moment où l'écran se montre (Ma journée entière + 7 000 nœuds).

## 3. Série de contrôle (1re ouverture, 4 passes alternées)
rendus-groupes : prêt 8 811 · tâches longues 13 868 · plus longue 1 679 · rendus 19 · validations 30.
moteur-rapide : prêt 8 772 · tâches longues 12 977 · plus longue 1 668 · rendus 20 · validations 32.
À la 1re ouverture l'écran se montre au plafond (2,5 s après le montage) : la phase cachée est courte, le gain est dans le
bruit. Le gain est à la 2e ouverture et suivantes (instantané devant, l'écran vrai attend TOUTES ses données jusqu'à 20 s) :
c'est le cas de Julien sur son iPhone.

## Objectifs du lot NON atteints (dit tel quel)
≤ 3 rendus de `Comptabilite` avant « prêt », écran vrai < 3 s au ×4, aucun toucher bloqué > 200 ms : non. Ce qui les
empêche : l'évaluation du morceau App (1,6 s d'un bloc avant tout rendu), le plafond de 2,5 s compté depuis un montage à
~4 s, et une Ma journée qui se recalcule entière à chaque rendu montré (étape 1b, §4).

## 4. Étape 1b préparée — recalculer Ma journée seulement si UNE de SES données change
Mesuré (build de diagnostic) : les dépendances de Ma journée, calculées par analyse du code (babel : chaque nom lu par
l'IIFE et, transitivement, par les fonctions et constantes dérivées de `Comptabilite` qu'elle appelle), sont **203**
valeurs : 183 résultats de hooks, 19 props, 1 `let`. Sur les rendus MONTRÉS de la 1re ouverture, **22 sur 35** ne
changent AUCUNE d'elles une fois écartées 7 valeurs instables (refaites à chaque rendu : `vcLoc0` (useVcLocal),
`vendusAilleurs`, `pasEnLigne`, `avisBas`, `aRelierListe`, `nArticlesTx`, `annSelectionnables`) et les fonctions passées
par la coque (`onCycle`, `onLocate`, `onStore`, `onAllerTrancher`, `onTrancherAT`).
Pour le livrer sans risque de chiffre périmé :
1. stabiliser les 7 (mémo sur leurs vraies entrées ; `useVcLocal` : son compteur + une version du stockage + `departsCarte`) ;
2. fonctions de la coque : proxys stables qui appellent la dernière (présence gardée) ;
3. clé = les 203 valeurs + une VERSION du stockage (tout `localStorage.setItem/removeItem` de la page) + les `let` de module
   lus (liste générée) + une tranche de 10 s ; la liste générée par un script ET vérifiée par un audit qui refait l'analyse
   (un nom lu par Ma journée et absent de la clé ⇒ rouge) ;
4. preuves : chiffres-volume, source-unique, versements-course, temps-reel ; mutation (une dépendance retirée de la clé) ⇒ rouge.
Scripts d'analyse (non commités, à refaire) : parcours babel de `Comptabilite`, racines = bindings de sa portée dont
l'init est un appel `use*`, ses paramètres, ses `let` ; dérivées et fonctions développées.

### ⚠️ Pourquoi la clé de Ma journée ENTIÈRE n'est pas livrée
Le code compte par endroits sur le fait d'être recalculé à CHAQUE rendu pour suivre un état hors de React, sans aucun
signal : ex. `useBrouillonsVinted` (« jugée à chaque rendu (le compte ouvert dans Chrome change sans prévenir) »,
`vintedDeChrome()` + `Date.now()`). Une Ma journée mémorisée garderait ces lectures figées. L'analyse statique voit les
`let` de module (≈ 80 dans la fermeture de Ma journée, la plupart dans des gestes), pas QUAND ils sont lus (rendu ou
toucher). Avant de livrer : n'y mettre que des calculs dont chaque lecture hors React a une version (comme §5).

## 5. Étape 1b partielle — `commandesAVerifier` par sa clé (src/App.jsx, src/versionDonnees.js)
« N commandes à vérifier » (Ma journée) coûtait 1,1 à 1,5 s par ouverture (refait à chacun des ~35 rendus montrés).
- La clé (46 entrées) : les 41 états/props/`let` de `Comptabilite` qu'il lit (directement ou par les fonctions et dérivées
  qu'il appelle, à toute profondeur), `C`, `_pdfEtiquettes`, `vcLoc0.departs`, `versionMemoire()` et une tranche de 10 s.
  GÉNÉRÉE par `node scripts/audit-cle-verifier.cjs --ecrire` (babel), VÉRIFIÉE par le même audit sans option (un nom lu
  et absent de la clé ⇒ rouge ; 8 exemptés, raison écrite : tables constantes, mémoires internes à clé propre,
  `TXN_ETATS`/`_vcMem` couverts par `versionMemoire`). `--prouve` : chacune des 43 entrées retirée ⇒ rouge ; un nom lu
  ajouté au calcul sans la clé ⇒ rouge.
- Le stockage : les clés `localStorage` LUES pendant le calcul sont notées (`suivreStockage`, `getItem` suivi) et une
  écriture de l'une d'elles (setItem/removeItem/clear de la page, évènement `storage` d'un autre onglet) refait le calcul
  (`stockageInchange`). Une version globale du stockage (1er essai) ratait 18 rendus sur 20 : les écritures du démarrage
  touchent d'autres clés. `audit-version-donnees` EXÉCUTE le module dans un faux navigateur (13 cas ; `--prouve` 6/6
  mutants rouges : setItem/removeItem/storage ignorés, getItem pas noté, imbriqué perdu, versions pas comparées).
- Tables de module remplies en place : `noterEtatsTxn` (TXN_ETATS) et `signalerVc` (`_vcMem`) appellent `toucherMemoire()`.
- Mesuré (build de diagnostic, 1re ouverture) : 24 rendus sur 35 reprennent le résultat (11 calculs au lieu de 35).
