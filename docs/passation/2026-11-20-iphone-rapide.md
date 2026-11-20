# 20 nov. — « l'app rapide sur iPhone » (branche `claude/iphone-rapide`)

Julien (20 nov.) : « on peut faire l'app iPhone mais elle est trop lente ». Avant d'emballer l'app pour l'App Store : la mesurer
COMME un iPhone, trouver ce qui coûte, corriger le moteur (chargement, rendu, données) — jamais le style, aucune règle de
calcul. D'autres chantiers touchent l'apparence en même temps (`claude/minimaliste`, `claude/argent-natif`,
`claude/retraits-visuel`) : rien de visible ne change ici (preuve : styles calculés identiques, §4).

## 1. Comment c'est mesuré

`node scripts/bancs/iphone-rapide.cjs <dist>` (README des bancs) : Chromium en iPhone 13/15 — 390 × 844, densité 3, tactile,
processeur ×4 (CDP ; `CPU=6` pour un iPhone plus ancien), réseau 4G réaliste pour les fichiers (150 ms, 9 Mbit/s), la base
servie par le banc avec le même aller-retour et le même débit, **service worker autorisé** (c'est lui qui sert les ouvertures
suivantes). Base INVENTÉE au volume de Julien (`_base-volume` : 7 comptes, ≈ 1 200 annonces, 1 500 ventes, 800 achats,
350 conversations, PDF de bordereaux). Il rapporte, il ne juge pas.

- **Ouverture** : à froid (appareil neuf) puis deux ouvertures suivantes (page neuve, service worker actif) — 1re peinture,
  coque (barre d'onglets), chiffres d'Aujourd'hui (« Vendu · mois » lu), écran « prêt » (`data-attente="pret"` : TOUTES les
  données essentielles), JS+CSS reçus, tâches longues.
- **Changement d'onglet** : les 5 onglets deux tours, « Plus », une fiche d'Annonces et le retour — TEMPS DE FIL du fil
  principal (somme des tâches de 1er niveau de la trace Chrome, du toucher au calme + 1,5 s : CPU ×4 compris, insensible à
  l'attente d'un cœur), la plus longue tâche, style et mise en page.
- **Défilement** d'Annonces, Ventes, Achats (geste tactile synthétisé) : images/s, tâches > 50 ms. **Mémoire** (tas JS, nœuds).

⚠️ La machine des bancs est partagée (charge 11 à 20 sur 4 cœurs pendant tout le chantier) : l'horloge murale double d'une
passe à l'autre, et même le temps de fil d'un changement d'onglet varie du simple au double (il compte aussi les relectures de
fond qui tombent dans la fenêtre). Les décisions se prennent sur les **mesures contrôlées** (§3 : coût d'un recalcul complet
du style, A/B alternés ; micro-mesure des formats ; octets), le tableau du banc (§2) en ordre de grandeur, avant/après alternés.

## 2. Avant / après (banc iphone-rapide, mêmes machines, passes alternées avant, après, avant, après)

`origin/main` dd3336382 (« avant ») contre cette branche (« après », build `dist-apres4`), deux passes de chaque, ALTERNÉES
(avant, après, avant, après), même machine, à une heure où elle était moins chargée (charge 2 à 6). Médiane des deux passes
(la valeur de chaque passe à côté). CPU = temps de fil ×4 ; « prêt » = toutes les données essentielles lues.

