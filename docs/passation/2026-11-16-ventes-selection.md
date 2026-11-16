# 16 nov. 2026 — lot `ventes-selection` : la barre de sélection (bug vu par Julien sur iPhone)

## Ce que Julien a vu
Ventes, iPhone, production : « 1 sélectionné · Tout sélectionner · 2185 · Annuler », boutons
Imprimer / Je dépose / Exporter / Facture Pro ; on lisait les tuiles « À envoyer 3 · En route 27 ·
À payer 11 » À TRAVERS la barre, et la barre du bas se mélangeait avec elle. « je ne comprends pas
pourquoi ça me dit de sélectionner plus de 2000 articles ».

## Mesuré (code de main)
1. **2185** : `useSelectionSerie(ordreVentesSerie)` recevait `ventesAffichees` = TOUT l'historique
   filtré (« Toutes » = toutes sauf annulées), alors que l'écran n'en dessine que `ventesMax` (60),
   regroupées par compte (groupes repliés, lignes estompées des autres comptes). « Tout
   sélectionner » cochait 2 185 ventes invisibles, et les 4 actions partaient dessus. Même défaut
   sur Achats (`achatsAffiches`).
2. **« 1 sélectionné » sans voir la ligne** : le chemin est l'APPUI LONG (450 ms, `pointerType
   touch`). Sur iPhone, un doigt posé immobile un instant AVANT de faire défiler ouvre la
   sélection ; la ligne cochée part ensuite hors de l'écran (ou sous la barre). Rien ne l'annulait
   (seul un `pointermove` > 8 px, que Safari n'envoie plus une fois le défilement natif parti).
   Changer d'ONGLET vidait déjà (la barre est un portail ⇒ l'écran gardé est démonté,
   `ecransGardes.jsx` `feuilleOuverte`), mais changer de FILTRE ou de compte gardait les lignes
   encore dans l'historique.
3. **Transparence** : la barre prenait `--vrm-surface`, TRANSLUCIDE dans le thème verre
   (`studio-verre.css`) et en sombre (rgba .08). Au téléphone elle flottait à 76 px du bas, à
   cheval sur la barre de navigation.

## Fait
- `src/selectionSerie.js` : `clesSelectionnables(dessinees, { cle, exclue })` (les lignes rendues,
  sans les estompées, sans double) et `portee(lignes, peut)` (« N sur M »).
- Ventes et Achats (`src/App.jsx`) : l'ordre de la série = les lignes DESSINÉES
  (`ventesGroupees`/`achatsGroupees` ou les `…Max` premières) moins `estFloute`. `vue` =
  filtre + compte (+ période, masquées pour Ventes) : quand elle change, la sélection se vide.
- `src/composants/SelectionSerie.jsx` : une ligne hors de l'ordre ne se coche pas ; tout
  défilement pendant l'appui long l'annule ; à l'ouverture, la ligne cochée est ramenée au-dessus
  de la barre ; la racine porte `data-serie-ouverte` et `--vrm-serie-h` (hauteur mesurée) ;
  « Annuler » juste après le compte, « Tout sélectionner · N » à droite ; chaque action peut dire
  sa portée (`portee`) : « Imprimer · 0 sur 3 » grisé (aucun bordereau prêt), « Je dépose » 3/3.
  Textes par `tr()` (5 langues, `src/i18n/langues/*/serieSelection.js`).
- `src/selection-serie.css` : fond OPAQUE (jetons `--vrm-serie-fond`, clair/sombre) ; au
  téléphone la barre PREND LA PLACE de la barre du bas (comme Photos sur iPhone), la page garde
  `--vrm-serie-h` en bas ; les actions en grille d'UNE rangée.
- Exporter : toutes les lignes ont un sens. Facture Pro : sa série trie déjà (acheteur prouvé)
  et le résumé le dit ; pas de portée affichée (la règle vit côté facture, pas devinée ici).

## Preuves
- `node scripts/audit-actions-serie.cjs --prouve` : 38/38, mutations 32/32 rouges (11 neuves :
  historique compté sur Ventes/Achats, estompée sélectionnable, vue qui ne vide plus, défilement
  qui ouvre, barre du bas qui ne cède plus, action à 0 active…). Ancre « Enlever du stock »
  recalée (elle était déjà SANS ANCRE sur main).
- Banc `scripts/bancs/ventes-selection.cjs` (2 000 ventes finalisées + 3 à envoyer, inventées ;
  390 tactile et 1512, clair et sombre) : voir l'ÉTAT À LA REPRISE.

## ÉTAT À LA REPRISE
- Branche `claude/ventes-selection`. Voir le rapport du lot pour la PR et le résultat du banc.
- Le disque partagé est tombé plein pendant le lot (124 Mo libres) : un `git stash pop` a vidé
  CLAUDE.md, restauré depuis la remise. Vérifier `wc -c CLAUDE.md` après toute manipulation.
- Geste de Julien : aucun.
