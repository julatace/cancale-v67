# 6 nov. — De vrais écrans de chargement

Branche locale `v36-chargement` (depuis `claude/project-review-nsk5su`, eeac9f1d). Rien
poussé ; extension et `public/*.zip|xpi` non touchés. Données des bancs : inventées.

Julien (6 nov.) : « Quand ça bug je ne veux pas que ça soit comme ça, les données
apparaissent de partout, je veux qu'il y ait de vrais écrans de chargement, beaucoup
plus beaux, moins de bug. »

## 1. Ce qui a été mesuré (banc `scripts/bancs/chargement.cjs`, nouveau)

Base inventée au poids réel (`_base-volume.cjs`), fichiers de l'app compressés passés par
le réseau émulé de Chrome, base servie avec RTT et débit. Toutes les 100 ms, DANS la page :
le texte visible de `#root` (l'écran de démarrage qui couvre = un état), les décalages
(`layout-shift`), les lignes « lecture… » et « pas lu / pas su / non relevé ». Huit écrans
(Ma journée, Ventes, Annonces, Colis, Achats, Messages, Stock, Compta), quatre combinaisons :
390 tactile ×4 processeur en 4G (clair) et en réseau LENT (400 ms, 400 kbit/s, sombre), 1512
en fibre (sombre) et en 4G (clair). Puis Ma journée → Ventes → Ma journée par la navigation.

Ce que l'œil voyait AVANT (arbre eeac9f1d) : page blanche ~1,5 s, « VRM · Ouverture de ton
espace… » ~7 s (4G), page blanche, « Vérification de ta boutique », puis la coque avec des
« — », « lecture… », « pas lu », des squelettes, et les cartes qui arrivent une par une et
poussent le reste pendant 5 à 15 s. Vidéo : voir §5.

## 2. Ce qui a changé

1. **Écran de démarrage AVANT le JavaScript** (`index.html`, styles en ligne, aucun script —
   la CSP les refuse) : le logo (en `data:`, aucune requête), un rail fin à l'encre, fond de la
   coque (#F2F2F7 / #000, thème posé par `demarrage-theme.js`), « La connexion est lente ·
   Recharger » au bout de 20 s. `prefers-reduced-motion` : pas de rail ni de fondu, le mot
   « Ouverture… ». Il couvre le téléchargement, la session, la vérification de la boutique et
   l'écran d'ouverture ; `src/demarrage.js` le retire (fondu 200 ms) dès que `#root` montre autre
   chose qu'une attente (`data-demarrage-attente`, `data-demarrage-vrm`, `data-equipe-attente`,
   `data-confidentialite="verification"`) : l'écran prêt, l'accueil public, la connexion, une panne.
2. **L'attente d'un écran** (`src/AttenteEcran.jsx`, posée UNE fois dans la coque autour des
   écrans, `key={tab}`) : chaque écran nomme ses données ESSENTIELLES (`ESSENTIELS_ECRAN`) ; tant
   que l'une est `undefined`, l'écran est MONTÉ (ses lectures partent) mais invisible et sans
   hauteur, son squelette tient la place ; puis il arrive d'un bloc (fondu 180 ms). Une donnée
   `null` (lecture ratée) est une réponse : l'écran s'ouvre et dit sa panne à sa place (EtatPanne),
   une fois ; ouvert, il ne se referme jamais. Plafond 2,5 s : il s'ouvre avec ce qui est sûr.
   - données de la coque (`essentielsCoque`) : `comptes`, `nuage`, `sites`, `stats` (les lignes de
     « vendu »), `notifs` (un passage complet des actions du jour) ;
   - données annoncées de l'intérieur (`useEssentiel`) : `ventes`, `achats`, `annonces`,
     `messages`, `bordereaux` (Comptabilite), `stock` (Stock), `carte` (la carte sombre) ; une
     donnée qu'aucun composant MONTÉ n'annonce n'est pas attendue (un filtre de site sans elle).
3. **Squelettes** (`src/Squelette.jsx`, `src/styles-attente.css`) : briques (barre, chiffre,
   vignette, carte, carte sombre du mois, segmenté, puces, lignes, grille) et une forme par écran
   (le VRAI titre avec les classes du vrai). Une seule pulsation (le squelette entier, un calque),
   à l'arrêt sous l'écran de démarrage et en `prefers-reduced-motion`. Aucune couleur nouvelle.
4. **Pas de « pas lu » qui devient une valeur** (`src/preparations.js`) : un chiffre PUBLIÉ (§11 :
   `vrm_paires_dorment`, `vrm_colis_retirer`, `vrm_benefice_jours`, `vinted_urssaf_mois`) jamais
   publié sur cet appareil se lisait « pas lu » / « pas calculé » / « ouvre Ventes » pendant que
   l'écran ouvert le calculait. L'écran qui publie DIT qu'il prépare (jusqu'à sa publication, au
   plus 8 s après sa liste) ; pendant ce temps la case dit « lecture… ». La carte attend ses
   chiffres avec l'écran (`carte`). « À faire » de Ma journée garde sa place (trois lignes de
   chargement) jusqu'aux actions du jour (au plus 20 s) — et ne dit plus « Rien à faire… : pas
   lu » pendant qu'elles se lisent.
