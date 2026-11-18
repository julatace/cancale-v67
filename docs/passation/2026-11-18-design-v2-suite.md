# 18 nov. — La suite du nouveau design (lot `design-v2-suite`)

Le nouveau design est en ligne et allumé par défaut (#1246, 6f4bb2dde). L'audit visuel du 17 nov. (main contre
claude/design-v2) laissait ouverts, pour claude/design-v2 (coque, Annonces, Achats, Aujourd'hui, barre), ses
« à corriger » B1–B11 et ses finitions C1–C6, C10. Ventes, Argent, Stock et Messages sont à leurs lots (#1258, #1254,
#1249, #1263) : rien de leurs écrans n'est touché ici. Aucune règle d'affaires ne change : affichage seulement.

## Ce qui change pour Julien

- **Aujourd'hui** : « À faire » est une liste de rangées qu'on touche entières (un chevron), le nombre à droite dans
  une colonne (« Messages à lire · 9 »), le détail sur une ligne. Plus de petit bouton « Voir / Écrire / Répondre » sur
  chaque ligne (B1, C1, C3). L'ambre ne reste que là où il faut agir : une date limite ESTIMÉE dépassée (« à vérifier »,
  vente + 7 j, §5) est dite en gris, et UNE fois au-dessus de la bande (« Date limite : à vérifier ») au lieu de sous
  chaque carte (B2). Ventes pas encore lues : une rangée « Ventes pas encore lues · Ouvrir Vinted › » à la place d'un
  « — » géant (B3) ; base injoignable : rien (la coque le dit une fois). À l'ordinateur, deux colonnes : la bande et
  « À retirer » à gauche, « À faire » à droite, la bande en grille sans coupe au bord (B6).
- **Annonces** : le titre ne redit plus la taille (« Vans xt-6 » + « T37 ») ; plus d'icône lien sur chaque rangée
  (« Relier » reste le glisser, la fiche, et la vue « Sans achat relié » qui les montre toutes) (B8). Aucun mot coupé
  au milieu dans un titre.
- **Achats** : « À retirer · 0 » et son scanner ne s'affichent plus quand il n'y a rien à retirer ; « 60 à vérifier »
  est UNE rangée qui ouvre le détail des retraits, posée avec les passes (rien ne glisse) ; « En route » ne redit pas le
  même nombre ; la carte de chiffres d'hier (Dépensé · En route · À retirer · Arrivés) n'est plus sur Achats (Argent les
  porte) (B4). À l'ordinateur, une colonne de 760 (la même composition qu'au téléphone) ; « Ajouter » n'est plus coupé
  sous la loupe ; le « ⋯ » de chaque achat de l'historique se montre au survol (B5, C5).
- **Coque** : « Extension à installer » est une pastille de verre, plus un second bouton plein (B7) ; loupe, cloche,
  profil, montants et les ronds de la fiche passent par le composant (`data-v2b`, B11, C6) ; un seul trait d'icône
  (1,5 px rendus, B10) ; le libellé de l'onglet choisi passe à 4,5:1 (mesuré 3,9 sur les pixels) ; le message
  « N nouvelles paires numérotées » tient sur 2 lignes (C10 : la liste complète des N° est dans Aujourd'hui → À faire).
- **Très grand texte** : le plein compact (« Publier », « Ajouter ») devient un rond « + » (son nom reste lu) sur la
  ligne du menu plateforme : 4 bandes avant la liste au lieu de 5.
- **Échelle** (B9) : jetons `--v2-r-*`, `--v2-e-*` ; dans `.v2-*` plus aucune taille, graisse, rayon ou espacement hors
  échelle (étiquette, menu, rangées passés sur la grille de 4). C2 : `--v2-bouton-h` vaut 50, les pleins pleine largeur
  le font ; les compacts de la ligne du titre font 44 exprès.

Code : `src/designV2/suite.css` (importée EN DERNIER par App.jsx ; les `!important` dans `@layer vrm-v2`, la première
couche : un `!important` d'une couche passe devant ceux des couches d'hier ET des feuilles sans couche), quelques lignes
dans `Aujourdhui.jsx`, `LigneAnnonce.jsx`, `PassesRetrait.jsx`, `App.jsx` (Aujourd'hui, Achats, coque), `FichePaire.jsx`,
`CentreNotifs.jsx` ; textes `src/i18n/langues/*/v2suite.js` (fr, en, es, it, de).

## L'audit visuel permanent : `scripts/audit-visuel-v2.cjs`

Un banc (Playwright, base inventée de `design-passe.cjs`, garde réseau), mesure dans la page
`scripts/bancs/_mesure-visuel-v2.js`. Formats c390, s390, x375 « Très grand », d1512. Écrans JUGÉS : Aujourd'hui,
Annonces, Achats, la fiche ; Ventes, Stock, Argent, Messages, Paramètres RAPPORTÉS (leurs lots). Les 19 règles de
l'audit du 17 nov. (liste en tête du fichier) + CLS au changement d'onglet (≤ 0,02) + fluidité.
Cliquets (règles 7 et 8) : `scripts/bancs/_cliquets-visuel.json`, seulement pour baisser (`CLIQUET_ECRIRE=1`).
`SHOTS=dossier` garde les captures annotées (lettre de la règle sur chaque défaut). ~6 min.

CI : job « Bancs principaux » part 1 (la plus légère : 5–6 min avant lui, 45 permises), par `lancer-bancs.cjs` (un nom
cherché aussi dans `scripts/`) ; `lancer-audits.cjs` le saute (`BANCS_PAS_ICI`).

Écarts assumés (mesurés, dits) :
- règle 8 : l'étiquette carton (signature) garde son rayon de 3 et son coin coupé ; une réserve > 64 px (la pile du bas)
  n'est pas un espacement ;
- règle 11 : le nombre du plein EST son geste (« Imprimer 15 ») ; une taille (T36) est un attribut, pas un compte ;
- règle 13 : la barre du bas et la cloche (pastilles de compte) sont hors de l'écran jugé ;
- fluidité : RAPPORTÉE, pas jugée (`FLUIDITE_JUGEE=1` pour juger). Annonces à 938 annonces en ligne, toutes montées,
  processeur × 4 : p95 83 à 333 ms selon la charge de la machine (médiane 33–83). Les longues images mesurées
  (Long Animation Frames) sont SANS script : rastérisation logicielle (swiftshader) sur 4 cœurs partagés à 3–13 de
  charge ; `content-visibility: auto` était déjà sur les rangées A/C (signature.css), ajouté sur « En route ».
  À juger sur un vrai iPhone ou une machine calme avec GPU — non prouvé ici.

Preuves : rouge sur le build de main (9814b67c9), rouge par mutation (`MUTATION=titre`, `pile`, `bouton`), vert après.
Chiffres dans « ÉTAT » ci-dessous.

## Restes (pas faits, dits)

- B11 en partie : « ? » (aide), le micro et le « ⋯ » de la recherche d'Annonces, `fd-plein` de la fiche, la pastille
  d'état et le micro de l'île restent hors composant — tenus par le cliquet (ne peuvent qu'en perdre).
- Le segment d'Annonces en très grand texte : « À publier » touche le bord (il défile, rien n'est perdu).
- La fluidité à prouver sur un vrai appareil.

## ÉTAT
