# Suivi des données vendeur, favoris et inscription

## Résultat

- Réception : synthèse repliable par adresse et compte, dernier email daté de l'historique, compteurs de traitement/vérification/reprise et accès au filtre correspondant. Recherche par compte, adresse et raison. Les informations traitées sans action et les documents dont la disponibilité n'est pas certifiée sont explicités. Le périmètre reste les 100 derniers emails suivis, pas toute la boîte Gmail.
- Sources : points à vérifier par compte Vinted (lecture inconnue, capture privée absente, enregistrement de plus de 24 h), avec action proposée. La date d'enregistrement VRM n'est pas présentée comme une capture fraîche de la plateforme. Leboncoin indique les annonces capturées sans URL de photo. Aucun montant ni rapprochement métier modifié.
- Favoris : les prochains départs attendent l'écran des favoris actif. Si l'écran est quitté pendant la réservation, aucun dispatch n'a lieu et le résultat est enregistré comme refusé pour cette raison. Un envoi déjà dispatché doit toujours pouvoir terminer et être enregistré. Une clôture manuelle n'est pas comptée comme un message confirmé envoyé. Les délais HTTP couvrent aussi le JSON, sans AbortSignal.timeout et sans relance automatique.
- Performances : une seule requête de réception en vol ; une version initiale non nulle ne provoque plus deux lectures. Les panneaux hors écran ne sont pas interrogés chaque minute ; le retour visible relit les données. Une réponse d'un ancien propriétaire est annulée/ignorée. Les métadonnées sont indexées une fois, plutôt que balayées intégralement pour chaque compte.
- Inscription : verrou synchrone contre deux soumissions avant le rendu de l'état occupé, et identité/champs bloqués pendant la demande. Les parcours succès avec confirmation attendue et panne incertaine gardent le bouton de connexion accessible, sans faux échec définitif.

## Preuves et périmètre

Tests unitaires des adresses, dates futures, états inconnus, sources, indexation sur 2 000 comptes synthétiques, délai pendant la lecture JSON et distinction des clôtures manuelles. Tests React à 390/1512 px pour les lectures concurrentes, panneau masqué et changement de propriétaire ; favoris à 320/390/1512 px ; inscription dans l'app compilée à 390/1512 px, réponse succès et 503. Le banc complet de réception est remis à jour pour les libellés et étapes du guide actuel ; ses 54 contrôles passent.

Contre-épreuve sur la version précédente : réception initiale à version non nulle = 2 requêtes au lieu de 1 ; inscription double = 2 demandes au lieu de 1 ; une réservation de favori peut être dispatchée après changement d'écran. Les nouveaux bancs échouent sur cette version et passent sur le correctif.

Les tests ne créent aucun compte réel, n'envoient aucun message ou email et n'écrivent aucune vente en production. Ils ne certifient ni les accès/écrans courants des plateformes, ni la livraison SMTP, ni la charge de 2 000 utilisateurs simultanés. Les accès administrateur et comptes réels ne sont toujours pas disponibles dans la session. Le script Google installé n'est pas modifié par cette livraison du site.