5. **Revenir sur un écran déjà vu** : l'attente se souvient des écrans ouverts avec leurs données
   (par vendeur, en mémoire de la page) — pas de squelette ; ventes et achats repartent du cache
   des lectures DÈS le premier rendu (`etatOrdersDuCache`, la même entrée que `loadOrders`) ; le
   guide de démarrage et les bordereaux reçus par e-mail aussi (`src/memoireEcrans.js`, 3 min,
   seulement une valeur LUE), relus aussitôt et remplacés en place.
6. **Places réservées** : la ligne « Données » (bilan de synchronisation) garde sa place pendant sa
   première lecture ; le résumé du Stock réserve trois lignes.

Garanties tenues : « pas su ≠ 0 » (aucun chiffre inventé : un squelette ne dit rien, une
préparation dit « lecture… », jamais une valeur), « une lecture ratée n'écrit rien » (la mémoire
ne garde qu'une valeur lue, un échec garde la dernière), TDZ (`essentielsCoque` après tout ce
qu'il lit ; l'effet des 20 s après `accountsLoaded`), écrans montés : 38 `tab===` avant et après.

## 3. Chiffres

Avant = l'arbre de départ eeac9f1d ; après = 4b33306e (même banc, même base, lancés l'un
après l'autre sur une machine partagée très chargée — charge moyenne 10 à 30 sur 4 cœurs : les
temps varient de ±20 % d'un passage à l'autre, les nombres de changements et le CLS beaucoup
moins). « Premier contenu » AVANT est l'écran « VRM · Ouverture de ton espace… » de React
(pas un contenu) ; APRÈS c'est l'écran ouvert (l'écran de démarrage couvre tout ce qui précède).
Un changement = un nouvel état du texte visible (ou un squelette qui part/arrive) après le
premier contenu ; les pastilles de la navigation qui arrivent comptent.

**390:4g:clair** (largeur:réseau:thème)

| écran | changements visibles | CLS | « pas lu » transitoires | « lecture… » transitoires | écran stable (ms) | premier contenu (ms) |
|---|---|---|---|---|---|---|
| Ma journée | 15 → **5** | 0.013 → **0.008** | 2 → **0** | 1 → 1 | 21819 → 21804 | 1873 → 16187 |
| Ventes | 10 → **1** | 0.036 → **0.000** | 2 → **0** | 6 → 0 | 14123 → 14527 | 1879 → 13721 |
| Annonces | 14 → **5** | 0.149 → **0.022** | 2 → **0** | 1 → 1 | 18747 → 20373 | 1541 → 14055 |
| Colis | 8 → **2** | 0.030 → **0.000** | 2 → **0** | 2 → 0 | 29681 → 28672 | 1821 → 19117 |
| Achats | 8 → **2** | 0.285 → **0.000** | 2 → **0** | 1 → 1 | 17440 → 18214 | 2050 → 14645 |
| Messages | 12 → **3** | 0.311 → **0.009** | 2 → **0** | 1 → 0 | 15718 → 16719 | 1914 → 13915 |
| Stock | 6 → **1** | 0.051 → **0.000** | 2 → **0** | 2 → 0 | 16061 → 13840 | 1799 → 12843 |
| Compta | 8 → **1** | 0.266 → **0.000** | 2 → **0** | 3 → 0 | 13878 → 14009 | 1772 → 13195 |

Retour sur Ma journée (après Ventes) : 2 changement(s) → **0**, aucun squelette.

**390:lent:sombre** (largeur:réseau:thème)

| écran | changements visibles | CLS | « pas lu » transitoires | « lecture… » transitoires | écran stable (ms) | premier contenu (ms) |
|---|---|---|---|---|---|---|
| Ma journée | 15 → **6** | 0.078 → **0.007** | 2 → **0** | 1 → 1 | 47943 → 45344 | 5231 → 34887 |
| Ventes | 8 → **2** | 0.040 → **0.036** | 2 → **0** | 6 → 3 | 41999 → 40588 | 5097 → 35012 |
| Annonces | 13 → **6** | 0.024 → **0.024** | 2 → **0** | 1 → 2 | 44537 → 44627 | 5014 → 35272 |
| Colis | 10 → **4** | 0.039 → **0.012** | 2 → **0** | 3 → 1 | 47600 → 48817 | 4891 → 34824 |
| Achats | 10 → **4** | 0.142 → **0.006** | 2 → **1** | 1 → 1 | 42264 → 41539 | 5119 → 34994 |
| Messages | 11 → **5** | 0.254 → **0.001** | 2 → **0** | 1 → 0 | 41697 → 42338 | 5085 → 35363 |
| Stock | 6 → **1** | 0.051 → **0.000** | 2 → **0** | 2 → 0 | 41066 → 40293 | 5445 → 34795 |
| Compta | 7 → **1** | 0.212 → **0.000** | 2 → **0** | 3 → 0 | 40186 → 40199 | 4987 → 35289 |

Retour sur Ma journée (après Ventes) : 2 changement(s) → **0**, aucun squelette.

**1512:fibre:sombre** (largeur:réseau:thème)

| écran | changements visibles | CLS | « pas lu » transitoires | « lecture… » transitoires | écran stable (ms) | premier contenu (ms) |
|---|---|---|---|---|---|---|
| Ma journée | 13 → **1** | 0.002 → **0.001** | 2 → **0** | 1 → 1 | 7678 → 5340 | 488 → 4741 |
| Ventes | 6 → **1** | 0.023 → **0.001** | 0 → **0** | 6 → 0 | 4159 → 2662 | 479 → 2406 |
| Annonces | 10 → **1** | 0.243 → **0.001** | 1 → **0** | 1 → 0 | 9385 → 5632 | 556 → 5010 |
| Colis | 8 → **1** | 0.023 → **0.001** | 1 → **0** | 2 → 0 | 12159 → 8771 | 313 → 5688 |
| Achats | 8 → **0** | 0.678 → **0.001** | 1 → **0** | 0 → 0 | 4915 → 5363 | 856 → 4456 |
| Messages | 13 → **0** | 0.003 → **0.001** | 0 → **0** | 0 → 0 | 6457 → 3594 | 351 → 3594 |
| Stock | 5 → **1** | 0.018 → **0.001** | 0 → **0** | 1 → 0 | 3916 → 2715 | 828 → 2415 |
| Compta | 8 → **1** | 0.072 → **0.001** | 0 → **0** | 2 → 0 | 4575 → 2848 | 812 → 2648 |

Retour sur Ma journée (après Ventes) : 2 changement(s) → **0**, aucun squelette.

**1512:4g:clair** (largeur:réseau:thème)

| écran | changements visibles | CLS | « pas lu » transitoires | « lecture… » transitoires | écran stable (ms) | premier contenu (ms) |
|---|---|---|---|---|---|---|
| Ma journée | 14 → **2** | 0.002 → **0.001** | 2 → **0** | 1 → 1 | 16378 → 13032 | 1735 → 11937 |
| Ventes | 5 → **1** | 0.023 → **0.001** | 0 → **0** | 6 → 0 | 11199 → 10748 | 1525 → 9851 |
| Annonces | 13 → **0** | 0.384 → **0.001** | 1 → **0** | 1 → 0 | 14502 → 12726 | 1439 → 12191 |
| Colis | 9 → **1** | 0.028 → **0.001** | 1 → **0** | 1 → 0 | 19989 → 12985 | 1529 → 12311 |
| Achats | 11 → **0** | 0.064 → **0.001** | 1 → **0** | 0 → 0 | 12368 → 11456 | 1769 → 11045 |
| Messages | 11 → **1** | 0.010 → **0.001** | 0 → **0** | 0 → 0 | 13531 → 10168 | 1633 → 9706 |
| Stock | 6 → **1** | 0.018 → **0.001** | 0 → **0** | 1 → 0 | 11020 → 9813 | 1553 → 9311 |
| Compta | 6 → **1** | 0.078 → **0.001** | 0 → **0** | 2 → 0 | 11664 → 10212 | 1659 → 9710 |

Retour sur Ma journée (après Ventes) : 2 changement(s) → **0**, aucun squelette.

Le banc juge (sans référence) CLS ≤ 0,01, aucun « pas lu » transitoire, et le retour sur un
écran déjà vu (aucun squelette, même monté une seule image, ≤ 1 changement) ; avec
`CHARGEMENT_REFERENCE` : changements ÷ 3 et écran stable pas plus tard (+15 % + 0,4 s).
- **Avant : 56 rouges** (CLS, « pas lu » transitoires, retour avec squelette) ;
- **après (4b33306e) : 11 rouges**, tous dans une ouverture où le PLAFOND a ouvert l'écran
  avant ses données (réseau lent : 9 ; Annonces en 4G au téléphone sous une forte charge : 2 —
  vert au passage suivant, 1 changement, CLS 0). 1512 en fibre et en 4G : tout vert, et chaque
  écran stable PLUS TÔT qu'avant (de 0,4 à 7 s) ; 390 en 4G : stable dans la tolérance partout.
- Passage final (1b16eaba : la carte d'Achats dit « lecture… » pendant la lecture des achats),
  390 en 4G et en réseau lent : **390 en 4G : tout vert** (Ma journée 15 → 5 changements, CLS 0,008 ; Ventes 10 → 1 ;
  Annonces 14 → 1 ; Colis 8 → 2 ; Achats 8 → 1 ; Messages 12 → 3 ; Stock 6 → 1 ; Compta 8 → 1 ; aucun
  « pas lu » transitoire ; chaque écran stable plus tôt qu'avant ou dans la tolérance) ; **réseau lent :
  7 rouges** (CLS de Ventes 0,036, d'Annonces 0,024, de Colis 0,012 ; changements Ma journée 15 → 6,
  Annonces 13 → 8, Colis 10 → 4, Messages 11 → 5) — plus aucun « pas lu » transitoire (Achats réglé).

## 4. Preuves

- **Le banc échoue sur l'arbre d'avant** : 56 rouges sur eeac9f1d (`CHARGEMENT_DIST=<build d'avant>`).
- **Mutation** (l'attente d'Annonces retirée : `annonces: []` dans `ESSENTIELS_ECRAN`, build à part)
  ⇒ **5 rouges** sur Annonces en 1512 (CLS 0,168 et 0,259, « pas lu » transitoire, changements 5 et 7
  au lieu de ≤ 3 et ≤ 4).
- Le retour sur un écran déjà vu : rouge tant que le squelette était monté une seule image
  (observateur de mutations du banc), vert après la mémoire des écrans et le cache dès le premier rendu.
- `npm run build` ✅ ; audits `tdz`, `variables`, `coherence` (0 rouge), `identite`, `garde-ecrans`,
  `csp`, `composants` ✅ ; aussi `carte-chiffres` (211 verts), `argent-a-venir`, `benefice-unique`,
  `comparer-mois`, `objectif-mois`, `onglets-a`, `ventes-e2` ✅. `audit-journee-coherence` : 1 rouge
  **préexistant** (A4 attend l'ancienne formule de « N gestes », sans `comptesARelierJour` — déjà
  rouge sur eeac9f1d).
- Bancs `nouveau-vendeur` ✅, `onglets-a` 29/29 ✅, `garde-ecrans` ✅, `navigation-tache` 163/163 ✅
  — ce dernier adapté : il jugeait « écran blanc » au bout de 2,8 s pendant que l'écran attendait
  derrière son squelette ; il attend désormais que l'attente soit levée (au plus 10 s) puis juge
  l'écran ouvert, comme avant (sans adaptation : 4 rouges, F ×3 « blanc » et J).
- Écrans montés : 38 `tab===` avant et après (§4.11).

## 5. Captures et vidéos (regardées)

Dans le scratchpad de la session (`…/scratchpad/chg/ab2/`) :
- `ouverture-avant-390-4g.webm` et `planche-avant.png` (une image par seconde) : page blanche,
  « VRM · Ouverture de ton espace… » ~7 s, page blanche, « Vérification de ta boutique », la coque
  pâle, « Rien à faire dans ce qui est lu… : pas lu », squelettes, puis les chiffres qui arrivent
  un par un et poussent « À faire » ; au retour sur Ma journée, des lignes qui réapparaissent.
- `ouverture-apres-390-4g.webm` et `planche-apres.png` : l'écran de démarrage (logo, rail) jusqu'à
  l'écran ouvert, puis Ma journée posée (cases « lecture… » dans leur place, « À faire » en lignes de
  chargement) qui se remplit sans bouger ; « À faire » arrive d'un bloc ; retour sans squelette.
- Captures finales par écran : `shots-avant/`, `shots-apres/` ; squelettes (390 clair, 1512 sombre,
  squelette puis écran fini) : `…/scratchpad/chg/sq1/`. Regardées : en sombre, les barres étaient
  trop pâles (7 %) et le grand chiffre trop large sur ordinateur — corrigés (8 %, 320 px au plus).

## 6. Ce qui reste

- **Réseau lent** (400 ms, 400 kbit/s) : l'app (JS) met ~35 s à arriver, puis les lectures de la
  base ~10 s de plus ; le plafond de 2,5 s ouvre l'écran avant ses données, et ce qui arrive ensuite
  bouge encore un peu : CLS 0,007 à 0,036 (avant 0,04 à 0,25), 1 à 6 changements (avant 6 à 15).
  Les emplacements qui bougent encore : les lignes de sites de Ventes · Tous (« Vestiaire : lecture
  en cours… » → la phrase finale, plus longue), « Prochain geste » d'Annonces (apparaît au-dessus de la
  grille quand les N° à vérifier sont comptés), la ligne des colis à l'arrivée des achats. Chacun
  demande une place réservée à SA hauteur finale.
- **Ma journée** sous plafond : la liste « À faire » arrive d'un bloc, mais les cases de la carte
  se remplissent une à une (« lecture… » → valeur, dans leur place) : 5 à 6 changements au téléphone
  (avant 15) — la règle « ÷ 3 » est tenue en 4G (15 → 5) mais pas en réseau lent (15 → 6).
- La pastille « 84 » d'Annonces (navigation) arrive après l'écran sur la plupart des écrans : un
  changement de texte, sans décalage (elle vient des actions du jour de la coque).
- `ESSENTIELS_ECRAN` ne couvre que les huit écrans mesurés ; les autres s'ouvrent comme avant
  (rien à attendre) — Statistiques, E-mails, Favoris, Republier pourraient y entrer.
- Le plafond de 20 s de « À faire » et la borne de 8 s des préparations sont des choix (une
  lecture pendue ne doit jamais laisser « lecture… » pour toujours) — à revoir si un passage des
  actions du jour dépasse 20 s chez lui.
- Chiffres de temps : une machine partagée très chargée (charge 10 à 30) ; à refaire sur une
  machine calme pour les temps absolus (les nombres de changements et le CLS, eux, tiennent).

## Raccord du 6 nov. (v36-raccords) — les trois restes de CLS (point 6)

Mesuré en traçant chaque décalage (ses rectangles avant/après) et les frères au-dessus :
- **Annonces** (0,036 en 4G, 0,045 lent) : la liste paraissait avant la numérotation automatique
  (qui attend ventes, transactions, N° réservés, republications) ; « sans numéro » (un faux
  geste), puis les N° posés ouvraient « N numéros à vérifier » au-dessus de la grille. ⇒
  `numAttente` (Comptabilite) : annonces numérotables sans N° et numérotation pas encore passée
  (`numPasse`, posé dans l'effet de numérotation, même rendu que les N°) ⇒ la liste garde son
  squelette ; borné à 8 s.
- **Colis « À envoyer »** (0,012 lent) : la même arrivée posait « N numéros portés par deux
  articles » au-dessus de la liste ⇒ même `numAttente` (une fois les ventes lues : avant, c'est
  leur squelette à elles) ; et la case « À retirer » de la carte perdait sa ligne « lecture… »
  (−18 px) ⇒ `CarteMois` garde la place d'une ligne de raison déjà dite.
- **Ventes · Tous** (0,036 lent) : « À venir » (82 px) arrivait au-dessus de la liste ⇒
  `ArgentAVenirCarte reserve` : pendant la lecture, sa forme repliée en squelette.
Banc entier (4 combinaisons × 8 écrans) **vert** : Annonces 0,000 · Ventes 0,003 · Colis 0,001 en
lent ; tout ≤ 0,009. Mutation (les trois corrections retirées, build à part) ⇒ exactement les
3 rouges d'avant (0,036 · 0,045 · 0,012). Bancs `nouveau-vendeur`, `navigation-tache` 163/163,
`onglets-a` 29/29, `garde-ecrans`, `statut-colis` 81/81, `conseils`, `colis-retirer-propre`
120/120 verts.

Après fusion de v36-visuel-2 (même jour) : Colis → À retirer avait DEUX corrections du même
vide de 68 px (visuel-2 : bas de « À retirer » à 12 px ; raccords : marge −12 sur « Argent à
vérifier ») ⇒ 0 px. Une seule règle désormais : le bas de « À retirer » à 0
(`styles-visuel-2.css`), la marge de section de la grille unique (28 px) fait l'air ; la
correction de `fusion.css` est retirée. `colis-retirer-propre` : 28,28,28,28,28,28 (120/120) ;
sans la règle ⇒ 68, rouge. Le banc juge chaque écart (20–40 px) : 40 y passerait, 28 est le
rythme des autres sections.
