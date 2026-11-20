# 20 nov. — Chasse aux bugs, deuxième passe (branche `claude/chasse-bugs-2`, partie de `claude/chasse-bugs`)

Julien : « continue à trouver des bugs ». Même méthode : rouge avant / vert après, mutation quand la règle est pure.
Aucun fichier de `vinted-sync-extension/` touché (5.410 en cours ailleurs).

## Nouveau banc : `scripts/bancs/parcours-chasse.cjs`
Julien au téléphone (390 tactile) et à l'ordinateur (1512) : chaque onglet, sa première rangée (la fiche), et avec
`CLICS=1` chaque bouton visible (25 au plus par onglet), dans six conditions — `volume` (base inventée au poids de la
sienne + 1 000 annonces), `vide`, `lente` (chaque lecture tenue 8 s), `panne` (503 partout), `longs` (titres de 180
caractères), `grand` (texte à 135 %, sombre). Il rapporte : erreurs JS / console, garde-fou, débordement,
« undefined / NaN », cibles < 44 px, texte coupé sans « … », la même lecture plus de 3 fois en 12 s, minuteries qui
s'accumulent au second passage. Pièges qu'il évite (ils faisaient juger une page vide) : `goBack` sans entrée poussée
quitte l'app ; l'écran de démarrage couvre la 1re seconde ; le titre pour lecteur d'écran (1 px) n'est pas « coupé ».

## Défauts corrigés
Voir le tableau du rapport final (repris ci-dessous au fil des commits).
