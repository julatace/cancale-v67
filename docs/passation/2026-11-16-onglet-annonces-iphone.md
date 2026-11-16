# 16 nov. — « Annonces » dans la barre du bas depuis Ma journée (lot `onglet-annonces-iphone`)

## Le signalement
Le lot `reprendre-ou-jetais` (banc `reprise-ecrans`, P6, 390 tactile) a vu sur sa capture que toucher
« Annonces » dans la barre du bas depuis Ma journée ne menait pas à Annonces. Non expliqué ; P6 était passé
par `?tab=annonces` en attendant.

## Ce qui a été mesuré (origin/main, Chromium, 390 × 844 tactile, `touchscreen.tap` au centre de l'onglet)
- Appareil neuf ⇒ Ma journée, puis Annonces · Ma journée · Achats · Ma journée · Ventes · Ma journée · Argent ·
  Ma journée · Annonces : **chaque toucher mène à son écran**. Même chose dans le cas du signalement (dernier écran
  de 13 h ⇒ Ma journée, recherche d'Annonces de 11 min). Aucune erreur de page, le centre de chaque onglet est
  sous le doigt (aucune couche par-dessus).
- **La cause : le banc, pas l'app.** L'onglet « Annonces » de la barre porte l'identifiant `paires` (choix n° 61
  du 14 nov. ; Julien le 15 nov. : « ne mets pas paires, tu mets annonces » — seul le TEXTE a changé). Le banc
  cherchait `[data-nav-entree="annonces"]:visible` : sur Ma journée au téléphone il n'y en a aucun (les entrées
  `annonces` sont dans la colonne de l'ordinateur et dans le sélecteur Annonces · Stock, cachés ou absents)
  ⇒ aucun toucher, « pas arrivé ». À corriger dans `reprise-ecrans` (branche `claude/reprendre-ou-jetais`) :
  au téléphone, l'onglet d'Annonces est `paires`.
- À savoir (voulu, n° 61) : l'onglet « Annonces » rouvre le DERNIER de Annonces · Stock ouvert sur cet appareil ;
  un appareil neuf ⇒ Annonces.
- WebKit : pas installable dans ce conteneur (téléchargement refusé par le réseau). Le banc neuf est ajouté au
  job « Bancs sous WebKit » de la CI (`verifier.yml`) : la PR le joue sur le moteur de Safari.

## Ce qui change
- Banc neuf `scripts/bancs/barre-depuis-journee.cjs` (J1–J5) : la barre, puis au DOIGT, depuis Ma journée, chaque
  onglet ⇒ son écran, lui seul allumé, retour à Ma journée ; appareil neuf ET dernier écran de 13 h ; centre de
  l'onglet sous le doigt ; aucune erreur. Passe par `_navigateur.cjs` (`NAVIGATEUR=webkit`).
- Ajouté à la liste WebKit de la CI. Aucun changement de l'app (rien à corriger).

## Preuves
- origin/main : banc vert (voir le rapport de la PR).
- Mutation : l'onglet Annonces mène à Ma journée (`allerA('journee')` au lieu de `dernierePaire()`) ⇒ banc rouge.
- Captures regardées (Annonces, Achats, Ventes, Argent, Ma journée à 390).

## ÉTAT À LA REPRISE
Fini, PR ouverte. Reste : corriger le sélecteur de `reprise-ecrans` (`paires` au téléphone) sur sa branche.
Geste de Julien : aucun.
