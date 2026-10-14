# Changements VRM du 14 octobre 2026

Ce suivi complète le dossier d’idées : repartir du code actuel et des PR, pas du code copié dans le dossier V3.

## Changements intégrés aux PR523 à PR529

- Statuts des commandes partagés entre app, serveur et agent : annulations, remboursements, paiement et expédition partielle. Tous les articles d’une commande sont visibles.
- Photos de ventes depuis les transactions Vinted capturées, avec compte et transaction exacts, sans dépendre d’une annonce encore en ligne.
- Brouillons objet et texte des messages de commandes, isolés par vendeur/compte/commande. La réponse confirmée n’efface pas une saisie plus récente.
- Réponses réseau illisibles ou coupures pendant un envoi : état incertain conservé, renvoi bloqué, relecture exacte de l’échange. Aucun renvoi automatique.
- Bénéfice inconnu après remboursement partiel ou annulation à vérifier. Montants absents affichés sans les convertir en zéro.
- Pagination manuelle des commandes par compte ; couverture de la lecture courante distincte de l’historique conservé ; vérification des écritures concurrentes.
- Offres sans montant/devise/quantité valides : actions indisponibles. Champs de conversation mobile adaptés.

## PR530 : photos expirées

Les cartes de ventes essaient les différentes sources certaines associées à la vente. Une source qui fonctionne reste privilégiée, y compris pour ouvrir la photo. Les lectures supplémentaires sont ciblées après échec ; le module de récupération via extension conserve son comportement.

## Cette optimisation de pagination

`lireResumeCommandes` ne projette que version, date et curseur. La fusion protégée relit ensuite le contenu complet une seule fois. `undefined` signifie échec de lecture, `null` ligne absente. Ne pas les confondre. Une ancienne capture sans curseur commence à la première page sans perdre ses commandes sauvegardées.

443 contrôles de route avec réseau simulé passent, dont le filtrage vendeur, la lecture projetée, la conservation de l’historique et les erreurs de base. Le banc de pagination passe avec un résumé ne contenant ni commandes ni identifiants historiques. Le dernier banc revendeurs compte 178 contrôles réussis sur la correction photo.

## À préserver

Pas d’association par ressemblance de titre. Pas de zéro pour une donnée inconnue. Pas de message commercial sans confirmation. Produit destiné à tous les revendeurs : utiliser « article ». Extension toujours 5.177.0 ; ces correctifs ne changent pas son paquet. Les tests sont simulés et ne prouvent pas l’état des données privées de Julien.
