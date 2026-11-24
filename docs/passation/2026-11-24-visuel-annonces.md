# Visuel Annonces + Stock — l'inventaire « jeu vidéo », sans latence (24 nov. 2026)

Branche `claude/visuel-annonces` (depuis `claude/style-clair` #1326, + `main`, + `claude/visuel-jeu` #1355).
Se fusionne APRÈS #1326 et #1355.

## Ce que Julien a demandé

- « beaucoup mieux, beaucoup plus visuel » (les pop-ups « jeu vidéo ») ⇒ « toute l'application visuelle » ;
- « ne doit pas y avoir de bug visuel… tout est donné parfaitement et pas d'un coup en bloc… irréprochable » ;
- puis « fais quelque chose sans latence » : le connu s'affiche tout de suite, sans fondu ; le squelette seulement quand on
  ne sait rien ; la cascade seulement sur ce qui ARRIVE (≤ 15 ms par élément, ≤ 120 ms au total, jamais sur la 1re
  rangée) ; un toucher répond en < 100 ms ; aucune entrée d'écran au-delà de 200 ms.

## ⚠️ Changement de direction (même jour, Julien sur la grille : « je n'aime pas ce style-là, c'est bien mais juste améliore le design et la praticité »)

- **Plus de grande grille par défaut.** La LISTE reste l'affichage du téléphone ; « Détaillé » (les tuiles ci-dessous) se
  choisit dans « ⋯ » → Affichage (la bascule de la barre du haut est retirée).
- **La rangée** (`RangeeArticle`) : 72 px FIXES, photo 60 par identité, étiquette papier du N° (petite), titre sur 2 lignes,
  prix à droite, ♡ 👁 et l'âge en petites icônes ; l'état seulement s'il diffère de l'onglet ; logo du site seulement si la
  liste n'est pas rangée par compte (ou paire sur 2 sites) ; aucun rond de compte par rangée (il est dans l'intertitre).
- **La praticité** : un toucher ouvre la fiche (inchangé) ; **glisser la rangée vers la gauche** montre « Baisser » et
  « Republier » (84 × 72, les actions EXISTANTES de l'écran jugées sur cet article) ; « ⋯ » garde tous les gestes et gagne
  « Copier le lien » (l'adresse LUE de l'annonce, jamais fabriquée) ; **puces au pouce** sous les segments : Trier (récentes,
  prix ↓/↑, vues, favoris, anciennes), « Sans N° · n », « À confirmer · n », un compte (avec son rond) ; « Dorment » reste un
  segment ; la recherche est inchangée (instantanée) ; la sélection en série reste « ⋯ » → une action → cocher → lancer.
- **La liste est virtualisée** (GrilleInventaire en mode `ligne`, 72 px) : plus de « Voir 60 de plus » au téléphone.

## Ce qui est fait (1re direction, gardée pour « Détaillé » et l'ordinateur)

### Annonces = un inventaire (téléphone et ordinateur, vue « grille »)
- `CarteAnnonce` (src/natif/ecrans/AnnoncesCartes.jsx) devient une **tuile d'inventaire** : `TuilePaire` (src/natif/Jeu.jsx)
  en photo CARRÉE pleine largeur, l'**étiquette papier du N°** en bas à gauche (le doublon garde la Plaque rouge — le seul
  rouge), les **ronds des comptes** en haut à droite (initiale, teinte par identité `site:compte`, jamais orange), l'**état en
  « présence »** sur le rond (vert en ligne, anneau à confirmer, gris masquée/pause), la pastille d'état écrite seulement
  quand ce n'est pas « en ligne », **vues et favoris** en pastilles empilées en bas à droite (seulement s'ils sont LUS).
  Dessous : le titre (2 lignes), une ligne logos · prix · « ⋯ ». Hauteur FIXE (photo carrée + 96 px).
- La photo est `a.photo`, trouvée par identité dans src/articles/modele.js : la tuile ne cherche rien. Elle passe par
  `PhotoVinted` (src/photoTaille.js choisit la taille ; la largeur voulue, 360 px, est donnée par `TaillePhoto`).
