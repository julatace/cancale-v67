# 23 nov. 2026 — Le gris de vrm.center comme fond de l'app (branche `claude/style-gris`)

Julien, sur une capture de la page publique : « le gris de l'écran d'accueil » comme FOND de l'app, « mais il faut quand même que
les infos ressortent bien ». Captures vues par lui en cours de route : « ok c'est bien ».

## Les valeurs (lues dans le code de la page publique)

`src/accueil/accueil.css`, apparence de nuit de `.av` : `linear-gradient(180deg, #27272B 0%, #19191C 38%, #0F0F10 100%)` avec un
reflet `radial-gradient(90% 40% at 18% 0%, rgb(244 244 245 / .10), transparent 70%)` ; le bouton plein clair `#1C1C20` est l'aplat
du milieu. Dans l'app (`src/natif/jetons.css`, `:root[data-theme="dark"]`, et `MINERAL_DARK` de `src/themeMineral.js` pour le
code d'avant) :

- fond `#1C1C20` + `--n-fond-degrade` (le dégradé de la page, posé sous l'écran : `natif.css`, `.n-page` transparent la nuit) ;
- cartes `#2A2A2F` (un cran plus clair), `#323238`, bords `#42424A`, filets `#393940` ;
- texte `#FFFFFF`, secondaires `#B8B8C0` (≥ 6,7:1 sur une carte), tertiaires `#92929B` (icônes ≥ 3:1) ;
- vert `#7BE8BE`, ambre `#FFC266`, doublon (rouge §7) `#FF7A6E` ;
- le héros d'Aujourd'hui : l'ardoise bleutée du bouton de vrm.center (`#3D4B5B` → `#15161A`) avec un bord clair — il se
  détache du fond gris ; son gris secondaire à 82 % (≥ 4,5:1 sur son arrêt le plus clair).

## L'apparence par défaut

`src/apparence.js` (`apparenceDe`) et sa copie `public/demarrage-theme.js` : sans aucun choix posé (ni `vrm_apparence`, ni
`vinted_dark`), l'app est en SOMBRE. Un « Clair » déjà choisi (`vinted_dark` = false écrit par son geste) reste respecté ; il se
change dans Paramètres → Apparence. `audit-apparence` porté (les deux copies, mutations « absent ⇒ clair » rouges).
Écran de démarrage, barre d'état, manifeste : `#1C1C20` la nuit.

## Preuves

Banc `scripts/bancs/contraste-gris.cjs` : 8 écrans montés (Aujourd'hui, Annonces, Ventes, Achats, Argent, Stock, Messages,
Paramètres) × 390 et 1512, apparence par défaut : G1 sombre + fond `#1C1C20` ; G2 CHAQUE texte visible ≥ 4,5:1 (3:1 en grand),
le fond recomposé au point du texte (pile des éléments, transparences, opacités ; sur un dégradé, son arrêt le plus défavorable) ;
G3 cartes plus claires que le fond, héros qui se détache ; G4 rien ne déborde. Rouge sur l'app d'avant (G1 : clair par défaut).
Captures : scratchpad `sc-gris/` (vues par Julien), `sg/apres2/`.

## ÉTAT À LA REPRISE

Voir la PR. Reste : écrans non montés par le banc (Notifications, feuilles) jugés à l'œil seulement.
