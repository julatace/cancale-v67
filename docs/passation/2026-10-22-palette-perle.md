# Palette Perle appliquée à VRM

## Direction

Le thème React est la source des couleurs : perle lumineux, encre pétrole, accent sauge, chrome pétrole en fondu discret. Les deux variantes clair/sombre exposent les mêmes variables au document et à la coque ; les portails de détails héritent enfin du thème. Les jetons Gestion et Studio sont reliés à ces variables plutôt qu'à deux palettes indépendantes. Le fond de démarrage et la vitrine suivent la même famille. Logos et couleurs d'alerte sont conservés.

Les couleurs de texte principales, secondaires, légendes, boutons et navigation ont été contrôlées numériquement : minimum 4,5:1 sur leur surface de référence (légendes claires 4,81:1). Le fondu ne touche que les surfaces et remplissages des graphiques.

## Mise en page et statistiques

La courbe hebdomadaire gagne en largeur sur ordinateur. Le bloc Performance s'insère en bas à droite et les répartitions existantes disposent d'anneaux de 96 px (74 px sur téléphone). Les segments hors du top six sont agrégés, sans perdre leur effectif. Les tableaux et mentions de couverture restent disponibles.

Performance utilise les ventes du mois déjà lues pour afficher leur nombre et leur prix de vente moyen. Ce n'est pas un panier par acheteur ni une prévision. Lecture partielle : indicateurs masqués avec explication. Les détails Marques/Pays sont montés seulement à l'ouverture explicite du bloc et réutilisent les lectures enrichies de Statistiques : périmètre Vinted, toutes périodes, comptes exclus conservés. Aucun pays, médiane ou pourcentage de progression n'est inventé pour reproduire une maquette. Les courbes Vendu/Reçu gardent leurs notions métier ; elles ne sont pas rebaptisées CA/bénéfice.

## Contrôles

Build Vite ; tests unitaires ; parcours de l'accueil privé, de Statistiques avec valeurs attendues, des plateformes, de la navigation en clair/sombre, des paramètres et de la vitrine. Vérification spécifique du panneau de vente en mode sombre et de l'absence de lecture des pays avant ouverture de Performance. Données de banc fictives uniquement : aucune écriture de production et aucune certification du contenu d'un compte client.
