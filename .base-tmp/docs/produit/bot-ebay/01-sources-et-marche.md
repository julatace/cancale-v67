# Sources, concurrence et niveau de preuve

## Méthode et limites

Audit effectué le 18 octobre 2026. Les douze tentatives HTTP suivantes ont reçu un refus CONNECT 403. Il ne s'agit pas d'une panne prouvée des sites ni d'une preuve qu'une fonction n'existe pas. Aucun tarif, taux de réussite, délai publicitaire ou fonctionnalité récente n'est présenté comme observé.

| Référence | Lien | Rôle dans la comparaison | État de consultation |
|---|---|---|---|
| Recherches enregistrées eBay | https://www.ebay.com/help/buying/search-tips/saved-searches?id=4051 | Comparer création, filtres, alertes et liens vers l'achat | Bloqué |
| Gixen | https://www.gixen.com/ | Examiner les parcours spécialisés d'enchères et leurs limites | Bloqué |
| Myibidder | https://www.myibidder.com/ | Examiner groupes d'enchères, budgets et actions disponibles | Bloqué |
| Auction Sniper | https://www.auctionsniper.com/ | Examiner paramètres d'enchères et traitement des échecs | Bloqué |
| WatchCount | https://www.watchcount.com/ | Examiner découverte d'annonces et informations réellement disponibles | Bloqué |
| VTools, URL candidate à confirmer | https://vtools.io/ | Référence d'expérience donnée par Julien ; ne pas lui attribuer des fonctions eBay | Bloqué |

Ces noms sont des **références à examiner**, pas un comparatif fonctionnel déjà validé. Le propriétaire et l'URL exacte du produit VTools souhaité doivent être confirmés avant de décrire son offre.

## Sources officielles effectivement lues

1. [eBay OAuth Node.js Client](https://github.com/eBay/ebay-oauth-nodejs-client/tree/28215678741221a3238de984d2cde524c70da904), README : distingue jeton d'application et autorisation utilisateur, fournit les parcours OAuth. Dernier commit annoncé par l'API GitHub lors de la consultation : 13 septembre 2022. **Cela ne prouve pas que VRM dispose des droits Buy en production.**
2. [eBay Feed SDK](https://github.com/eBay/FeedSDK/tree/af354dc4bc9e6ab963b8def3242bb401f5ab7cf9), README : téléchargement, décompression et filtrage de fichiers d'annonces, par marketplace prise en charge. Dernier commit annoncé : 2 novembre 2022. **Un traitement de fichiers n'est pas une preuve de flux instantané ou de couverture France.**

L'activité récente affichée sur un dépôt n'est pas assimilée à une mise à jour de son contrat API. Ces SDK anciens sont des preuves limitées, pas la documentation contractuelle actuelle.

## Contrats officiels restant à lire et à tester

| Contrat | URL | Vérification nécessaire |
|---|---|---|
| Browse | https://developer.ebay.com/api-docs/buy/browse/overview.html | Accès production, recherche, filtres, marketplaces, pagination, disponibilité, coût de livraison selon destination |
| Recherche Browse | https://developer.ebay.com/api-docs/buy/browse/resources/item_summary/methods/search | Paramètres réels, champs, limites de résultats, tri et erreurs |
| Quotas | https://developer.ebay.com/develop/get-started/api-call-limits | Quota réellement alloué à VRM, limites par méthode et période |
| Exigences Buy | https://developer.ebay.com/api-docs/buy/static/buy-requirements.html | Validation du modèle commercial, contrats, restrictions et mise en production |
| Order | https://developer.ebay.com/api-docs/buy/order/overview.html | Accès restreint éventuel, paiement, comptes/pays/catégories, confirmation et réconciliation |
| Feed | https://developer.ebay.com/api-docs/buy/feed/overview.html | Accès, disponibilité des fichiers, cadence, catégories et usages autorisés |

À vérifier également : conditions de stockage des données/images, durée de cache, liens d'attribution, traitement des données personnelles, usages autorisés de l'extension et droits relatifs aux offres/enchères. Ne pas déduire un droit d'achat du fonctionnement des API Sell déjà branchées à VRM.

## Grille du véritable comparatif à mener

Pour chaque produit, conserver une preuve datée (page officielle, essai ou réponse du fournisseur), le pays testé et le forfait :

- Création d'une recherche simple et avancée ; mots inclus/exclus ; caractéristiques de catégorie.
- Traitement des frais, livraison inconnue, devises et destination.
- Fraîcheur réelle des annonces, délai de détection et délai de notification séparés.
- Doublons, annonces refusées, baisses de prix, disponibilité relue.
- Recherche à prix fixe, enchères, offres et achat : tester séparément.
- Fonctionnement lorsque le téléphone est fermé et sans extension connectée.
- Budget global partagé entre recherches ; arrêt après achat ; résultat incertain.
- Travail en équipe, droits, audit et réception.
- Coût réel à usage comparable, fonctionnalités incluses, plafonds et support.

Mesurer sur des recherches identiques, des plages horaires comparables et un jeu couvrant plusieurs catégories. Ne pas utiliser l'heure de création d'une annonce comme preuve de l'heure à laquelle l'API l'a rendue visible. Ne pas prétendre connaître les occasions jamais observées : le rappel nécessite une référence indépendante et suffisamment complète.

## Différenciation proposée pour VRM, à démontrer

La meilleure piste est la continuité **repérage → vérification → décision → équipe → réception → comptabilité**, avec coûts inconnus visibles et budgets sûrs. La vitesse et le taux de correspondance doivent être mesurés avant d'être revendiqués. Aucun abonnement ni promesse « temps réel » ne doit être vendu sur la seule base de ce dossier.