- L'intertitre de chaque compte porte le même rond que ses tuiles.
- **Grille virtualisée** `src/natif/visuel/GrilleInventaire.jsx` : la hauteur totale est réservée d'emblée, seules les
  rangées proches de l'écran sont montées (≈ 20–50 cartes sur 600). Téléphone : 2 colonnes, par compte, plus de « Voir
  60 de plus » en grille. Ordinateur : `TableauTravail` l'utilise quand l'écran donne `carteCorps` (Annonces seulement).
- **Sans latence** : un contenu déjà connu (cache, visite précédente) s'affiche à la 1re image, sans squelette ni fondu.
  Squelette de la forme finale (intertitre 44 + tuiles) seulement quand la lecture n'a rien rendu. La cascade d'arrivée
  est celle de `revele(i, '', true)` (Jeu.jsx : 15 ms, ≤ 120 ms, 160 ms de fondu, la 1re carte jamais retardée), seulement
  pendant 600 ms après une arrivée VUE par l'écran. `prefers-reduced-motion` ⇒ rien ne bouge.

### Stock
- `src/natif/visuel/stock-inventaire.css` (importée par src/ecrans/Stock.jsx après les styles du Stock) : le N° de chaque
  case devient l'**étiquette papier** (le même papier que `EtiquetteN`), une case vide est un **creux**, une case prise une
  **tuile posée** ; « plus en ligne » passe de l'orange `--vrm-warn` à l'acier ; le doublon reste rouge. Aucune règle ni
  aucun JSX du Stock ne change (deux autres lots travaillent sur Stock.jsx : `stock-mieux`, `stock-rangement`). Le Stock 3D
  n'est pas touché.

#### Retouches du coordinateur (même jour)
- Le compte est dit UNE fois (§7) : au téléphone (liste rangée par compte), le rond est dans l'intertitre, plus sur les
  tuiles ; à l'ordinateur (grille non rangée), il est sur la tuile. Le logo du site n'est sur la tuile que si la liste n'est
  pas rangée par compte ou si la paire est sur 2 sites ou plus.
- Plus de point d'état : l'état n'est dit que s'il diffère de l'onglet (pastille en haut à gauche : à confirmer, masquée…).
- Le N°, les vues et les favoris sont dans une BANDE claire de 32 px au bas de la photo (rien posé sur la chaussure).
- Le « 410 » des captures était le texte des fausses photos du banc (retiré du banc) : l'app ne dessine rien à cet endroit.

