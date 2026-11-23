# 23 nov. — Achats à l'ordinateur : moitié gauche vide, tableau coupé (lot `achats-ordi-casse`)

## Ce que Julien a vu
Capture du 23 nov. 08:42 (Mac, Chrome, barre latérale ouverte, écran Achats, 2 045 achats) : la moitié gauche de la
zone de contenu vide (seule la barre de recherche du haut), la liste des achats dans la moitié droite, colonne
« Article » disparue, prix coupés (« …0 € »).

## Cause (mesurée)
`src/design/ventes-verre.css` §10 (15 nov., maquettes achats-1512/1280) met `.vrm-tache[data-tache="achats"]` en
grille à deux colonnes à partir de 1 100 px : `minmax(360px, 440px) minmax(0, 1fr)`, les codes « À retirer » à
gauche (rangées 4 à 40), tout le reste dans la colonne de droite. La grille s'allume dès que le repli « À retirer »
est OUVERT — et le design en service le garde TOUJOURS ouvert (`RepliRetirerAchatsTous` : `designV2 ? true`).
Depuis le 19 nov., la liste d'Achats à l'ordinateur est le TABLEAU DE TRAVAIL (`AchatsTableau` → `.n-tt-ordi`) :
serré dans la colonne de droite (≈ 60 % de la largeur), il débordait dans son cadre (colonne Article hors du
cadre, prix rognés) et, dès qu'on défile sous la courte colonne des codes, la moitié gauche restait vide.
Mesuré dans le banc (1 400 px) : `SECTION.vrm-tache` en `grid` `440px 640px`.

Pourquoi aucun banc ne l'a vu : `_garde-reseau.cjs` fait voir aux bancs le DOM d'AVANT le design
(`vrm_banc_dom_ancien`), où le repli est fermé sans colis à retirer : la grille ne s'allumait jamais.

## Correction (minimale)
Une ligne : la grille ne s'allume plus quand l'écran porte le tableau de travail
(`.vrm-tache[data-tache="achats"]:not(:has(.n-tt-ordi))`). Sans grille, les règles de placement (`grid-column`,
`grid-row`) n'ont plus d'effet : les codes « À retirer » passent au-dessus, pleine largeur, le tableau prend toute la
largeur. Le reste (gros chiffres du code, rangées sur deux étages) est inchangé.

## Banc neuf : `scripts/bancs/largeur-ordi.cjs`
Rend l'app TELLE QU'EN PRODUCTION (`BANC_DESIGN_V2=defaut`), base inventée (celle de refonte-achats). Écrans
Achats, Aujourd'hui, Annonces, Ventes, Argent, Stock à 1 100 / 1 280 / 1 512 / 1 920 px, et 1 280 / 1 512 barre
réduite ; en haut de l'écran puis la liste amenée en haut de la fenêtre :
L1 aucun vide à gauche (le texte visible commence à moins de 15 % de la largeur de contenu) ; L2 le tableau occupe
toute la largeur ; L3 colonne Article visible entière ; L4 aucune cellule prix / date coupée ; L5 le titre de
l'écran ni rogné ni couvert.

Résultats : build d'origin/main, Achats à 1 100 / 1 280 / 1 512 : **27 rouges** (tableau à 460 px du bord,
340 / 800 px à 1 100 ; prix, date, statut hors du cadre) — la capture « bas » reproduit celle de Julien. Après :
**264 bons, 0 rouge**. Aujourd'hui, Annonces, Ventes, Argent, Stock : verts avant comme après sur cette base (le vide
d'Aujourd'hui et le titre d'Annonces rogné signalés par un autre agent ne se reproduisent pas ici ; à mesurer sur
sa base s'ils reviennent). Limite connue : L1 seul (« texte à moins de 15 % du bord ») restait vert sur Achats avant
(un texte de la colonne des codes à 110 px) ; c'est L2 qui attrape le défaut.

## « … » d'Achats introuvable à l'ordinateur (banc achats-sourcing à 1512)
Le bouton « … » (Fournisseurs · Délai · Lots) vivait dans la barre des étapes, masquée à l'ordinateur depuis le
tableau (`!ordiAchats`, fusion ux-reglages du 22 nov.). Il est rendu seul, à droite, au-dessus du tableau
(`data-achats-barre-ordi`). achats-sourcing : 2 rouges (1512, 1512 sombre) avant, 108 / 0 après.

## ÉTAT À LA REPRISE
Voir la PR `claude/achats-ordi-casse` : correction CSS d'une ligne + banc. Geste de Julien : aucun (recharger
vrm.center).
