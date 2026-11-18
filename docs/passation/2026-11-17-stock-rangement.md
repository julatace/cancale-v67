# 17 nov. 2026 — Stock : ranger, naturel et simple (lot stock-rangement)

Julien : « l'onglet stock… pour ranger c'est un peu la galère, il faudrait que ce soit beaucoup plus naturel et
simple d'utilisation », puis sur sa capture du Stock actuel : « Toujours pas ouf », puis « fais quelque chose
d'original, de parfait, de nickel » (brief SIGNATURE).

Branche `claude/stock-rangement` (depuis `origin/main`, avec `origin/claude/design-v2` FUSIONNÉE — ses composants
`BoutonV2`, `MenuPlateforme`, la rangée A, `.v2-plaque`, la barre sans disque). Tout est **derrière le réglage d'essai
`vrm_design_v2`** (Paramètres → Apparence → Nouveau design) : éteint, l'écran Stock est celui de `main` (signature DOM
comparée par le banc avec `BANC_REF`).

## Le parcours d'avant, mesuré (banc, base inventée, 390 tactile)

| geste | touchers | ce qui coince |
|---|---|---|
| ranger UNE paire | 2 (sa vignette, une case) | la case est à chercher plus bas, sous la liste (défilement) |
| ranger 10 paires | 20 | 10 allers-retours bande ↔ meubles ; aucune case proposée en suivant |
| trouver N°178 | 2 + « 178 » tapé | la case clignote sur le plan, loin du champ |
| trouver puis déplacer N°178 | 6 | la fiche s'ouvre, « Déplacer » est dans sa feuille « ⋯ », puis il faut retrouver une case libre |
| voir ce qu'il y a dans l'Armoire | 0, mais **1 849 px** à défiler | les meubles sont sous la liste, les blocs « à faire » et « plus » |
| vendue expédiée | 0 | sortie automatique à l'expédition prouvée (inchangée) |

Sur sa capture : sept bandes avant la première paire (icônes, Annonces | Stock, titre + 2 ronds, chiffres, 3 puces,
pilules coupées, recherche, « À faire ») — la 1re paire à ~1 260 px sur 2 000 ; rangées cassées (N° dans sa colonne,
titre et sous-ligne coupés, « Ranger › » bleu sur chaque ligne) ; « Pas tout lu » sans geste.

## Ce qui change (réglage allumé)

