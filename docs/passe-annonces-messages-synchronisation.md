# Passe de fiabilité — annonces, messages/offres, synchronisation

## Périmètre terminé

### Préparation des annonces

L'éditeur conserve un brouillon VRM lorsqu'on le ferme après modification (croix, fond, retour/Échap via le mécanisme des feuilles). Titre, description, caractéristiques, dimensions, prix et réglages photos sont conservés ; aucun changement n'est publié sur Vinted. Une simple consultation ne crée pas de version.

Une saisie de prix incomplète est gardée telle quelle dans `priceInput`, sans devenir un prix valide. Les notations comme `1e2` ne sont plus transformées silencieusement en 100 €. La vue « Annonces à compléter » signale bien ce prix manquant dans le brouillon même si l'annonce native possède encore son prix. Un échec d'enregistrement laisse l'éditeur ouvert. Une modification pendant le bref retour « Enregistré » est conservée avant la fermeture différée. Le délai est annulé au démontage ; un changement de propriétaire empêche toute sauvegarde du brouillon sous le compte suivant.

Cette conservation concerne la fermeture de l'éditeur ; elle ne garantit pas la récupération après arrêt brutal du navigateur avant enregistrement.

### Messages et offres

Un retour HTTP positif contenant un refus métier natif (code Vinted différent de 0) n'est plus présenté comme un message ou une offre envoyé(e). Une réponse réseau indéterminée demeure indéterminée.

Pour les gestes d'offre (accepter, refuser, proposer un prix), une issue incertaine bloque les nouveaux gestes dans ce fil, y compris après fermeture/réouverture. Le lien Vinted permet de vérifier le résultat ; « J'ai vérifié sur Vinted » demande une confirmation avant de débloquer, sans renvoyer de requête. Le verrou couvre aussi le changement de conversation pendant une action en cours.

Une acceptation confirmée arrivée après changement de fil reste enregistrée sur le bon compte et les bons identifiants d'offre. Une relecture échouée après cette acceptation ne remet pas l'offre en attente. L'acceptation d'un prix ne confirme pas le paiement. Un nouveau prix préparé n'est pas effacé par une réponse plus ancienne.

Les libellés « en attente d'acceptation » et « non acceptée » ne sont plus interprétés comme une acceptation par une simple recherche du mot « accept ». Les codes natifs connus restent prioritaires.

### Relectures

Les annonces et conversations rejettent les réponses dépassées, même si le retard survient pendant la lecture complémentaire des descriptions. Le propriétaire et le jeu de comptes doivent toujours correspondre. Une vue arrêtée ne relance pas une ancienne lecture programmée.

Lorsqu'un compte de messagerie ne répond pas, ses dernières conversations connues restent affichées avec le compte signalé non relu. Les comptes retirés/exclus ou supprimés de la messagerie ne sont pas réintroduits. Une nouvelle capture native invalide une lecture plus ancienne encore en attente et enlève le seul compte effectivement relu de la liste des échecs.

## Validation

- Règles : `reponse-vinted`, `offres-vinted`, `lectures-vinted`.
- Vrais gestionnaires extraits de l'app : `actions-offres-vinted` et `relectures-interface-source` (promesses retardées, refus métier, changement de fil/propriétaire, conservation après panne).
- Vrai éditeur React extrait de l'app : `atelier-brouillon-fiable-interface.cjs`, 39 contrôles à 320/390/1512 px. Le composant de retour est simulé ; le mécanisme de feuilles est couvert par ses bancs existants.
- Compilation, audit de production et bancs de messagerie live/recherche.

Toutes les actions d'offre/message des tests sont simulées. Aucun compte réel n'est contacté ni modifié. Aucun SQL ni changement d'extension nécessaire.
