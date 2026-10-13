# VRM — navigation et interface responsive

Le site conserve une navigation par plateforme. Sur ordinateur, le rail montre
Ma journée, les plateformes et quatre rubriques de gestion : Colis, Stock,
Statistiques, Comptabilité. Les détails Vinted et les outils occasionnels sont
repliables. Toutes les destinations précédentes restent accessibles.

Sur téléphone, les plateformes restent dans la barre du bas ; le menu du haut
regroupe les autres pages par usage, avec des boutons en deux colonnes. Il peut
être fermé avec Échap et garde le focus clavier dans son panneau.

Les raccourcis de période visibles se limitent à la période choisie, « Ce mois »
et « Mois dernier ». Les autres durées sont accessibles dans le sélecteur.

Les pages partagent des titres plus lisibles, des résumés sans cadre supplémentaire
et des onglets de plateforme au trait. L'en-tête eBay suit le thème choisi comme
son contenu. Le statut de synchronisation ouvre les paramètres au toucher.

Les commandes tactiles ont une hauteur minimale de 44 px et les champs une police
minimale de 16 px. Sur petit écran, une vente présente sa photo et son identité,
puis son prix et son action pleine largeur. Sur ordinateur, sa disposition reste
en ligne. Aucun calcul métier ni rapprochement de données n'est modifié.

Les anciens réglages qui réduisaient toute l'app à 65 % sont ignorés en dessous
de 768 px. Leur valeur est conservée pour les écrans plus grands. L'agrandissement
reste disponible et la hauteur de la coque compense le zoom pour garder la
navigation dans l'écran. La hauteur dynamique suit la barre d'adresse mobile.

## Vérification

```bash
npm run build
BANC_CHROMIUM=/usr/bin/chromium node scripts/bancs/mobile.cjs
node scripts/audit-variables.cjs
node scripts/audit-icones.cjs
node scripts/audit-boutons.cjs
```

Le banc mobile sert le build et des données synthétiques (222 contrôles réussis). Il interdit les
requêtes distantes et couvre les écrans à 320, 360, 390 et 430 px, les menus,
la recherche, les champs, les filtres, l'ancien zoom, l'agrandissement, la rotation
et le rail d'ordinateur à 1512 px. `BANC_CAPTURES` peut désigner un dossier hors
checkout pour les captures. Le banc échoue sur le code précédent, sur le zoom
65 % encore appliqué à 320 px.

Le banc de rapport comptable existant complète la vérification des parcours,
des actions et des exports sur téléphone et ordinateur. Dans cette machine,
un preload local corrige ses anciens chemins Playwright/Chromium ; le banc
lui-même reste inchangé.

Ces vérifications utilisent Chromium, pas un iPhone/Safari physique. Les images
générées pendant l'étude ne sont pas intégrées au site et ne représentent pas
l'inventaire du vendeur. Le statut de publication doit être vérifié séparément.