- **La tête** : « Stock » 34/700 et LE geste plein compact à droite, « Ranger 10 » (comme « Publier » d'Annonces) ;
  UNE ligne « plateforme · compte » (le menu du nouveau design, ses filtres d'avant dedans) seulement s'il y a à choisir ;
  la bande Annonces | Stock n'est plus posée (Stock se joint par Annonces → « ⋯ », comme Annonces le fait).
- **« Où est… »** : le champ (photo et voix DEDANS) + « ⋯ ». Un N° tapé ou dit montre tout de suite SA place :
  l'**étiquette kraft** en grand, allumée (liseré bleu), le meuble, « Rangée 2 · colonne 2 », le petit plan avec la
  case pleine ; « Voir sur le plan » · « Déplacer ».
- **Paires · Places** (segmenté ; les nombres = annonces en ligne « ≥ » si une lecture manque, et meubles).
  - Paires : la rangée A du nouveau design (photo 64, titre sur 2 lignes, plaque N° · T. · place), groupée
    « À ranger · N » puis « Dans une case · N » ; glisser à gauche = « Ranger » / « Déplacer » ; toucher = sa place
    en feuille (+ « Tout sur ce N° »). Les blocs d'avant (retours, plus en ligne, pas vérifiées, cases libérées,
    importées, à part) suivent la liste, tels quels.
  - Places : un meuble par rangée (son étiquette kraft aux initiales, « 6 cases prises sur 12 · 1 à sortir ») ;
    la toucher ouvre le MÊME plan qu'avant (cases, photos, N°, glisser à la souris, modifier le meuble).
- **La séance « Ranger »** (feuille) : la paire (photo, N° en grand), la case proposée sur une étiquette kraft avec
  son plan, « Ranger ici » (un toucher) ; la paire rangée glisse et se replie avec sa coche (220 ms, réduit si
  mouvement réduit), « 10 à ranger » descend à 9, la suivante arrive avec « ✓ N°203 · Étagère entrée · rangée 3,
  colonne 1 » (la case FINALE relue). La case proposée suit la **dernière place utilisée** (le même meuble,
  `caseLibreDans`, src/ouRanger.js), sinon la première libre (`premiereCaseLibre`) — jamais imposée : « Autre place »
  ouvre la grille du meuble choisi, « Plus tard » passe. Fin : « Tout est rangé · 10 paires », la feuille se referme.
- **Déplacer** = la même séance sur une paire, la grille ouverte, sa case actuelle marquée.
- **« ⋯ »** : « À vérifier » — chaque état DIT son geste (« 3 à confirmer — lues il y a plus de 24 h (compte) :
  repasse sur ce compte », « Pas tout lu — Pas lu : Leboncoin. Ouvre ce site avec l'extension », « 3 sans N° — donne-leur
  un N° dans Annonces » qui y mène, « masquées par Vinted — rien à faire ») ; puis les outils (photo, inventaire,
  ajouter un meuble, mes annonces).

## Ce qui ne change pas

Aucune règle : la pose passe par `poser` (case prise ⇒ il DEMANDE ; gravité des piles), les cases proposées par
src/ouRanger.js, la recherche par IDENTITÉ de N°, la case allumée d'une vendue (son toucher la sort, annulable), la
sortie automatique à l'expédition prouvée, la carte de Ma journée déjà retirée (#1193). Aucun N° n'est écrit ni changé
(le banc compare `vinted_annonce_numeros` avant/après). Seul ajout côté règles : `caseLibreDans` (pure, même
`libreDans`) et `poser(…, { muet })` (la séance dit la pose elle-même ; un échange avec une occupante se dit toujours).

## Preuves

`scripts/bancs/stock-rangement.cjs` (390 tactile clair et sombre, 1512) joue les six parcours réglage éteint puis
allumé et compte les touchers :

| geste | avant | après |
|---|---|---|
| une paire | 2 | 2 (sans chercher la case) |
| dix paires | 20 | 11 |
| trouver N°178 | 2 | 1 (+ « 178 ») |
| trouver puis déplacer | 6 | 3 |
| voir l'Armoire | 0 touchers, 1 849 px à défiler | 2 touchers, 28 px |
| vendue expédiée | 0 | 0 |

Il exige aussi : chaque pose dans la bonne case, la proposition qui suit le même meuble, aucun N° changé, cibles ≥ 44,
aucun texte coupé, aucun défilement de côté, un seul plein, la 1re paire dans la moitié haute du premier écran, le
glisser « Ranger » présent ; avec `BANC_REF=<dist de main>`, réglage éteint = signature DOM de main et mêmes touchers.
Rouge sur `main` (3 KO : l'écran neuf n'existe pas) et par mutation (voir ÉTAT À LA REPRISE).

## Suites du 17 nov. (soir) : retours de Julien et du coordinateur

- « Toujours pas ouf » (capture du Stock actuel) : la liste d'abord (1re paire à ~280 px sur 844), rangée A du nouveau
  design, plus de « Ranger › » par ligne, « ⋯ » qui dit le geste de chaque état, plus de disque « + » (design-v2 fusionné).
- SIGNATURE : l'étiquette N° kraft PARTAGÉE (`Etiquette`, src/designV2/Signature.jsx) sur chaque rangée et dans la
  séance ; une place = une étiquette kraft plus grande (coin coupé, œillet) ; « Où est N°178 » l'allume ; le mouvement
  « fait » (coche, 220 ms) et « 10 à ranger » → 9.
- QUALITÉ ET FLUIDITÉ : la carte suivante arrive en ressort (WAAPI, annulée si une autre arrive) ; un toucher pendant
  le mouvement fait arriver la suivante SANS reposer la paire ; mouvement réduit = aucune animation ; rangées en
  `content-visibility` ; segmenté Paires · Places à soi (iOS, jour et nuit).
- Audit visuel : « Pas tout lu » en gris, trois graisses, étapes de l'explication en 13 px ; 375 px « Très grand » :
  le titre ne se casse plus, la photo se retire d'un champ étroit.
- Défaut trouvé au banc : l'en-tête à la cloche (`.v2-entete-cloche`, transparent, posé sur la ligne du titre)
  recevait le toucher destiné à « Ranger 10 » (`elementFromPoint` = HEADER). `pointer-events: none` sur lui, `auto`
  sur ses boutons (stock-v2.css ; passé à design-v2 pour la feuille commune).

## ÉTAT À LA REPRISE

- PR #1249 (`claude/stock-rangement`), `origin/main` fusionnée (ab3b27997 puis e00943cba), `claude/design-v2` fusionnée.
- Banc `stock-rangement.cjs` : 390 clair, 390 sombre, 1512, 375 « Très grand » ; réglage éteint = signature DOM de main
  (860 nœuds) et mêmes touchers. Rouge sur main (3 KO, l'écran neuf absent). Mutations, toutes ROUGES :
  M1 la proposition ignore la dernière place ⇒ P7 rouge (mA:6 au lieu de mB:1) ; M2 la séance ne pose plus ⇒ P1, P2,
  P4, P7, Q rouges ; M3 un 2e toucher pendant le mouvement repose la paire ⇒ Q rouge (N°201 bougée en mA:7).
- Audits verts : traduction (45/0), quoi-de-neuf, icones, tdz, studio, textes-courts, variables, ligne-glissable,
  pas-ranger-achat, coque-parametres.
- Reste : fusion après #1246 (design-v2) ; « Très grand » 375 : le texte d'aide du champ tient sans la photo (dans « ⋯ »).
