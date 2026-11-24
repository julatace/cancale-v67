# Visuel Annonces + Stock — l'inventaire « jeu vidéo », sans latence (24 nov. 2026)

Branche `claude/visuel-annonces` (depuis `claude/style-clair` #1326, + `main`, + `claude/visuel-jeu` #1355).
Se fusionne APRÈS #1326 et #1355.

## Ce que Julien a demandé

- « beaucoup mieux, beaucoup plus visuel » (les pop-ups « jeu vidéo ») ⇒ « toute l'application visuelle » ;
- « ne doit pas y avoir de bug visuel… tout est donné parfaitement et pas d'un coup en bloc… irréprochable » ;
- puis « fais quelque chose sans latence » : le connu s'affiche tout de suite, sans fondu ; le squelette seulement quand on
  ne sait rien ; la cascade seulement sur ce qui ARRIVE (≤ 15 ms par élément, ≤ 120 ms au total, jamais sur la 1re
  rangée) ; un toucher répond en < 100 ms ; aucune entrée d'écran au-delà de 200 ms.

## Ce qui est fait

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

### Pièces ajoutées au langage visuel (à signaler au propriétaire de src/natif/visuel/README.md)
- `src/natif/visuel/GrilleInventaire.jsx` (grille virtualisée, squelette, cascade par `revele`) ;
- `src/natif/visuel/Inventaire.jsx` : `AvatarCompte`, `AvatarsComptes`, `PontPhoto`/`PhotoPont`/`TaillePhoto` (passer la
  fonction photo d'un écran à `TuilePaire`, qui attend un composant stable) ;
- `src/natif/visuel/inventaire.css`, `src/natif/visuel/stock-inventaire.css` ;
- textes `inv.*` (src/i18n/langues/*/visuelAnnonces.js, 5 langues).

## Preuve

Banc `scripts/bancs/visuel-annonces.cjs` (page `outils/visuel-annonces/`, esbuild, vraies règles `sources.js`/`modele.js`,
600 annonces inventées sur 3 comptes + 1 Leboncoin, photos servies 600 ms en retard), 390 tactile et 1512, clair et sombre.
Voir « Résultats » ci-dessous.

## Résultats

(remplis en fin de session)

## Ce qui n'est pas fait / à savoir

- La LISTE du téléphone (rangées) n'est pas virtualisée : elle garde ses pages de 60 et `content-visibility: auto`.
- Le tableau de l'ordinateur (vue liste) est inchangé.
- Le logo Leboncoin est orange (sa marque) : le banc l'exempte, comme la Plaque rouge d'un doublon.
- Le temps d'image en défilant est RAPPORTÉ, pas jugé : la machine du banc est partagée (charge ~30 sur 4 cœurs).
