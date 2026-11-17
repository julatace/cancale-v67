# Maquette E « Le comptoir » (17 nov. 2026)

Demande de Julien (17 nov.) : « des choses TOTALEMENT différentes ». E = l'accueil devient l'app : une grille de
grandes tuiles vivantes (façon widgets iOS), une par zone (À envoyer, Argent du mois, À retirer, Messages, Vendu
aujourd'hui, En ligne, Prix à baisser, Offres / Sans prix d'achat s'il y en a, Tout VRM). Une tuile touchée s'ouvre
EN PLACE jusqu'à devenir l'écran (clip-path depuis la forme de la tuile, 440 ms) ; en bas, le dock des autres tuiles
en miniature remplace la barre d'onglets. Ordinateur : grille de 12 colonnes ; une tuile ouverte prend la scène, les
autres deviennent le rail de gauche. Tuiles rangées par appui long ou « Ranger le comptoir » (ordre gardé sur
l'appareil, `vrm_comptoir_ordre`).

- **Invisible pour Julien** : seulement `?banc_maquette=e` (gardé pour l'onglet, `?banc_maquette=0` l'éteint) —
  `src/maquettes/comptoirBanc.js`. Rien n'est proposé dans les réglages.
- **Branché sur les vraies données** : rendu depuis Ma journée (`src/App.jsx`, à côté de `BentoJournee`) avec les
  MÊMES compteurs (`T`, `colisJournee`, `bilanVentes`, `recuDuMois`, `stockQuiDort`…) et les panneaux `deplie`
  réels ; « — » quand ce n'est pas su. Le plein « Imprimer » est celui de Ma journée ; Chercher / Scanner / Publier
  appellent les gestes du disque (`COMPTOIR_GESTES`).
- Code : `src/maquettes/Comptoir.jsx`, `src/maquettes/comptoir.css`, textes `cp.*` (5 langues, `src/i18n/langues/*/comptoir.js`).
- Captures : scratchpad de session (`onglets/E-planche.png`), base inventée `scripts/bancs/_base-messages-stock.cjs`.

## Ce que E casse (si elle était retenue)
- La barre d'onglets du bas, son disque et la colonne de l'ordinateur disparaissent (le dock et le rail les
  remplacent ; « Tout VRM » liste les écrans ; hors du comptoir, un rond flottant y ramène).
- « Ma journée » n'est plus un écran : c'est le comptoir. La maquette ordinateur en colonnes du 15 nov. est remplacée.
- « Liste d'abord » ne vaut plus pour l'accueil (des tuiles, pas une liste) ; elle reste dans chaque tuile ouverte.
- Le détail du mois (`CarteStatsApp`) n'est pas dans le panneau Argent (un même chiffre ne s'écrit pas deux fois).