| mesure | avant (passe 1 / 2) | après (passe 1 / 2) | médianes avant → après |
|---|---|---|---|
| **froid (4G)** · coque (barre d'onglets) | 5 233 / 5 427 ms | 4 991 / 5 888 ms | 5 330 → 5 440 ms (≈) |
| froid · écran prêt, tout lu | 7 552 / 7 705 | 7 330 / 8 232 | 7 629 → 7 781 (≈) |
| froid · JS + CSS reçus | 2 010 / 2 010 Ko | 2 002 / 2 002 Ko | **−8 Ko** (audit : 2 004 → 1 996 Ko) |
| **chaud (service worker)** · coque | 4 565 / 4 051 | 3 285 / 4 039 | **4 308 → 3 662 (−15 %)** |
| chaud · chiffres d'Aujourd'hui (« Vendu · mois ») | 4 950 / 4 457 | 3 462 / 4 252 | **4 704 → 3 857 (−18 %)** |
| chaud · écran prêt, tout lu | 12 739 / 11 062 | 8 807 / 11 570 | **11 901 → 10 189 (−14 %)** |
| chaud · tâches longues avant « prêt » (somme) | 8 120 / 7 230 | 5 775 / 7 752 | 7 675 → 6 764 |
| 1re visite · Annonces (CPU) | 2 995 / 2 892 | 2 917 / 3 005 | 2 944 → 2 961 (≈) |
| 1re visite · Ventes | 3 291 / 2 529 | 2 272 / 3 741 | 2 910 → 3 007 (≈) |
| 1re visite · Achats | 11 537 / 13 131 | 8 549 / 8 044 | **12 334 → 8 297 (−33 %)** |
| 1re visite · Argent | 6 766 / 5 854 | 5 501 / 4 640 | **6 310 → 5 071 (−20 %)** |
| 1re visite · Aujourd'hui | 3 145 / 3 711 | 2 803 / 2 343 | 3 428 → 2 573 (−25 %) |
| 2e visite · Annonces | 1 714 / 3 075 | 2 907 / 1 615 | 2 395 → 2 261 (≈) |
| 2e visite · Ventes | 5 044 / 5 350 | 3 698 / 4 653 | 5 197 → 4 176 (−20 %) — dont style 1 844 → 991 |
| 2e visite · Achats | 7 331 / 4 566 | 6 369 / 9 130 | 5 949 → 7 750 (bruit : une relecture de fond dans la fenêtre) |
| 2e visite · Argent | 7 578 / 11 040 | 2 910 / 5 180 | **9 309 → 4 045 (−57 %)** — dont style 2 743 → 935 |
| 2e visite · Aujourd'hui | 2 878 / 2 971 | 2 620 / 2 492 | 2 925 → 2 556 (−13 %) |
| « Plus » (la feuille) | 275 / 649 | 399 / 501 | 462 → 450 (≈) |
| une fiche d'Annonces · ouvrir | 2 376 / 2 907 | 1 642 / 1 004 | **2 642 → 1 323 (−50 %)** |
| une fiche · retour | 3 142 / 2 419 | 1 598 / 1 903 | **2 781 → 1 751 (−37 %)** |
| défilement Annonces · images/s · plus longue tâche | 41 / 43 · 516 / 591 ms | 49 / 49 · 167 / 257 ms | 42 → 49 im/s · **554 → 212 ms** |
| défilement Ventes | 36 / 35 · 667 / 687 | 43 / 40 · 409 / 379 | 36 → 42 im/s · **677 → 394 ms** |
| défilement Achats | 51 / 50 · 397 / 63 | 52 / 51 · 335 / 286 | 51 → 52 im/s · 230 → 311 ms (bruit) |
| tas JS en fin de parcours | 59,5 / 57,8 Mo | 66,8 / 61,1 Mo | 59 → 64 Mo (≈, dispersion) |

Les « chiffres d'Aujourd'hui » à froid ne sont pas relevés (« — ») : sur un appareil neuf, Aujourd'hui ne montre pas « Vendu ·
mois » dans les 2 minutes du banc (premier jour : autre présentation) — l'écran prêt fait foi. Relevés bruts : `JSON=` du banc
(gardés hors du dépôt).

**Mesures contrôlées** (une seule chose change, A/B alternés, médianes de 3) :
- **Un recalcul de style COMPLET du document** (sonde : une variable CSS héritée changée sur `<html>`, ×1, 390 tactile, base
  de volume) — avant → 1re version (`X .a, X .b` seulement) → version livrée : **Annonces 57,9 → 42,3 → 24,7 ms (−57 %) ·
  Achats 322,7 → 201,9 → 138,9 ms (−57 %) · Ventes 111,8 → 73,9 → 42,3 ms (−62 %)**.
- **15 000 mises en forme** (date courte, heure, montant) : 1 001 ms → 13 ms (formateurs gardés).
- **K8b** (natif-coque, retour sur un écran gardé, ×1) : pire tâche de style **84–92 ms → 59–69 ms** au téléphone (2 290
  éléments) ; **48 ms à l'ordinateur (vert)**. Toujours au-dessus de 50 ms au téléphone (§5).

## 3. Ce qui coûtait, et ce qui est corrigé

Mesuré sur `origin/main` (dd3336382), profils CPU (build non minifié, `PROFIL=`, `PROFIL_ONGLETS=`) et traces :

1. **Le style coûte ~25 µs par élément (×1)** — un écran de 4 000 à 8 000 éléments se restyle en 0,3 à 1,5 s au ×4, plusieurs
   fois par changement d'onglet (Argent : 2 × 13 600 éléments). Cause mesurée (`SELECTEURS=`) : des centaines de règles dont la
   dernière partie est `:is(…)` (`:root:root body .vrm-main :is(.vrm-x, .vrm-y)`), essayées sur TOUS les éléments.
   Mesuré aussi (micro-page, statistiques de sélecteurs de Chromium) : le moteur range une liste `:is`/`:where` à UN
   argument (par sa classe, son attribut, sa balise), jamais une liste à plusieurs. **Corrigé au build** :
   `scripts/_selecteurs-ranges.cjs` (greffon PostCSS, `vite.config.js` `css.postcss` : le nom du fichier livré suit son
   contenu). `X :is(.a, .b)` devient `X .a, X .b` quand les arguments sont des parties simples ; sinon chaque argument passe
   dans SA liste à un argument, `X :where(button):not(.vz_), X :where([role=tab]):not(.vz_)` — même sélection
   (`:is(a, b)` ≡ `:is(a), :is(b)`), même validité (`:where` est indulgent comme `:is` ; un argument qui emploie une
   pseudo-classe hors d'une liste fermée connue de tous les navigateurs ⇒ règle intacte), même spécificité (le complément
   `:not(.vz_)`, `:not(#vz_)`, `:not(vz_)` ne sélectionne rien : aucun élément ne porte ces noms). 730 règles réécrites
   (17 899 → 19 490 sélecteurs), +6 Ko compressés de CSS ; les listes `:is` en dernière partie passent de 688 à 0.
   Le dépôt garde les feuilles telles qu'écrites ; `VRM_SANS_RANGER=1` livre sans ; `VRM_RANGER_MUTATION=specificite`
   (sans complément) est la mutation du banc. Gain : §2, « mesures contrôlées » (−57 à −62 %).
   Essayé, pas gardé : déplier aussi les listes d'ANCÊTRES (`X :is(.a, .b) *`) pour le filtre des ancêtres — aucun gain
   mesuré (25,7 / 138,5 / 42,7 ms contre 25,9 / 141,2 / 39,1).
2. **Les dates et les nombres** : `toLocaleDateString('fr-FR', {…})`, `toLocaleTimeString`, `toLocaleString` construisent
   un formateur Intl À CHAQUE appel (≈ 67 µs ×1 ; des milliers par écran : `dateFr`, `jourDe`, `texteVerifie`… 0,5 à 1 s au
   ×4 par changement d'onglet dans les profils). **Corrigé** : `src/formatsRapides.js` (posé en tête de `src/main.jsx`) garde
   le formateur de chaque (langue, options), options complétées comme le dit la norme (ECMA-402 ToDateTimeOptions) ; tout cas
   hors du chemin courant passe par la méthode d'origine. Micro-mesure : 15 000 mises en forme 1 000 ms → 13 ms.
   Test : `node scripts/tests/formats-rapides.test.mjs` (8 378 comparaisons à l'identique, 9 langues × 25 jeux d'options ×
   dates et nombres limites ; `--prouve` : sans compléter les options ⇒ 2 232 écarts, rouge).
3. **Les grands chiffres qui s'ajustent** (`ajusterChiffre`, src/design/CarteMois.jsx) lisaient la largeur dans l'effet de
   chaque chiffre, au milieu des écritures des autres effets : un recalcul forcé par chiffre (profil, 1re visite d'Achats :
   4,5 s dans `ajuste` au ×4). **Corrigé** : les premiers ajustements d'un rendu sont faits ensemble, juste après la
   validation (micro-tâche : toujours avant l'image), les lectures d'abord. Mêmes mesures, même règle.
4. **Le démarrage** : la liste « Quoi de neuf » (src/nouveautes.js) et ses composants partaient avec l'app ; la carte ne se
   montre qu'une fois le nuage lu. **Hors du démarrage** (chargés par le crochet `useQuoiDeNeuf`, la clé vit dans
   `src/nouveautesCle.js` pour `SYNC_KEYS`) : **2 004 → 1 992 Ko** compressés (`audit-poids-demarrage`), budget abaissé
   **2 005 → 1 995 Ko** (`scripts/budget-vitesse.json`).
5. **Safari envoie `resize` quand sa barre d'adresse se replie** (à chaque changement de sens du défilement) : `applyZoom`
   (zoom, texte en grand) relisait alors le style de tout le document. **Corrigé** : même largeur, même zoom, même taille de
   texte ⇒ rien à refaire ; une rotation refait tout. (Pas mesurable dans Chromium : la barre d'adresse n'existe pas au banc.)

Essayé, pas gardé : l'attribut « réduit » de la barre de titre reposé à l'identique (mesuré : Blink ne restyle pas, rien à
gagner) ; `content-visibility: auto` sur les rangées hors écran (mesuré : `innerText` ne lit plus leur texte dans Chromium —
les bancs de chiffres comparent le texte rendu, et la recherche dans la page de Safari pourrait varier) — pas livré.

## 4. Preuves que rien ne change à l'écran ni dans les chiffres

- **Styles calculés identiques** (`styles-identiques`, version livrée `dist-apres4` contre `origin/main` dd3336382) : 8 écrans
  (Aujourd'hui, Annonces, Ventes, Achats, Argent, Messages, Stock, Paramètres) × 390 et 1512 × clair et sombre = **32 écrans,
  ~108 000 éléments, toutes leurs propriétés calculées identiques** (Achats · 1512 · sombre rouge une fois — barre latérale et
  bandeau de fraîcheur pas encore posés au relevé — vert en le relançant seul). Mutation `VRM_RANGER_MUTATION=specificite`
  (complément de spécificité retiré) : **Achats rouge** (couleurs du bouton de sélection), le contrôle voit l'erreur.
  Mutation `MUTATION=1` (une règle ajoutée) : rouge.
- **Formats** : `node scripts/tests/formats-rapides.test.mjs` 8 378 comparaisons identiques ; `--prouve` rouge.
- **Audits** : `audit-tdz`, `audit-variables`, `audit-traduction` (45 verts), `audit-quoi-de-neuf`, `audit-poids-demarrage`
  (+ `--prouve` 2/2) verts.
- **natif-coque** : 146 verts ; **K8b reste rouge au téléphone** (59–69 ms contre 84–92 avant ; 48 ms à l'ordinateur, vert).
- Pas relancés faute de temps (machine partagée à charge 11–20 une grande partie du chantier) : aujourdhui-natif, natif-ventes,
  fiche-directe, app-tableaux, chiffres-volume, drapeaux-justes. Aucune règle de calcul n'a changé (le code des chiffres
  n'est pas touché ; les formats rendent le même texte), mais ce n'est pas prouvé par banc : à passer à l'intégration.

## 4 bis. Après la fusion de `origin/main` (train du 20 nov., d7bc5598a) — « l'app est trop longue à charger »

- Fusion par un vrai `git merge` (conflits : CLAUDE.md, budget — celui de main, 2 020 Ko, repris). Démarrage mesuré après
  fusion : **2 005 Ko** compressés (App 1 524 Ko JS + 333 Ko CSS).
- **4G lente (1,6 Mbit/s, `MBIT=1.6 LECTURES=1`)**, base de volume : à froid, coque à **15,0 s**, écran prêt **17,5 s** — dont
  ~10 s pour télécharger 2 Mo de JS+CSS ; puis la base : 175 lectures, 3,8 Mo, dont **les commandes de tous les comptes en
  UNE lecture de 1,8 Mo (16,8 → 26,3 s)** et les dressings (560 Ko, 18,7 → 21,7 s), 38 lectures en double. C'est ce que la
  barre bleue attendait sur Annonces / Ventes (« bloquée à 80 % ») : elle ne redescend qu'à la fin de la DERNIÈRE lecture.
  Au chaud : 148 lectures, 678 Ko, écran prêt ~13 s — là c'est le calcul (§5.1, §5.2).
- **La barre bleue du haut est retirée** (Julien). Le compteur `onBusy` reste.
- Essayé, pas gardé : sortir le Stock 3D / le plan (`RoomPlan`, `AssistantRangement`, `PlanDessus`, 173 Ko de source) par
  `decouper-app.cjs` : le morceau part bien (110 Ko), mais le morceau App ne baisse pas (1 524 → 1 527 Ko : 45 noms
  exportés en plus ne se raccourcissent plus) — annulé.
- **Objectif −30 % du démarrage (≤ 1 404 Ko) : PAS atteint.** 40 % d'App.jsx est UNE fonction (`Comptabilite`, 2,25 Mo) qui
  porte Aujourd'hui ; les découpes mécaniques restantes ne déplacent que des miettes. Il faut d'abord découper
  `Comptabilite` par écran (Aujourd'hui seul au démarrage).
- **États de chargement refaits** (demande du 20 nov. : copie locale par écran, « Mise à jour… » discret, squelette aux vraies
  hauteurs, vignettes en fondu, « Pas à jour · Réessayer », planche 0 / 300 ms / 1 s / 3 s) : **pas faits** dans ce lot.

## 5. Ce qui reste — le plus gros d'abord (objectifs : chaud < 1 s, froid 4G < 3 s, onglet < 150 ms CPU, défilement sans
tâche > 50 ms — PAS atteints)

1. **Le calcul de l'app (script), 60 à 75 % du temps d'un changement d'onglet** — `Comptabilite` (2,26 Mo de code, un seul
   composant pour Aujourd'hui, Ventes, Achats, Annonces) se rend 1,0 à 1,7 s (×4) à chaque changement : ses `useMemo`
   recalculent (colis à envoyer, retraits, ventes) et des lectures `load()` relisent et ré-analysent le même JSON du
   `localStorage` à chaque rangée (`load('vinted_annonce_numeros')` : 65 appels dans App.jsx, dont certains par rangée —
   `rangsEnvoyerNatif`, `sitesPrixDe`). Une mise en cache générale de `load` est REFUSÉE ici (un appelant qui modifie l'objet
   lu sans le réécrire changerait les lectures suivantes) : à faire appel par appel, en relisant chaque appelant. Le vrai
   remède est de découper `Comptabilite` par écran (chaque écran ses calculs) — un chantier de réécriture, pas mécanique
   (`decouper-app.cjs` ne déplace que des déclarations de premier niveau).
2. **Le démarrage au chaud : 3,3 à 4 s avant la coque, sans aucun octet reçu** — une tâche de ~2 s (×4) au premier rendu
   (AppCoeur + Comptabilite) ; le code est déjà en cache (aucune compilation vue), c'est l'exécution. Même remède que 1.
   À froid (4G), +1,5 s de téléchargement (2 Mo compressés) : le morceau `App` (4,9 Mo, App.jsx seul en fait 4,1 Mo
   rendus) ne descendra qu'avec le découpage de `Comptabilite`.
3. **Des DOM cachés rendus quand même** : Annonces garde la grille d'hier montée et cachée (`CacheSiV2`, 6 776 éléments
   `display:none`, ~45 % du rendu d'Annonces), Ventes l'ancienne liste « Toutes » (1 469). Voulu (« ses effets, ses nombres
   publiés ») : l'instantané d'Annonces (`src/annoncesInstantanee.js`) et des recherches `[data-fiche-ligne]` lisent ce DOM.
   À débrancher en déplaçant ces lectures sur les données (pas le DOM).
4. **K8b au téléphone (59–69 ms)** : le retour sur Ventes restyle ~2 300 éléments (la liste entière, ~70 rangées × 30
   éléments). Reste du coût par élément : les règles `::selection` (5, essayées sur chaque élément), 174 règles en `*`,
   33 en `:not(…)`, 8 `:has(…)` sans ancre (`:has(> [data-lg])`, `:has(> .vrm-serie-case-photo)` : tout élément est
   « concerné par :has »). Moins d'éléments (liste en pages ou virtualisée) ou ces règles réécrites par le chantier qui
   tient le style.
5. **Achats, mise en page** : 1,4 à 3,2 s (×4) à la 1re visite (8 800 objets, 0,5 ms chacun — des grilles et flex imbriqués
   à taille intrinsèque). Et 141 rangées « À retirer » de 35 éléments chacune toutes rendues.
6. **Images** : le banc coupe les photos de Vinted (elles ne passent pas hors de l'extension) ; leur coût de décodage n'est
   pas mesuré ici. Les URL portent `f800` signé : prendre une vignette (`thumbnails` de Vinted) quand la donnée la porte,
   jamais en réécrivant l'URL signée.
7. **Mémoire** : le tas JS monte de ~35 à ~60 Mo au fil du parcours et jusqu'à 150–200 Mo dans les passes longues (écrans
   gardés, caches) — à suivre sur un vrai iPhone (Safari coupe un onglet vers 1 à 1,5 Go).