## Pièces ajoutées au langage visuel (à signaler au propriétaire de src/natif/visuel/README.md)
- `src/natif/visuel/GrilleInventaire.jsx` (grille virtualisée, squelette, cascade par `revele`) ;
- `src/natif/visuel/Inventaire.jsx` : `AvatarCompte`, `AvatarsComptes`, `PontPhoto`/`PhotoPont`/`TaillePhoto` (passer la
  fonction photo d'un écran à `TuilePaire`, qui attend un composant stable) ;
- `src/natif/visuel/inventaire.css`, `src/natif/visuel/stock-inventaire.css` ;
- textes `inv.*` (src/i18n/langues/*/visuelAnnonces.js, 5 langues).

## Preuve

Banc `scripts/bancs/visuel-annonces.cjs` (page `outils/visuel-annonces/`, esbuild, vraies règles `sources.js`/`modele.js`,
600 annonces inventées sur 3 comptes + 1 Leboncoin, photos servies 600 ms en retard), 390 tactile et 1512, clair et sombre.
Voir « Résultats » ci-dessous.

## Résultats (2e direction, la LISTE)

Banc `visuel-annonces` (4 variantes, 600 annonces) : **100 verts, 0 rouge** (passage final). Mesures :
- liste virtualisée : 14–23 rangées montées sur 200 ; squelette à la place exacte ; CLS 0 à la lecture ET au défilement ;
- cascade sur ce qu'on VOIT : 15 ms par rangée, 90 ms au total, fondu 160 ms, 1re rangée sans délai ; contenu connu : rien ;
- toucher un segment : 31 ms dans la page ; défilement 95e centile 62–72 ms (charge 6–8 sur 4 cœurs) ;
- praticité : « Sans N° » (n = son nombre, 44 px), « Prix décroissant » (ordonné), glisser ⇒ « Baisser »/« Republier »
  (≥ 44, lancé sur CETTE annonce), « ⋯ » ⇒ « Copier le lien » + « Baisser le prix » ;
- prix à la taille du titre (15 px), demi-gras (600) ; moins d'un jour ⇒ « Auj. » (jamais « 0 j ») ; âge inconnu ⇒ aucune
  horloge (vérifié en défilant) ; la ligne d'infos ne coupe jamais un mot (ce qui ne tient pas s'efface en entier, la taille
  en dernier ; le banc mesure chaque bout).

**Bancs voisins** : build ✅ ; textes-visibles ✅ (16/0) ; annonces-dressing ✅ (après deux mises à jour assumées :
la bascule d'affichage vit dans « ⋯ », la vignette 56–64 au lieu de 52 — décision de Julien) ; stock-etageres : le
rouge du doublon que l'habit du Stock masquait est réparé ; restent K1/K4/K5 et H, **les mêmes 7 rouges sur l'arbre de
base** `origin/claude/style-clair` (vérifié : worktree de base, build, même banc) ⇒ rouges de main, pas de ce lot ;
annonces-grille : vise l'ancien écran `.vrm-ann-grid` (non touché).

## Résultats (1re direction)

Branche (après fusion de `claude/visuel-jeu` à jour, `useArrive`/`revele` « sans latence ») : **78 verts, 0 rouge**
(390 et 1512, clair et sombre, 600 annonces) :
- grille virtualisée : 17 cartes montées sur 200 par compte au téléphone, 36 sur 600 à l'ordinateur ; hauteur réservée ;
- identité : chaque carte montée (avant et après défilement) porte la photo de SON identifiant ; le leurre au même titre :
  deux photos différentes ; l'étiquette dit le N° de SA fiche ;
- sans latence : contenu connu ⇒ 0 image de squelette, 0 cascade, carte pleine à la 1re image ; contenu qui arrive ⇒
  1re carte sans délai, cascade 15 ms par carte, 120 ms au total, fondu 160 ms ; toucher un segment ⇒ 1er contenu dans la
  page en 32–53 ms (à l'écran à l'image suivante : 76–78 ms, machine chargée) ;
- le squelette est à la place EXACTE de la 1re carte (±1 px) ; CLS 0,0000 ;
- aucune couleur orange calculée (hors logos de site), aucune sortie, aucun chevauchement, aucun texte coupé, contrastes
  ≥ 4,5:1, cibles ≥ 44 ; mouvement réduit : 0 carte animée, 0 photo masquée ;
- défilement, 95e centile du temps d'image (rapporté, charge 13–15 sur 4 cœurs, rendu logiciel swiftshader) : téléphone
  161–171 ms, ordinateur 711–886 ms (voir la comparaison avec l'arbre d'avant ci-dessous).

**Arbre d'avant** (`git archive origin/claude/style-clair`, banc copié dedans, 390 clair) : **6 rouges** (pas de grille
virtualisée — 181 cartes montées —, pas de tuile ni de rond ni de pastilles, pas d'étiquette N° sur la photo, pas de
cascade, « ⋯ » qui sort de la carte et titres à demi-ligne, toucher 126 ms).

**Mutations** (chacune rougit) : photo prise au TITRE ⇒ I rouge (identité + leurre) ; pastilles remises en ligne ⇒ D
(étiquette × pastilles) ; rond de compte orange ⇒ O ; cascade sur le contenu connu ⇒ S (« contenu déjà connu ») ;
animation sous `prefers-reduced-motion` ⇒ M. Une intertitre de squelette plus courte ne rougissait PAS le CLS (les cartes
remplacent le squelette, elles ne le déplacent pas) : d'où la mesure « place EXACTE du squelette », qui l'attrape.

Captures et film : `scratchpad/visuel-annonces/` de la session (tel-clair, tel-sombre, ordi-clair, ordi-sombre,
chargement-et-defilement.webm).

## Ce qui n'est pas fait / à savoir

- La LISTE du téléphone (rangées) n'est pas virtualisée : elle garde ses pages de 60 et `content-visibility: auto`.
- Le tableau de l'ordinateur (vue liste) est inchangé.
- Le logo Leboncoin est orange (sa marque) : le banc l'exempte, comme la Plaque rouge d'un doublon.
- Le temps d'image en défilant est RAPPORTÉ, pas jugé : la machine du banc est partagée (charge ~30 sur 4 cœurs).
